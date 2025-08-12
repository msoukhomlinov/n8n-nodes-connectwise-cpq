import type {
  IDataObject,
  IExecuteFunctions,
  IExecuteSingleFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  JsonObject,
  GenericValue,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';


export async function cpqApiRequest(
  this: IExecuteFunctions | IExecuteSingleFunctions | ILoadOptionsFunctions,
  method: IHttpRequestMethods,
  endpoint: string,
  body?: IDataObject | IDataObject[],
  qs?: IDataObject,
  options: IDataObject = {},
): Promise<unknown> {
  const credentials = await this.getCredentials('connectWiseCpqApi');
  const baseUrl = (credentials.baseUrl as string) || 'https://sellapi.quosalsell.com';

  // Build Basic token explicitly per CPQ docs: base64(accessKey+PublicKey:PrivateKey)
  const accessKey = ((credentials.accessKey as string) || '').trim();
  const publicKey = ((credentials.publicKey as string) || '').trim();
  const privateKey = ((credentials.privateKey as string) || '').trim();
  const username = `${accessKey}+${publicKey}`;
  const basicToken = Buffer.from(`${username}:${privateKey}`, 'utf8').toString('base64');
  const enableDebug = Boolean(credentials.enableDebug);
  const debugShowAuthToken = Boolean(credentials.debugShowAuthToken);

  const requestOptions: IHttpRequestOptions = {
    method,
    url: `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`,
    qs,
    body: body as unknown as GenericValue | GenericValue[],
    json: true,
    headers: {
      Authorization: `Basic ${basicToken}`,
      'Content-Type': 'application/json; version=1.0',
      Accept: 'application/json',
      'User-Agent': 'n8n-connectwise-cpq',
    },
  };

  if (Object.keys(options).length) {
    Object.assign(requestOptions, options);
  }

  const maxRetries = 3;
  let attempt = 0;
  let lastError: Error | undefined;

  while (attempt < maxRetries) {
    try {
      if (enableDebug) {
        // Mask sensitive values before logging
        const maskedHeaders = { ...(requestOptions.headers || {}) } as IDataObject;
        if (maskedHeaders.Authorization && !debugShowAuthToken) maskedHeaders.Authorization = 'Basic ***';
        // eslint-disable-next-line no-console
        console.log('[ConnectWise CPQ] Request', {
          method: requestOptions.method,
          url: requestOptions.url,
          qs: requestOptions.qs,
          headers: maskedHeaders,
          username,
          tokenPreview: debugShowAuthToken ? `Basic ${basicToken}` : 'Basic ***',
        });
      }

      const response = await this.helpers.httpRequest({
        ...requestOptions,
        // Ask for full response if available in this runtime; if not, typical helper returns body
        // n8n httpRequest may not support fullResponse flag universally, so we log what we have
      } as IHttpRequestOptions);

      if (enableDebug) {
        // eslint-disable-next-line no-console
        console.log('[ConnectWise CPQ] Response OK', {
          url: requestOptions.url,
          // We might not have headers/status if helper returns just body
          bodyType: Array.isArray(response) ? 'array' : typeof response,
        });
      }
      return response;
    } catch (error) {
      lastError = error as Error;

      if (enableDebug) {
        const err = error as { statusCode?: number; response?: { status?: number } };
        const statusCode = err.statusCode ?? err.response?.status;
        // eslint-disable-next-line no-console
        console.error('[ConnectWise CPQ] Request failed', {
          url: requestOptions.url,
          method: requestOptions.method,
          statusCode,
          message: (error as Error).message,
          responseHeaders: (error as { response?: { headers?: unknown } }).response?.headers,
          responseData: (error as { response?: { data?: unknown } }).response?.data,
        });
      }

      // Retry on 429 or transient 5xx
      const err = error as { statusCode?: number; response?: { status?: number } };
      const statusCode = err.statusCode ?? err.response?.status;
      if ([429, 500, 502, 503, 504].includes(Number(statusCode)) && attempt < maxRetries - 1) {
        const backoff = 500 * Math.pow(2, attempt); // 500ms, 1000ms, 2000ms
        await new Promise((resolve) => setTimeout(resolve, backoff));
        attempt += 1;
        continue;
      }
      throw new NodeApiError(this.getNode(), error as JsonObject);
    }
  }

  // Should not reach here; just in case
  throw new NodeApiError(
    this.getNode(),
    (lastError ?? new Error('Unknown error')) as unknown as JsonObject,
  );
}


export async function cpqApiRequestAllItems(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  propertyName: string,
  method: IHttpRequestMethods,
  endpoint: string,
  body: IDataObject | IDataObject[] = {},
  qs: IDataObject = {},
  options: IDataObject = {},
  limit?: number,
  pageSize = 50,
): Promise<unknown[]> {
  const returnData: unknown[] = [];
  let page = 1;

  while (true) {
    const responseData = await cpqApiRequest.call(
      this,
      method,
      endpoint,
      body,
      { ...qs, page, pageSize },
      options,
    );

    const items = (propertyName
      ? (responseData as IDataObject)[propertyName]
      : (responseData as unknown)) as unknown[];
    if (!Array.isArray(items)) {
      // Some endpoints return arrays directly
      const arr = Array.isArray(responseData) ? (responseData as unknown[]) : [];
      returnData.push(...arr);
    } else {
      returnData.push(...items);
    }

    if (limit && returnData.length >= limit) {
      return returnData.slice(0, limit);
    }

    // Stop when fewer than requested pageSize items are returned
    const returnedCount = Array.isArray(items)
      ? items.length
      : Array.isArray(responseData)
      ? responseData.length
      : 0;
    if (returnedCount < pageSize) {
      break;
    }
    page += 1;
  }

  return returnData;
}

/**
 * Format a JSON Patch operations array for PATCH endpoints.
 *
 * @param {{ op: string; path: string; value?: unknown; from?: string }[]} operations JSON Patch ops
 * @returns {unknown[]} Normalised operations array
 */
export function prepareJsonPatch(
  operations: {
    op: string;
    path: string;
    value?: unknown;
    from?: string;
  }[],
): IDataObject[] {
  if (!Array.isArray(operations)) return [];
  return operations.map((op) => {
    const { op: operation, path, value, from } = op;
    const entry: IDataObject = { op: operation, path } as unknown as IDataObject;
    if (typeof from !== 'undefined') (entry as IDataObject).from = from;
    if (typeof value !== 'undefined') (entry as IDataObject).value = value as unknown as GenericValue;
    return entry as unknown as IDataObject;
  });
}

/**
 * Build a ConnectWise-style conditions string from UI inputs, merging with any raw conditions.
 * Rules from docs:
 * - Strings must be quoted with double quotes
 * - Integers as-is
 * - Boolean True/False
 * - Datetimes in square brackets [ISO-8601]
 * - Operators: <, <=, =, !=, >, >=, contains, like, in, not, not contains, not in
 * - Reference: field/reference => field + '/' + subfield
 * - Join with AND/OR
 */
export function buildConditionsFromUi(
  rawConditions: string | undefined,
  ui: { conditions?: Array<{ field?: string; referenceSubfield?: string; operator?: string; valueType?: string; value?: string; values?: string }> } | undefined,
  logic: 'and' | 'or' = 'and',
): string | undefined {
  const parts: string[] = [];
  if (ui && Array.isArray(ui.conditions)) {
    for (const row of ui.conditions) {
      if (!row) continue;
      const fieldName = (row.field || '').trim();
      const ref = (row.referenceSubfield || '').trim();
      if (!fieldName && !ref) continue;
      const operatorRaw = (row.operator || '=').toLowerCase();
      // Normalise operators to API text
      let operator = operatorRaw;
      if (operatorRaw === 'not contains') operator = 'not contains';
      if (operatorRaw === 'not in') operator = 'not in';

      const valueType = row.valueType || 'string';
      const valueStr = (row.value ?? '').toString();
      const valuesStr = (row.values ?? '').toString();

      const left = ref ? `${fieldName}/${ref}` : fieldName;
      if (!left) continue;

      let right: string | undefined;
      if (valueType === 'list') {
        const list = valuesStr
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .map((s) => `"${s.replace(/\\"/g, '"')}"`)
          .join(',');
        if (list.length > 0) right = `(${list})`;
      } else if (valueType === 'string') {
        right = `"${valueStr.replace(/\\"/g, '"')}"`;
      } else if (valueType === 'integer') {
        right = `${Number.parseInt(valueStr, 10)}`;
      } else if (valueType === 'boolean') {
        const b = /^true$/i.test(valueStr) ? 'True' : /^false$/i.test(valueStr) ? 'False' : valueStr;
        right = b;
      } else if (valueType === 'datetime') {
        right = `[${valueStr}]`;
      }

      if (!right) continue;
      parts.push(`${left} ${operator} ${right}`);
    }
  }

  const joined = parts.join(` ${logic.toUpperCase()} `);
  const trimmedRaw = (rawConditions || '').trim();
  if (trimmedRaw && joined) return `${trimmedRaw} ${logic.toUpperCase()} ${joined}`;
  if (trimmedRaw) return trimmedRaw;
  if (joined) return joined;
  return undefined;
}