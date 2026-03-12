import { z } from 'zod';
import type { RuntimeZod } from './runtime';

// NOTE: z is a compile-time VALUE import — needed for z.object(), z.string() etc. at build time.
// Only runtime classes (DynamicStructuredTool, ZodType) come from runtime.ts.

// ── Common field descriptions ──────────────────────────────────────────────

const CONDITIONS_DESC =
    'Raw CPQ filter string, e.g. `name = "Acme" and closedFlag = True`. ' +
    'Strings in double-quotes, booleans as True/False, dates as [YYYY-MM-DD]. ' +
    'Omit to return all records.';

const INCLUDE_FIELDS_DESC =
    'Comma-separated field names to include in the response. Omit to return all fields.';

const LIMIT_DESC =
    'Maximum records to return (default 25, max 1000). Increase if you expect many matching records.';

const SHOW_ALL_VERSIONS_DESC =
    'If true, returns all quote versions. If false (default), returns only the latest version per quote.';

const QUOTE_STATUS_DESC =
    'Filter by quote lifecycle status. ' +
    'Values: all (default, no filter), active (open/in-play quotes), ' +
    'allClosed (any non-Active status), won, lost, noDecision, archived, deleted.';

const ID_FORMAT_DESC =
    'Filter results by quote ID format. ' +
    'newOnly returns only API-writable quotes (alphanumeric IDs, e.g. q639088936162812241alWXeGX). ' +
    'legacyOnly returns only legacy UUID-format quotes that cannot be modified via the API. ' +
    'Omit or use "all" to return all quotes.';

const EXPIRED_ONLY_DESC =
    'If true, only returns quotes whose expirationDate is in the past. ' +
    'Most useful with quoteStatus=active. Default false.';

const QUOTE_ID_DESC =
    'Internal system ID of the quote (the id field from a prior getAll result). ' +
    'This is NOT the user-visible quote number — use quoteNumber for version operations.';

const ID_DESC = 'Numeric record ID (from a prior getAll result).';

const QUOTE_NUMBER_DESC =
    'User-visible quote number (the quoteNumber integer field users see in CPQ, e.g. 1234). ' +
    'This is NOT the internal system id — use quoteId for get/update/delete/copy operations.';

const QUOTE_VERSION_DESC =
    'Quote version number (positive integer). Required for getVersion and deleteVersion.';

const UPDATE_PATCH_DESC =
    'JSON array of field updates: `[{"field":"fieldName","value":"newValue"}]`. ' +
    'Use exact field names as returned by the API.';

// ── Per-operation schema functions ─────────────────────────────────────────

function quotesGetAllSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        conditions: z.string().optional().describe(CONDITIONS_DESC),
        includeFields: z.string().optional().describe(INCLUDE_FIELDS_DESC),
        showAllVersions: z.boolean().optional().describe(SHOW_ALL_VERSIONS_DESC),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
        quoteStatus: z.enum(['all', 'active', 'allClosed', 'won', 'lost', 'noDecision', 'archived', 'deleted'])
            .optional().describe(QUOTE_STATUS_DESC),
        expiredOnly: z.boolean().optional().describe(EXPIRED_ONLY_DESC),
        idFormat: z.enum(['all', 'newOnly', 'legacyOnly']).optional().describe(ID_FORMAT_DESC),
    });
}

function quotesGetSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
    });
}

function quotesCopySchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z
            .string()
            .optional()
            .describe(QUOTE_ID_DESC + ' Copies the quote including all tabs, items, and customers.'),
    });
}

function quotesDeleteSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
    });
}

function quotesUpdateSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        updatePatch: z.string().optional().describe(UPDATE_PATCH_DESC),
    });
}

function quotesGetVersionsSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteNumber: z.number().int().optional().describe(QUOTE_NUMBER_DESC),
    });
}

function quotesGetVersionSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteNumber: z.number().int().optional().describe(QUOTE_NUMBER_DESC),
        quoteVersion: z.number().int().optional().describe(QUOTE_VERSION_DESC),
    });
}

function quotesGetLatestVersionSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteNumber: z.number().int().optional().describe(QUOTE_NUMBER_DESC),
    });
}

function quotesDeleteVersionSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteNumber: z.number().int().optional().describe(QUOTE_NUMBER_DESC),
        quoteVersion: z.number().int().optional().describe(QUOTE_VERSION_DESC),
    });
}

function quotesCloseAsLostSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        lostReason: z.string().optional().describe('Optional reason the quote was lost.'),
        wonOrLostDate: z.string().optional().describe('ISO datetime for when the quote was closed. Defaults to now if omitted.'),
    });
}

function quotesCloseAsWonSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        winForm: z.string().optional().describe('Optional reason the quote was won.'),
        wonOrLostDate: z.string().optional().describe('ISO datetime for when the quote was closed. Defaults to now if omitted.'),
    });
}

function quotesCloseAsNoDecisionSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        lostReason: z.string().optional().describe('Optional reason the quote resulted in no decision.'),
        wonOrLostDate: z.string().optional().describe('ISO datetime for when the quote was closed. Defaults to now if omitted.'),
    });
}

function quoteItemsGetAllSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        conditions: z.string().optional().describe(CONDITIONS_DESC),
        includeFields: z.string().optional().describe(INCLUDE_FIELDS_DESC),
        showAllVersions: z.boolean().optional().describe(SHOW_ALL_VERSIONS_DESC),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
    });
}

function quoteItemsGetSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        id: z.string().optional().describe(ID_DESC),
    });
}

function quoteItemsCreateSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        bodyJson: z
            .string()
            .optional()
            .describe('JSON object for the QuoteItemView (POST body). Provide all required fields.'),
    });
}

function quoteItemsDeleteSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        id: z.string().optional().describe(ID_DESC),
    });
}

function quoteItemsUpdateSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        id: z.string().optional().describe(ID_DESC),
        updatePatch: z.string().optional().describe(UPDATE_PATCH_DESC),
    });
}

function quoteCustomersGetAllSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        conditions: z.string().optional().describe(CONDITIONS_DESC),
        includeFields: z.string().optional().describe(INCLUDE_FIELDS_DESC),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
    });
}

function quoteCustomersDeleteSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        id: z.string().optional().describe(ID_DESC),
    });
}

function quoteCustomersReplaceSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        id: z.string().optional().describe(ID_DESC),
        customerJson: z
            .string()
            .optional()
            .describe('JSON object for the CustomerView (PUT body). Provide all customer fields.'),
    });
}

function quoteCustomersUpdateSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        id: z.string().optional().describe(ID_DESC),
        updatePatch: z.string().optional().describe(UPDATE_PATCH_DESC),
    });
}

function quoteTabsGetAllSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        conditions: z.string().optional().describe(CONDITIONS_DESC),
        includeFields: z.string().optional().describe(INCLUDE_FIELDS_DESC),
        showAllVersions: z.boolean().optional().describe(SHOW_ALL_VERSIONS_DESC),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
    });
}

function quoteTabsGetItemsSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        id: z
            .string()
            .optional()
            .describe(
                'Numeric Quote Tab ID (from a prior getAll result). Returns all items in this tab.',
            ),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
    });
}

function quoteTermsGetAllSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        conditions: z.string().optional().describe(CONDITIONS_DESC),
        includeFields: z.string().optional().describe(INCLUDE_FIELDS_DESC),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
    });
}

function quoteTermsCreateSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        termJson: z
            .string()
            .optional()
            .describe('JSON object for the QuoteTermView (POST body). Provide all required fields.'),
    });
}

function quoteTermsDeleteSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        id: z.string().optional().describe(ID_DESC),
    });
}

function quoteTermsUpdateSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        quoteId: z.string().optional().describe(QUOTE_ID_DESC),
        id: z.string().optional().describe(ID_DESC),
        updatePatch: z.string().optional().describe(UPDATE_PATCH_DESC),
    });
}

function simpleGetAllSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        conditions: z.string().optional().describe(CONDITIONS_DESC),
        includeFields: z.string().optional().describe(INCLUDE_FIELDS_DESC),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
    });
}

function userGetAllSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        conditions: z.string().optional().describe(CONDITIONS_DESC),
        includeFields: z.string().optional().describe(INCLUDE_FIELDS_DESC),
        limit: z.number().int().min(1).max(1000).optional().describe(LIMIT_DESC),
    });
}

function userUpdateSchema(): z.ZodObject<z.ZodRawShape> {
    return z.object({
        userId: z
            .string()
            .optional()
            .describe('Numeric user ID (from a prior getAll result). Required for user update.'),
        updatePatch: z.string().optional().describe(UPDATE_PATCH_DESC),
    });
}

// ── Operation label map ────────────────────────────────────────────────────

const OPERATION_LABELS: Record<string, string> = {
    get: 'Get by ID',
    getAll: 'Get many (with filters)',
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    replace: 'Replace',
    copy: 'Copy',
    getVersions: 'Get versions',
    getVersion: 'Get version',
    getLatestVersion: 'Get by quote number',
    deleteVersion: 'Delete version',
    getItems: 'Get items by tab',
    closeAsLost: 'Close as lost',
    closeAsNoDecision: 'Close as no decision',
    closeAsWon: 'Close as won',
};

function isValidOperation(op: string): boolean {
    return op in OPERATION_LABELS;
}

function getSchemaForOperation(
    resource: string,
    operation: string,
): z.ZodObject<z.ZodRawShape> {
    switch (resource) {
        case 'quotes':
            switch (operation) {
                case 'getAll':            return quotesGetAllSchema();
                case 'get':              return quotesGetSchema();
                case 'copy':             return quotesCopySchema();
                case 'delete':           return quotesDeleteSchema();
                case 'update':           return quotesUpdateSchema();
                case 'getVersions':      return quotesGetVersionsSchema();
                case 'getVersion':       return quotesGetVersionSchema();
                case 'getLatestVersion': return quotesGetLatestVersionSchema();
                case 'deleteVersion':    return quotesDeleteVersionSchema();
                case 'closeAsLost':       return quotesCloseAsLostSchema();
                case 'closeAsNoDecision': return quotesCloseAsNoDecisionSchema();
                case 'closeAsWon':        return quotesCloseAsWonSchema();
                default:                 return z.object({});
            }
        case 'quoteItems':
            switch (operation) {
                case 'getAll':  return quoteItemsGetAllSchema();
                case 'get':     return quoteItemsGetSchema();
                case 'create':  return quoteItemsCreateSchema();
                case 'delete':  return quoteItemsDeleteSchema();
                case 'update':  return quoteItemsUpdateSchema();
                default:        return z.object({});
            }
        case 'quoteCustomers':
            switch (operation) {
                case 'getAll':   return quoteCustomersGetAllSchema();
                case 'delete':   return quoteCustomersDeleteSchema();
                case 'replace':  return quoteCustomersReplaceSchema();
                case 'update':   return quoteCustomersUpdateSchema();
                default:         return z.object({});
            }
        case 'quoteTabs':
            switch (operation) {
                case 'getAll':    return quoteTabsGetAllSchema();
                case 'getItems':  return quoteTabsGetItemsSchema();
                default:          return z.object({});
            }
        case 'quoteTerms':
            switch (operation) {
                case 'getAll':  return quoteTermsGetAllSchema();
                case 'create':  return quoteTermsCreateSchema();
                case 'delete':  return quoteTermsDeleteSchema();
                case 'update':  return quoteTermsUpdateSchema();
                default:        return z.object({});
            }
        case 'recurringRevenue':
        case 'taxCodes':
        case 'templates':
            if (operation === 'getAll') return simpleGetAllSchema();
            return z.object({});
        case 'user':
            switch (operation) {
                case 'getAll':  return userGetAllSchema();
                case 'update':  return userUpdateSchema();
                default:        return z.object({});
            }
        default:
            return z.object({});
    }
}

// ── buildUnifiedSchema ─────────────────────────────────────────────────────

export function buildUnifiedSchema(
    resource: string,
    operations: string[],
): z.ZodObject<z.ZodRawShape> {
    const enabledOps = Array.from(new Set(operations.filter(isValidOperation)));

    if (enabledOps.length === 0) {
        return z.object({ operation: z.string().describe('Operation to perform') });
    }

    const operationEnum = z
        .enum(enabledOps as [string, ...string[]])
        .describe(`Operation to perform. Allowed values: ${enabledOps.join(', ')}.`);

    const fieldSources = new Map<string, z.ZodTypeAny>();
    const fieldOps = new Map<string, Set<string>>();

    for (const operation of enabledOps) {
        const schema = getSchemaForOperation(resource, operation);
        for (const [field, fieldSchema] of Object.entries(schema.shape)) {
            if (!fieldSources.has(field)) fieldSources.set(field, fieldSchema as z.ZodTypeAny);
            if (!fieldOps.has(field)) fieldOps.set(field, new Set<string>());
            fieldOps.get(field)?.add(operation);
        }
    }

    const mergedShape: Record<string, z.ZodTypeAny> = { operation: operationEnum };

    for (const [field, fieldSchema] of fieldSources.entries()) {
        const opsForField = Array.from(fieldOps.get(field) ?? []);
        const baseDescription = fieldSchema.description ?? '';
        const opsDescription = `Used by operations: ${opsForField.map((op) => OPERATION_LABELS[op] ?? op).join(', ')}.`;
        const description = baseDescription ? `${baseDescription} ${opsDescription}` : opsDescription;
        mergedShape[field] = fieldSchema.optional().describe(description);
    }

    return z.object(mergedShape);
}

// ── Runtime Zod conversion ─────────────────────────────────────────────────

function toRuntimeZodSchema(schema: unknown, runtimeZ: RuntimeZod): unknown {
    const def = (schema as any)?._def as Record<string, unknown> | undefined;
    const typeName = def?.typeName as string | undefined;
    let converted: unknown;

    switch (typeName) {
        case 'ZodString': {
            let s = runtimeZ.string();
            for (const check of (def?.checks as any[]) ?? []) {
                switch (check.kind) {
                    case 'min': s = s.min(check.value as number); break;
                    case 'max': s = s.max(check.value as number); break;
                    case 'email': s = s.email(); break;
                    case 'url': s = s.url(); break;
                    case 'uuid': s = s.uuid(); break;
                    default: break;
                }
            }
            converted = s;
            break;
        }
        case 'ZodNumber': {
            let n = runtimeZ.number();
            for (const check of (def?.checks as any[]) ?? []) {
                switch (check.kind) {
                    case 'int':  n = n.int(); break;
                    case 'min':  n = (check.inclusive === false) ? n.gt(check.value as number) : n.min(check.value as number); break;
                    case 'max':  n = (check.inclusive === false) ? n.lt(check.value as number) : n.max(check.value as number); break;
                    default: break;
                }
            }
            converted = n;
            break;
        }
        case 'ZodBoolean':  converted = runtimeZ.boolean(); break;
        case 'ZodUnknown':  converted = runtimeZ.unknown(); break;
        case 'ZodArray':    converted = runtimeZ.array(toRuntimeZodSchema(def?.type, runtimeZ) as any); break;
        case 'ZodEnum':     converted = runtimeZ.enum(def?.values as [string, ...string[]]); break;
        case 'ZodRecord':   converted = runtimeZ.record(toRuntimeZodSchema(def?.valueType, runtimeZ) as any); break;
        case 'ZodObject': {
            const shape = typeof def?.shape === 'function'
                ? (def.shape as () => Record<string, unknown>)()
                : (def?.shape as Record<string, unknown> | undefined) ?? {};
            const runtimeShape: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(shape)) {
                runtimeShape[key] = toRuntimeZodSchema(value, runtimeZ);
            }
            let obj: any = runtimeZ.object(runtimeShape as any);
            if (def?.unknownKeys === 'passthrough') obj = obj.passthrough();
            if (def?.unknownKeys === 'strict') obj = obj.strict();
            converted = obj;
            break;
        }
        case 'ZodOptional':  converted = (toRuntimeZodSchema(def?.innerType, runtimeZ) as any).optional(); break;
        case 'ZodNullable':  converted = (toRuntimeZodSchema(def?.innerType, runtimeZ) as any).nullable(); break;
        case 'ZodDefault': {
            const defaultVal = typeof def?.defaultValue === 'function'
                ? (def.defaultValue as () => unknown)()
                : def?.defaultValue;
            converted = (toRuntimeZodSchema(def?.innerType, runtimeZ) as any).default(defaultVal);
            break;
        }
        case 'ZodLiteral':   converted = runtimeZ.literal(def?.value as any); break;
        case 'ZodUnion':     converted = runtimeZ.union(((def?.options as unknown[]) ?? []).map((o) => toRuntimeZodSchema(o, runtimeZ)) as any); break;
        default:             converted = runtimeZ.unknown(); break;
    }

    const description = typeof (schema as any)?.description === 'string'
        ? (schema as any).description as string
        : undefined;
    if (description && typeof (converted as any).describe === 'function') {
        return (converted as any).describe(description);
    }
    return converted;
}

function withRuntimeZod<T>(schemaBuilder: () => T, runtimeZ: RuntimeZod): T {
    return toRuntimeZodSchema(schemaBuilder(), runtimeZ) as T;
}

export function getRuntimeSchemaBuilders(runtimeZ: RuntimeZod) {
    return {
        buildUnifiedSchema: (resource: string, operations: string[]) =>
            withRuntimeZod(() => buildUnifiedSchema(resource, operations), runtimeZ),
    };
}
