import type {
  IDataObject,
  IExecuteFunctions,
  IExecuteSingleFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  INode,
  JsonObject,
  GenericValue,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';


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
  // NOTE: This auth logic is duplicated in credentials/ConnectWiseCpqApi.credentials.ts (preAuthentication hook).
  // Both must stay in sync if the scheme ever changes.
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
          body: requestOptions.body,
          headers: maskedHeaders,
          username: debugShowAuthToken ? username : `${accessKey}+***`,
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
      if ([429, 502, 503, 504].includes(Number(statusCode)) && attempt < maxRetries - 1) {
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

/** Build a CPQ conditions string from the new `filters` fixedCollection UI. */
export function buildFiltersFromUi(
  filters: {
    conditions?: Array<{
      field?: string;
      operator?: string;
      valueType?: string;
      value?: string;
    }>;
  } | undefined,
  logic: 'and' | 'or' = 'and',
  rawConditions?: string,
): string | undefined {
  const parts: string[] = [];

  if (filters && Array.isArray(filters.conditions)) {
    for (const row of filters.conditions) {
      if (!row) continue;
      const fieldName = (row.field ?? '').trim();
      if (!fieldName) continue;

      const operator = (row.operator ?? '=').toLowerCase();
      const valueType = row.valueType ?? 'string';
      const rawValue = (row.value ?? '').trim();
      const isListOperator = operator === 'in' || operator === 'not in';

      let right: string | undefined;
      if (isListOperator) {
        const items = rawValue.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        if (items.length === 0) continue;
        right = `(${items.map((item) => formatSingleValue(item, valueType)).join(',')})`;
      } else {
        if (!rawValue) continue;
        right = formatSingleValue(rawValue, valueType);
      }

      if (!right) continue;
      parts.push(`${fieldName} ${operator} ${right}`);
    }
  }

  const joined = parts.join(` ${logic.toUpperCase()} `);
  const trimmedRaw = (rawConditions ?? '').trim();
  if (trimmedRaw && joined) return `${trimmedRaw} ${logic.toUpperCase()} ${joined}`;
  if (trimmedRaw) return trimmedRaw;
  if (joined) return joined;
  return undefined;
}

function formatSingleValue(value: string, valueType: string): string {
  switch (valueType) {
    case 'integer': {
      const n = Number.parseInt(value, 10);
      return Number.isNaN(n) ? '' : `${n}`;
    }
    case 'boolean':
      return /^true$/i.test(value) ? 'True' : /^false$/i.test(value) ? 'False' : value;
    case 'datetime': {
      // CPQ only supports date-only in brackets, e.g. [2016-08-20].
      // Strip the time component (T...) so "2026-02-03T01:39:56-05:00" → "[2026-02-03]".
      const dateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? value;
      return `[${dateOnly}]`;
    }
    case 'string':
    default:
      return `"${value.replace(/"/g, '\\"')}"`;
  }
}

/**
 * Cast a string value from the fixedCollection UI to the correct JSON type
 * for a JSON Patch body, based on the field's Swagger type.
 *
 * @throws NodeOperationError when a numeric field cannot be parsed
 */
export function castUpdateValue(
  node: INode,
  itemIndex: number,
  value: string,
  type: string,
): unknown {
  switch (type) {
    case 'boolean': {
      if (/^true$/i.test(value)) return true;
      if (/^false$/i.test(value)) return false;
      throw new NodeOperationError(
        node,
        `Cannot parse "${value}" as boolean. Expected "true" or "false".`,
        { itemIndex },
      );
    }
    case 'integer': {
      if (!/^-?\d+$/.test(value.trim())) {
        throw new NodeOperationError(node, `Cannot parse "${value}" as integer.`, { itemIndex });
      }
      return Number.parseInt(value.trim(), 10);
    }
    case 'number': {
      if (!/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value.trim())) {
        throw new NodeOperationError(node, `Cannot parse "${value}" as number.`, { itemIndex });
      }
      return Number.parseFloat(value.trim());
    }
    default:
      return value;
  }
}