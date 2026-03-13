// ── CPQ-specific description builders ─────────────────────────────────────
// CPQ uses a raw `conditions` string for filtering (no search parameter).
// All descriptions reference conditions rather than a search field.

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

const WRITE_OPS = new Set(['create', 'update', 'delete', 'replace', 'copy', 'deleteVersion', 'closeAsLost', 'closeAsNoDecision', 'closeAsWon']);

function buildOperationLine(operation: string, resourceLabel: string, resource: string): string {
    switch (operation) {
        case 'get':
            return (
                `- get: Fetch a single ${resourceLabel} record by its internal system id (NOT the user-visible quote number). ` +
                `ONLY use when you already have the id from a prior getAll. ` +
                `If you know only the user-visible quote number, use getLatestVersion or getVersions instead.`
            );
        case 'getAll':
            return (
                `- getAll: List ${resourceLabel} records. ` +
                `Filter with 'conditions' (raw CPQ filter string) or omit to list all. ` +
                `Results include a numeric 'id' on each record — capture it for chained calls.`
            );
        case 'create':
            return `- create: Create a new ${resourceLabel} record. Provide all required fields as a JSON string. Confirm field values with user before executing when acting autonomously.`;
        case 'update':
            return (
                `- update: Update an existing ${resourceLabel} record by internal system id (NOT the user-visible quote number). ` +
                `PREREQUISITE: you need the system id — use getAll with conditions to find it. ` +
                `Provide updatePatch as JSON array: [{"field":"fieldName","value":"newValue"}]. ` +
                `Confirm field values with user before executing when acting autonomously.`
            );
        case 'delete':
            return (
                `- delete: Permanently delete a ${resourceLabel} record by ID. Irreversible. ` +
                `ONLY on explicit user intent. Do not infer from context. Confirm ID is correct before proceeding.`
            );
        case 'replace':
            return (
                `- replace: Replace a ${resourceLabel} record by ID (PUT semantics — provide all fields). ` +
                `PREREQUISITE: numeric ID from a prior getAll. ` +
                `Confirm field values with user before executing when acting autonomously.`
            );
        case 'copy':
            return (
                `- copy: Copy a ${resource} by its quoteId. ` +
                `Also copies all tabs, items, and customers. Returns the new record with its assigned ID.`
            );
        case 'getVersions':
            return `- getVersions: List all versions of a quote by user-visible quoteNumber (NOT the internal system id/quoteId).`;
        case 'getVersion':
            return `- getVersion: Get a specific quote version by user-visible quoteNumber and quoteVersion number.`;
        case 'getLatestVersion':
            return (
                `- getLatestVersion: Get a quote by its user-visible quoteNumber ` +
                `(the integer users see in CPQ, e.g. 1234 — NOT the internal system id). ` +
                `Use this when you know the quote number but not the system id.`
            );
        case 'deleteVersion':
            return `- deleteVersion: Delete a specific quote version by quoteNumber and quoteVersion. ONLY on explicit user intent. Do not infer from context. Confirm version is correct before proceeding.`;
        case 'getItems':
            return `- getItems: Get all quote items in a specific tab by tab ID.`;
        case 'closeAsLost':
            return (
                `- closeAsLost: Mark a quote as Lost by quoteId. ` +
                `Sets quoteStatus and wonOrLostDate in one operation (required by the API). ` +
                `Optionally provide lostReason and wonOrLostDate (defaults to now). ` +
                `Only works on quotes with the newer alphanumeric ID format — legacy UUID-format quotes cannot be modified via the API.`
            );
        case 'closeAsNoDecision':
            return (
                `- closeAsNoDecision: Mark a quote as No Decision by quoteId. ` +
                `Sets quoteStatus and wonOrLostDate in one operation (required by the API). ` +
                `Optionally provide wonOrLostDate (defaults to now). ` +
                `Only works on quotes with the newer alphanumeric ID format — legacy UUID-format quotes cannot be modified via the API.`
            );
        case 'closeAsWon':
            return (
                `- closeAsWon: Mark a quote as Won by quoteId. ` +
                `Sets quoteStatus and wonOrLostDate in one operation (required by the API). ` +
                `Optionally provide wonOrLostDate (defaults to now). ` +
                `Only works on quotes with the newer alphanumeric ID format — legacy UUID-format quotes cannot be modified via the API.`
            );
        default:
            return `- ${operation}: Operation available for this ${resourceLabel}.`;
    }
}

export function buildUnifiedDescription(
    resourceLabel: string,
    resource: string,
    operations: string[],
    referenceUtc: string,
): string {
    const enabledOps = Array.from(new Set(operations));
    const hasWrite = enabledOps.some((op) => WRITE_OPS.has(op));
    const hasPatch = enabledOps.includes('update');

    const operationLines = enabledOps.map((op) =>
        buildOperationLine(op, resourceLabel, resource),
    );

    const lines: string[] = [
        `Reference: current UTC when these tools were loaded is ${referenceUtc}. Manage ${resourceLabel} records in ConnectWise CPQ.`,
        `Pass one of the following values in the required "operation" field:`,
        ...operationLines,
        `Prefer running getAll first to discover numeric IDs before get, update, delete, replace, or copy.`,
        `CPQ conditions syntax: field = "value" (strings double-quoted), booleans as True/False, dates as [YYYY-MM-DD]. Multiple conditions joined with AND/OR.`,
    ];

    if (hasPatch) {
        lines.push(
            `updatePatch format: [{"field":"fieldName","value":"newValue"}]. ` +
                `Use exact field names as returned by the API.`,
        );
    }

    if (hasWrite) {
        lines.push(
            `Write operations (${enabledOps.filter((op) => WRITE_OPS.has(op)).join(', ')}) are enabled. Confirm IDs before mutating data.`,
        );
    }

    return lines
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

export { OPERATION_LABELS };
