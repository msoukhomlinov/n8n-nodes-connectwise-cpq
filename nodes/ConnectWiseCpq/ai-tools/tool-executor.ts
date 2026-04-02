import type { IDataObject, IExecuteFunctions, ISupplyDataFunctions } from 'n8n-workflow';
import {
    cpqApiRequest,
    cpqApiRequestAllItems,
    prepareJsonPatch,
    castUpdateValue,
} from '../GenericFunctions';
import {
    QUOTE_FIELD_TYPES,
    appendConditions,
} from '../resources/quotes.resource';
import { QUOTE_ITEM_FIELD_TYPES } from '../resources/quoteItems.resource';
import { CUSTOMER_FIELD_TYPES } from '../resources/quoteCustomers.resource';
import { QUOTE_TERM_FIELD_TYPES } from '../resources/quoteTerms.resource';
import { USER_FIELD_TYPES } from '../resources/user.resource';
import {
    wrapSuccess,
    wrapError,
    ERROR_TYPES,
    formatApiError,
    formatMissingIdError,
    formatNotFoundError,
    formatNoResultsFound,
} from './error-formatter';

// ── Metadata stripping ─────────────────────────────────────────────────────

const N8N_METADATA_FIELDS = new Set([
    'sessionId',
    'action',
    'chatInput',
    'root',       // n8n canvas root node UUID — causes API 400 if not stripped
    'tool',
    'toolName',
    'toolCallId',
    'operation',  // unified tool routing field — must not reach API
]);

// Agent Tool Node v3 (n8n ≥1.116) injects $fromAI()-generated keys with this prefix into item.json
const N8N_METADATA_PREFIXES = ['Prompt__'];

// ── Helpers ────────────────────────────────────────────────────────────────

function asCtx(context: ISupplyDataFunctions): IExecuteFunctions {
    return context as unknown as IExecuteFunctions;
}

function isMissing(result: unknown): boolean {
    return (
        result === null ||
        result === undefined ||
        (Array.isArray(result) && result.length === 0) ||
        (typeof result === 'object' &&
            !Array.isArray(result) &&
            Object.keys(result as Record<string, unknown>).length === 0)
    );
}

function buildPatch(
    ctx: IExecuteFunctions,
    updatePatch: string,
    fieldTypes: Record<string, string>,
): IDataObject[] {
    const node = ctx.getNode();
    const rows = JSON.parse(updatePatch) as Array<{ field: string; value: string }>;
    const ops = rows.map(({ field, value }) => ({
        op: 'replace' as const,
        path: `/${field}`,
        value: castUpdateValue(node, 0, value, fieldTypes[field] ?? 'string'),
    }));
    return prepareJsonPatch(ops);
}

async function getAllItems(
    ctx: IExecuteFunctions,
    endpoint: string,
    qs: IDataObject,
    limit: number,
): Promise<unknown[]> {
    return cpqApiRequestAllItems.call(
        ctx,
        '',
        'GET',
        endpoint,
        {},
        qs,
        {},
        limit,
        Math.min(limit, 1000),
    );
}

function getAllResult(
    resource: string,
    operation: string,
    records: unknown[],
    conditions: string | undefined,
    limit: number,
): string {
    const hasConditions = !!conditions;
    if (records.length === 0 && hasConditions) {
        return JSON.stringify(
            formatNoResultsFound(resource, operation, { conditions }),
        );
    }
    const result: Record<string, unknown> = { items: records, count: records.length };
    if (records.length >= limit) {
        result.truncated = true;
        result.note = `Results capped at ${limit}. Use conditions to narrow or increase 'limit' (max 1000).`;
    }
    return JSON.stringify(wrapSuccess(resource, operation, result));
}

// ── Per-resource executors ─────────────────────────────────────────────────

async function executeQuotes(
    ctx: IExecuteFunctions,
    operation: string,
    params: Record<string, unknown>,
): Promise<string> {
    const limit = typeof params.limit === 'number' ? params.limit : 25;
    const conditions = params.conditions as string | undefined;
    const includeFields = params.includeFields as string | undefined;
    const showAllVersions = params.showAllVersions as boolean | undefined;

    switch (operation) {
        case 'getAll': {
            const quoteStatus = (params.quoteStatus as string | undefined) ?? 'all';
            const expiredOnly = params.expiredOnly === true;

            const idFormat = (params.idFormat as string | undefined) ?? 'all';

            const extraParts: string[] = [];
            if (quoteStatus === 'allClosed') {
                extraParts.push('quoteStatus != "Active"');
            } else if (quoteStatus !== 'all') {
                const statusValueMap: Record<string, string> = {
                    active:     'Active',
                    archived:   'Archived',
                    deleted:    'Deleted',
                    lost:       'Lost',
                    noDecision: 'No Decision',
                    won:        'Won',
                };
                const apiValue = statusValueMap[quoteStatus];
                if (apiValue) extraParts.push(`quoteStatus = "${apiValue}"`);
            }
            if (expiredOnly) {
                const today = new Date().toISOString().split('T')[0];
                extraParts.push(`expirationDate < [${today}]`);
            }
            // Push ID format filter server-side so it applies before pagination.
            // New-format IDs start with 'q'; UUID IDs use hex chars (0-9, a-f) which sort before 'q'.
            if (idFormat === 'newOnly') {
                extraParts.push('id >= "q" AND id < "r"');
            } else if (idFormat === 'legacyOnly') {
                extraParts.push('id < "q"');
            }
            const finalConditions = appendConditions(conditions ?? '', extraParts.join(' AND '));

            const qs: IDataObject = {};
            if (finalConditions) qs.conditions = finalConditions;
            if (includeFields) qs.includeFields = includeFields;
            if (showAllVersions) qs.showAllVersions = showAllVersions;

            const records = await getAllItems(ctx, '/api/quotes', qs, limit);
            return getAllResult('quotes', operation, records, finalConditions, limit);
        }
        case 'get': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quotes', operation));
            const result = await cpqApiRequest.call(
                ctx, 'GET', `/api/quotes/${encodeURIComponent(quoteId)}`,
            );
            if (isMissing(result)) {
                return JSON.stringify(formatNotFoundError('quotes', operation, quoteId));
            }
            return JSON.stringify(wrapSuccess('quotes', operation, result));
        }
        case 'copy': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quotes', operation));
            const result = await cpqApiRequest.call(
                ctx, 'POST', `/api/quotes/copyById/${encodeURIComponent(quoteId)}`,
            );
            return JSON.stringify(wrapSuccess('quotes', operation, result));
        }
        case 'delete': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quotes', operation));
            await cpqApiRequest.call(ctx, 'DELETE', `/api/quotes/${encodeURIComponent(quoteId)}`);
            return JSON.stringify(wrapSuccess('quotes', operation, { quoteId, deleted: true }));
        }
        case 'update': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quotes', operation));
            const updatePatch = params.updatePatch as string | undefined;
            if (!updatePatch) return JSON.stringify(formatMissingIdError('quotes', 'update.updatePatch'));
            const patchBody = buildPatch(ctx, updatePatch, QUOTE_FIELD_TYPES);
            const result = await cpqApiRequest.call(
                ctx, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}`, patchBody,
            );
            return JSON.stringify(wrapSuccess('quotes', operation, result));
        }
        case 'closeAsLost':
        case 'closeAsNoDecision':
        case 'closeAsWon': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quotes', operation));
            const closeStatusMap: Record<string, string> = { closeAsLost: 'Lost', closeAsNoDecision: 'No Decision', closeAsWon: 'Won' };
            const status = closeStatusMap[operation];
            const wonOrLostDateRaw = params.wonOrLostDate as string | undefined;
            const closedDate = wonOrLostDateRaw ? new Date(wonOrLostDateRaw).toISOString() : new Date().toISOString();
            const ops: Array<{ op: 'replace'; path: string; value: unknown }> = [
                { op: 'replace', path: '/quoteStatus', value: status },
                { op: 'replace', path: '/wonOrLostDate', value: closedDate },
            ];
            if ((operation === 'closeAsLost' || operation === 'closeAsNoDecision') && params.lostReason) {
                ops.push({ op: 'replace', path: '/lostReason', value: params.lostReason as string });
            }
            if (operation === 'closeAsWon' && params.winForm) {
                ops.push({ op: 'replace', path: '/winForm', value: params.winForm as string });
            }
            const patchBody = prepareJsonPatch(ops);
            const result = await cpqApiRequest.call(
                ctx, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}`, patchBody,
            );
            return JSON.stringify(wrapSuccess('quotes', operation, result));
        }
        case 'getVersions': {
            const quoteNumber = params.quoteNumber as number | undefined;
            if (!quoteNumber) return JSON.stringify(formatMissingIdError('quotes', operation));
            const result = await cpqApiRequest.call(
                ctx, 'GET', `/api/quotes/${quoteNumber}/versions`,
            );
            const versions = Array.isArray(result) ? result : [];
            return JSON.stringify(wrapSuccess('quotes', operation, { items: versions, count: versions.length }));
        }
        case 'getVersion': {
            const quoteNumber = params.quoteNumber as number | undefined;
            const quoteVersion = params.quoteVersion as number | undefined;
            if (!quoteNumber) return JSON.stringify(formatMissingIdError('quotes', 'getVersion.quoteNumber'));
            if (!quoteVersion) return JSON.stringify(formatMissingIdError('quotes', 'getVersion.quoteVersion'));
            const result = await cpqApiRequest.call(
                ctx, 'GET', `/api/quotes/${quoteNumber}/versions/${quoteVersion}`,
            );
            if (isMissing(result)) {
                return JSON.stringify(
                    formatNotFoundError('quotes', operation, `${quoteNumber}/v${quoteVersion}`),
                );
            }
            return JSON.stringify(wrapSuccess('quotes', operation, result));
        }
        case 'getLatestVersion': {
            const quoteNumber = params.quoteNumber as number | undefined;
            if (!quoteNumber) return JSON.stringify(formatMissingIdError('quotes', operation));
            const result = await cpqApiRequest.call(
                ctx, 'GET', `/api/quotes/${quoteNumber}/versions/latest`,
            );
            if (isMissing(result)) {
                return JSON.stringify(
                    formatNotFoundError('quotes', operation, String(quoteNumber)),
                );
            }
            return JSON.stringify(wrapSuccess('quotes', operation, result));
        }
        case 'deleteVersion': {
            const quoteNumber = params.quoteNumber as number | undefined;
            const quoteVersion = params.quoteVersion as number | undefined;
            if (!quoteNumber) return JSON.stringify(formatMissingIdError('quotes', 'deleteVersion.quoteNumber'));
            if (!quoteVersion) return JSON.stringify(formatMissingIdError('quotes', 'deleteVersion.quoteVersion'));
            await cpqApiRequest.call(
                ctx, 'DELETE', `/api/quotes/${quoteNumber}/versions/${quoteVersion}`,
            );
            return JSON.stringify(wrapSuccess('quotes', operation, { quoteNumber, quoteVersion, deleted: true }));
        }
        default:
            return JSON.stringify(wrapError('quotes', operation, ERROR_TYPES.INVALID_OPERATION,
                `Unsupported operation: ${operation} for resource: quotes`,
                `Use one of the supported operations for connectwisecpq_quotes.`));
    }
}

async function executeQuoteItems(
    ctx: IExecuteFunctions,
    operation: string,
    params: Record<string, unknown>,
): Promise<string> {
    const limit = typeof params.limit === 'number' ? params.limit : 25;
    const conditions = params.conditions as string | undefined;

    switch (operation) {
        case 'getAll': {
            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (params.includeFields) qs.includeFields = params.includeFields as string;
            if (params.showAllVersions) qs.showAllVersions = params.showAllVersions as boolean;
            const records = await getAllItems(ctx, '/api/quoteItems', qs, limit);
            return getAllResult('quoteItems', operation, records, conditions, limit);
        }
        case 'get': {
            const id = params.id as string | undefined;
            if (!id) return JSON.stringify(formatMissingIdError('quoteItems', operation));
            const result = await cpqApiRequest.call(
                ctx, 'GET', `/api/quoteItems/${encodeURIComponent(id)}`,
            );
            if (isMissing(result)) {
                return JSON.stringify(formatNotFoundError('quoteItems', operation, id));
            }
            return JSON.stringify(wrapSuccess('quoteItems', operation, result));
        }
        case 'create': {
            const bodyJson = params.bodyJson as string | undefined;
            if (!bodyJson) {
                return JSON.stringify(wrapError('quoteItems', operation, ERROR_TYPES.MISSING_REQUIRED_FIELD,
                    'bodyJson is required for quoteItems.create.',
                    'Provide bodyJson as a JSON object string with all required QuoteItemView fields.'));
            }
            const body = JSON.parse(bodyJson) as IDataObject;
            const result = await cpqApiRequest.call(ctx, 'POST', '/api/quoteItems', body);
            return JSON.stringify(wrapSuccess('quoteItems', operation, result));
        }
        case 'delete': {
            const id = params.id as string | undefined;
            if (!id) return JSON.stringify(formatMissingIdError('quoteItems', operation));
            await cpqApiRequest.call(ctx, 'DELETE', `/api/quoteItems/${encodeURIComponent(id)}`);
            return JSON.stringify(wrapSuccess('quoteItems', operation, { id, deleted: true }));
        }
        case 'update': {
            const id = params.id as string | undefined;
            if (!id) return JSON.stringify(formatMissingIdError('quoteItems', operation));
            const updatePatch = params.updatePatch as string | undefined;
            if (!updatePatch) return JSON.stringify(formatMissingIdError('quoteItems', 'update.updatePatch'));
            const patchBody = buildPatch(ctx, updatePatch, QUOTE_ITEM_FIELD_TYPES);
            const result = await cpqApiRequest.call(
                ctx, 'PATCH', `/api/quoteItems/${encodeURIComponent(id)}`, patchBody,
            );
            return JSON.stringify(wrapSuccess('quoteItems', operation, result));
        }
        default:
            return JSON.stringify(wrapError('quoteItems', operation, ERROR_TYPES.INVALID_OPERATION,
                `Unsupported operation: ${operation} for resource: quoteItems`,
                `Use one of the supported operations for connectwisecpq_quoteItems.`));
    }
}

async function executeQuoteCustomers(
    ctx: IExecuteFunctions,
    operation: string,
    params: Record<string, unknown>,
): Promise<string> {
    const limit = typeof params.limit === 'number' ? params.limit : 25;
    const conditions = params.conditions as string | undefined;

    switch (operation) {
        case 'getAll': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteCustomers', 'getAll.quoteId'));
            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (params.includeFields) qs.includeFields = params.includeFields as string;
            const endpoint = `/api/quotes/${encodeURIComponent(quoteId)}/customers`;
            const records = await getAllItems(ctx, endpoint, qs, limit);
            return getAllResult('quoteCustomers', operation, records, conditions, limit);
        }
        case 'delete': {
            const quoteId = params.quoteId as string | undefined;
            const id = params.id as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteCustomers', 'delete.quoteId'));
            if (!id) return JSON.stringify(formatMissingIdError('quoteCustomers', operation));
            await cpqApiRequest.call(
                ctx, 'DELETE',
                `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`,
            );
            return JSON.stringify(wrapSuccess('quoteCustomers', operation, { id, deleted: true }));
        }
        case 'replace': {
            const quoteId = params.quoteId as string | undefined;
            const id = params.id as string | undefined;
            const customerJson = params.customerJson as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteCustomers', 'replace.quoteId'));
            if (!id) return JSON.stringify(formatMissingIdError('quoteCustomers', operation));
            const body = customerJson ? (JSON.parse(customerJson) as IDataObject) : {};
            const result = await cpqApiRequest.call(
                ctx, 'PUT',
                `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`,
                body,
            );
            return JSON.stringify(wrapSuccess('quoteCustomers', operation, result));
        }
        case 'update': {
            const quoteId = params.quoteId as string | undefined;
            const id = params.id as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteCustomers', 'update.quoteId'));
            if (!id) return JSON.stringify(formatMissingIdError('quoteCustomers', operation));
            const updatePatch = params.updatePatch as string | undefined;
            if (!updatePatch) return JSON.stringify(formatMissingIdError('quoteCustomers', 'update.updatePatch'));
            const patchBody = buildPatch(ctx, updatePatch, CUSTOMER_FIELD_TYPES);
            const result = await cpqApiRequest.call(
                ctx, 'PATCH',
                `/api/quotes/${encodeURIComponent(quoteId)}/customers/${encodeURIComponent(id)}`,
                patchBody,
            );
            return JSON.stringify(wrapSuccess('quoteCustomers', operation, result));
        }
        default:
            return JSON.stringify(wrapError('quoteCustomers', operation, ERROR_TYPES.INVALID_OPERATION,
                `Unsupported operation: ${operation} for resource: quoteCustomers`,
                `Use one of the supported operations for connectwisecpq_quoteCustomers.`));
    }
}

async function executeQuoteTabs(
    ctx: IExecuteFunctions,
    operation: string,
    params: Record<string, unknown>,
): Promise<string> {
    const limit = typeof params.limit === 'number' ? params.limit : 25;
    const conditions = params.conditions as string | undefined;

    switch (operation) {
        case 'getAll': {
            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (params.includeFields) qs.includeFields = params.includeFields as string;
            if (params.showAllVersions) qs.showAllVersions = params.showAllVersions as boolean;
            const records = await getAllItems(ctx, '/api/quoteTabs', qs, limit);
            return getAllResult('quoteTabs', operation, records, conditions, limit);
        }
        case 'getItems': {
            const id = params.id as string | undefined;
            if (!id) return JSON.stringify(formatMissingIdError('quoteTabs', operation));
            const records = await getAllItems(
                ctx,
                `/api/quoteTabs/${encodeURIComponent(id)}/quoteItems`,
                {},
                limit,
            );
            return JSON.stringify(wrapSuccess('quoteTabs', operation, { items: records, count: records.length }));
        }
        default:
            return JSON.stringify(wrapError('quoteTabs', operation, ERROR_TYPES.INVALID_OPERATION,
                `Unsupported operation: ${operation} for resource: quoteTabs`,
                `Use one of the supported operations for connectwisecpq_quoteTabs.`));
    }
}

async function executeQuoteTerms(
    ctx: IExecuteFunctions,
    operation: string,
    params: Record<string, unknown>,
): Promise<string> {
    const limit = typeof params.limit === 'number' ? params.limit : 25;
    const conditions = params.conditions as string | undefined;

    switch (operation) {
        case 'getAll': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteTerms', 'getAll.quoteId'));
            const qs: IDataObject = {};
            if (conditions) qs.conditions = conditions;
            if (params.includeFields) qs.includeFields = params.includeFields as string;
            const endpoint = `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`;
            const records = await getAllItems(ctx, endpoint, qs, limit);
            return getAllResult('quoteTerms', operation, records, conditions, limit);
        }
        case 'create': {
            const quoteId = params.quoteId as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteTerms', 'create.quoteId'));
            const termJson = params.termJson as string | undefined;
            if (!termJson) {
                return JSON.stringify(wrapError('quoteTerms', operation, ERROR_TYPES.MISSING_REQUIRED_FIELD,
                    'termJson is required for quoteTerms.create.',
                    'Provide termJson as a JSON object string with all required QuoteTermView fields.'));
            }
            const body = JSON.parse(termJson) as IDataObject;
            const result = await cpqApiRequest.call(
                ctx, 'POST',
                `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms`,
                body,
            );
            return JSON.stringify(wrapSuccess('quoteTerms', operation, result));
        }
        case 'delete': {
            const quoteId = params.quoteId as string | undefined;
            const id = params.id as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteTerms', 'delete.quoteId'));
            if (!id) return JSON.stringify(formatMissingIdError('quoteTerms', operation));
            await cpqApiRequest.call(
                ctx, 'DELETE',
                `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`,
            );
            return JSON.stringify(wrapSuccess('quoteTerms', operation, { id, deleted: true }));
        }
        case 'update': {
            const quoteId = params.quoteId as string | undefined;
            const id = params.id as string | undefined;
            if (!quoteId) return JSON.stringify(formatMissingIdError('quoteTerms', 'update.quoteId'));
            if (!id) return JSON.stringify(formatMissingIdError('quoteTerms', operation));
            const updatePatch = params.updatePatch as string | undefined;
            if (!updatePatch) return JSON.stringify(formatMissingIdError('quoteTerms', 'update.updatePatch'));
            const patchBody = buildPatch(ctx, updatePatch, QUOTE_TERM_FIELD_TYPES);
            const result = await cpqApiRequest.call(
                ctx, 'PATCH',
                `/api/quotes/${encodeURIComponent(quoteId)}/quoteTerms/${encodeURIComponent(id)}`,
                patchBody,
            );
            return JSON.stringify(wrapSuccess('quoteTerms', operation, result));
        }
        default:
            return JSON.stringify(wrapError('quoteTerms', operation, ERROR_TYPES.INVALID_OPERATION,
                `Unsupported operation: ${operation} for resource: quoteTerms`,
                `Use one of the supported operations for connectwisecpq_quoteTerms.`));
    }
}

async function executeSimpleGetAll(
    ctx: IExecuteFunctions,
    resource: string,
    endpoint: string,
    operation: string,
    params: Record<string, unknown>,
): Promise<string> {
    const limit = typeof params.limit === 'number' ? params.limit : 25;
    const conditions = params.conditions as string | undefined;
    const qs: IDataObject = {};
    if (conditions) qs.conditions = conditions;
    if (params.includeFields) qs.includeFields = params.includeFields as string;
    const records = await getAllItems(ctx, endpoint, qs, limit);
    return getAllResult(resource, operation, records, conditions, limit);
}

async function executeUserResource(
    ctx: IExecuteFunctions,
    operation: string,
    params: Record<string, unknown>,
): Promise<string> {
    switch (operation) {
        case 'getAll':
            return executeSimpleGetAll(ctx, 'user', '/settings/user', operation, params);
        case 'update': {
            const userId = params.userId as string | undefined;
            if (!userId) return JSON.stringify(formatMissingIdError('user', operation));
            const updatePatch = params.updatePatch as string | undefined;
            if (!updatePatch) return JSON.stringify(formatMissingIdError('user', 'update.updatePatch'));
            const patchBody = buildPatch(ctx, updatePatch, USER_FIELD_TYPES);
            const result = await cpqApiRequest.call(
                ctx, 'PATCH', `/settings/user/${encodeURIComponent(userId)}`, patchBody,
            );
            return JSON.stringify(wrapSuccess('user', operation, result));
        }
        default:
            return JSON.stringify(wrapError('user', operation, ERROR_TYPES.INVALID_OPERATION,
                `Unsupported operation: ${operation} for resource: user`,
                `Use one of the supported operations for connectwisecpq_user.`));
    }
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function executeAiTool(
    context: ISupplyDataFunctions,
    resource: string,
    operation: string,
    rawParams: Record<string, unknown>,
): Promise<string> {
    // Strip n8n framework metadata at entry (covers all code paths)
    const params: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawParams)) {
        if (N8N_METADATA_FIELDS.has(key)) continue;
        if (N8N_METADATA_PREFIXES.some((p) => key.startsWith(p))) continue;
        params[key] = value;
    }

    // Coerce numeric strings to numbers (LLMs occasionally pass "25" instead of 25)
    for (const key of ['limit', 'quoteNumber', 'quoteVersion']) {
        if (key in params && typeof params[key] === 'string' && /^\d+$/.test(params[key] as string)) {
            params[key] = parseInt(params[key] as string, 10);
        }
    }

    const ctx = asCtx(context);

    try {
        switch (resource) {
            case 'quotes':
                return await executeQuotes(ctx, operation, params);
            case 'quoteItems':
                return await executeQuoteItems(ctx, operation, params);
            case 'quoteCustomers':
                return await executeQuoteCustomers(ctx, operation, params);
            case 'quoteTabs':
                return await executeQuoteTabs(ctx, operation, params);
            case 'quoteTerms':
                return await executeQuoteTerms(ctx, operation, params);
            case 'recurringRevenue':
                return await executeSimpleGetAll(ctx, resource, '/api/recurringRevenues', operation, params);
            case 'taxCodes':
                return await executeSimpleGetAll(ctx, resource, '/api/taxCodes', operation, params);
            case 'templates':
                return await executeSimpleGetAll(ctx, resource, '/api/templates', operation, params);
            case 'user':
                return await executeUserResource(ctx, operation, params);
            default:
                return JSON.stringify(wrapError(resource, operation, ERROR_TYPES.INVALID_OPERATION,
                    `Unknown resource: ${resource}`,
                    'Check available resources and retry.'));
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return JSON.stringify(formatApiError(msg, resource, operation));
    }
}
