export interface StructuredToolError {
    error: true;
    errorType: string;
    message: string;
    operation: string;
    nextAction: string;
    context?: Record<string, unknown>;
}

function buildOperation(resource: string, operation: string): string {
    return `${resource}.${operation}`;
}

export function formatApiError(
    message: string,
    resource: string,
    operation: string,
): StructuredToolError {
    const lower = message.toLowerCase();

    if (lower.includes('forbidden') || lower.includes('unauthor') || lower.includes('permission')) {
        return {
            error: true, errorType: 'PERMISSION_DENIED', message,
            operation: buildOperation(resource, operation),
            nextAction: 'Verify API credentials and permissions, then retry.',
        };
    }
    if (lower.includes('not found') || lower.includes('does not exist') || lower.includes('404')) {
        return {
            error: true, errorType: 'ENTITY_NOT_FOUND', message,
            operation: buildOperation(resource, operation),
            nextAction: `Call connectwisecpq_${resource} with operation 'getAll' and the 'conditions' parameter to find the record, extract its id, then retry.`,
        };
    }
    if (lower.includes('required') || lower.includes('missing') || lower.includes('blank')) {
        return {
            error: true, errorType: 'MISSING_REQUIRED_FIELDS', message,
            operation: buildOperation(resource, operation),
            nextAction: 'Check required fields for this resource and retry with all required parameters.',
        };
    }
    if (lower.includes('validation') || lower.includes('invalid') || lower.includes('unprocessable')) {
        return {
            error: true, errorType: 'VALIDATION_ERROR', message,
            operation: buildOperation(resource, operation),
            nextAction: 'Check the field values and types, then retry with corrected parameters.',
        };
    }

    return {
        error: true, errorType: 'API_ERROR', message,
        operation: buildOperation(resource, operation),
        nextAction: 'Verify parameter names and values, then retry.',
    };
}

export function formatMissingIdError(resource: string, operation: string): StructuredToolError {
    return {
        error: true, errorType: 'MISSING_ENTITY_ID',
        message: `A required ID parameter is missing for ${buildOperation(resource, operation)}.`,
        operation: buildOperation(resource, operation),
        nextAction: `Provide the required ID. If you only have a name or description, call connectwisecpq_${resource} with operation 'getAll' and the 'conditions' parameter to find the record and get its id first.`,
    };
}

export function formatNotFoundError(
    resource: string,
    operation: string,
    id: string | number,
): StructuredToolError {
    return {
        error: true, errorType: 'ENTITY_NOT_FOUND',
        message: `No ${resource} record found with ID ${id}.`,
        operation: buildOperation(resource, operation),
        nextAction: `Call connectwisecpq_${resource} with operation 'getAll' and the 'conditions' parameter to find the record, then use the id from the results.`,
    };
}

export function formatNoResultsFound(
    resource: string,
    operation: string,
    filters: Record<string, unknown>,
): StructuredToolError {
    return {
        error: true, errorType: 'NO_RESULTS_FOUND',
        message: `No ${resource} records matched the provided filters.`,
        operation: buildOperation(resource, operation),
        nextAction: 'Broaden your conditions filter, check for typos, or verify the record exists.',
        context: { filtersUsed: filters },
    };
}
