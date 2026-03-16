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

// ---------------------------------------------------------------------------
// Date arithmetic helpers (private)
// ---------------------------------------------------------------------------

function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + n);
  return result;
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday-based ISO week
  result.setDate(result.getDate() + diff);
  return result;
}

function endOfWeek(date: Date): Date {
  const mon = startOfWeek(date);
  return addDays(mon, 6); // Sunday
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfQuarter(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3, 1);
}

function endOfQuarter(date: Date): Date {
  const q = Math.floor(date.getMonth() / 3);
  return new Date(date.getFullYear(), q * 3 + 3, 0);
}

// ---------------------------------------------------------------------------
// resolveDatePreset — converts a date preset into condition fragments
// ---------------------------------------------------------------------------

export interface DateFragment {
  operator: string;
  value: string; // already in [YYYY-MM-DD] bracket format
}

export function resolveDatePreset(
  preset: string,
  dateValue?: string,
  dateRangeStart?: string,
  dateRangeEnd?: string,
): { fragments: DateFragment[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bracket = (d: Date) => `[${formatDateOnly(d)}]`;

  // Helper: single-value range (>=start AND <=end)
  const range = (start: Date, end: Date): { fragments: DateFragment[] } => ({
    fragments: [
      { operator: '>=', value: bracket(start) },
      { operator: '<=', value: bracket(end) },
    ],
  });

  // Helper: single exact match
  const exact = (d: Date): { fragments: DateFragment[] } => ({
    fragments: [{ operator: '=', value: bracket(d) }],
  });

  switch (preset) {
    // --- Exact Day ---
    case 'today':       return exact(today);
    case 'yesterday':   return exact(addDays(today, -1));
    case 'tomorrow':    return exact(addDays(today, 1));

    // --- Past Rolling ---
    case 'last7days':   return range(addDays(today, -7), today);
    case 'last14days':  return range(addDays(today, -14), today);
    case 'last30days':  return range(addDays(today, -30), today);
    case 'last45days':  return range(addDays(today, -45), today);
    case 'last60days':  return range(addDays(today, -60), today);
    case 'last90days':  return range(addDays(today, -90), today);
    case 'last120days': return range(addDays(today, -120), today);
    case 'last180days': return range(addDays(today, -180), today);

    // --- Past Calendar ---
    case 'thisWeek':    return range(startOfWeek(today), endOfWeek(today));
    case 'lastWeek': {
      const prevMon = addDays(startOfWeek(today), -7);
      return range(prevMon, addDays(prevMon, 6));
    }
    case 'thisMonth':   return range(startOfMonth(today), endOfMonth(today));
    case 'lastMonth': {
      const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return range(startOfMonth(prev), endOfMonth(prev));
    }
    case 'thisQuarter': return range(startOfQuarter(today), endOfQuarter(today));
    case 'lastQuarter': {
      const prev = new Date(today.getFullYear(), today.getMonth() - 3, 1);
      return range(startOfQuarter(prev), endOfQuarter(prev));
    }
    case 'thisYear':    return range(new Date(today.getFullYear(), 0, 1), new Date(today.getFullYear(), 11, 31));
    case 'lastYear':    return range(new Date(today.getFullYear() - 1, 0, 1), new Date(today.getFullYear() - 1, 11, 31));

    // --- Future Rolling ---
    case 'next7days':   return range(today, addDays(today, 7));
    case 'next14days':  return range(today, addDays(today, 14));
    case 'next30days':  return range(today, addDays(today, 30));
    case 'next45days':  return range(today, addDays(today, 45));
    case 'next60days':  return range(today, addDays(today, 60));
    case 'next90days':  return range(today, addDays(today, 90));
    case 'next120days': return range(today, addDays(today, 120));
    case 'next180days': return range(today, addDays(today, 180));

    // --- Future Calendar ---
    case 'nextWeek': {
      const nextMon = addDays(startOfWeek(today), 7);
      return range(nextMon, addDays(nextMon, 6));
    }
    case 'nextMonth': {
      const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      return range(startOfMonth(next), endOfMonth(next));
    }
    case 'nextQuarter': {
      const next = new Date(today.getFullYear(), today.getMonth() + 3, 1);
      return range(startOfQuarter(next), endOfQuarter(next));
    }

    // --- Custom ---
    case 'onDate': {
      const d = dateValue ? dateValue.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : undefined;
      if (!d) return { fragments: [] };
      return { fragments: [{ operator: '=', value: `[${d}]` }] };
    }
    case 'beforeDate': {
      const d = dateValue ? dateValue.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : undefined;
      if (!d) return { fragments: [] };
      return { fragments: [{ operator: '<', value: `[${d}]` }] };
    }
    case 'afterDate': {
      const d = dateValue ? dateValue.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : undefined;
      if (!d) return { fragments: [] };
      return { fragments: [{ operator: '>', value: `[${d}]` }] };
    }
    case 'customRange': {
      const s = dateRangeStart ? dateRangeStart.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : undefined;
      const e = dateRangeEnd ? dateRangeEnd.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] : undefined;
      if (!s || !e) return { fragments: [] };
      return { fragments: [{ operator: '>=', value: `[${s}]` }, { operator: '<=', value: `[${e}]` }] };
    }

    default:
      return { fragments: [] };
  }
}

// ---------------------------------------------------------------------------
// buildFiltersFromUi — builds a CPQ conditions string from the filter UI
// ---------------------------------------------------------------------------

/** Build a CPQ conditions string from the `filters` fixedCollection UI. */
export function buildFiltersFromUi(
  filters: {
    conditions?: Array<{
      field?: string;
      operator?: string;
      valueType?: string;
      value?: string;
      datePreset?: string;
      dateValue?: string;
      dateRangeStart?: string;
      dateRangeEnd?: string;
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

      const valueType = row.valueType ?? 'string';

      // --- Date preset path ---
      if (valueType === 'datetime' && row.datePreset) {
        const { fragments } = resolveDatePreset(
          row.datePreset,
          row.dateValue,
          row.dateRangeStart,
          row.dateRangeEnd,
        );
        if (fragments.length === 0) continue;

        if (fragments.length === 1) {
          parts.push(`${fieldName} ${fragments[0].operator} ${fragments[0].value}`);
        } else {
          // Multi-fragment (range) — group with AND; wrap in parens when OR combinator
          const rangeParts = fragments.map((f) => `${fieldName} ${f.operator} ${f.value}`);
          const rangeExpr = rangeParts.join(' AND ');
          parts.push(logic === 'or' ? `(${rangeExpr})` : rangeExpr);
        }
        continue;
      }

      // --- Legacy operator + value path (backward compat) ---
      const operator = (row.operator ?? '=').toLowerCase();
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