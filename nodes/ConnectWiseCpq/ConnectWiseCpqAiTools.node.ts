import { NodeOperationError } from 'n8n-workflow';
import type {
    IDataObject,
    IExecuteFunctions,
    ILoadOptionsFunctions,
    INodeExecutionData,
    INodePropertyOptions,
    INodeType,
    INodeTypeDescription,
    ISupplyDataFunctions,
    NodeConnectionType,
    SupplyData,
} from 'n8n-workflow';
import { executeAiTool } from './ai-tools/tool-executor';
import { wrapError, ERROR_TYPES } from './ai-tools/error-formatter';
import { buildUnifiedDescription, OPERATION_LABELS } from './ai-tools/description-builders';
import { getRuntimeSchemaBuilders } from './ai-tools/schema-generator';
import { RuntimeDynamicStructuredTool, runtimeZod } from './ai-tools/runtime';

// Initialise schema builders once at module load (runtime Zod from n8n's module tree)
const runtimeSchemas = getRuntimeSchemaBuilders(runtimeZod);

// ── Resource / operation configuration ────────────────────────────────────

const RESOURCE_OPERATIONS: Record<string, { label: string; ops: string[] }> = {
    quotes: {
        label: 'Quote',
        ops: ['getAll', 'get', 'copy', 'delete', 'deleteVersion', 'getLatestVersion', 'getVersion', 'getVersions', 'update', 'closeAsLost', 'closeAsNoDecision', 'closeAsWon'],
    },
    quoteItems: {
        label: 'Quote Item',
        ops: ['getAll', 'get', 'create', 'delete', 'update'],
    },
    quoteCustomers: {
        label: 'Quote Customer',
        ops: ['getAll', 'delete', 'replace', 'update'],
    },
    quoteTabs: {
        label: 'Quote Tab',
        ops: ['getAll', 'getItems'],
    },
    quoteTerms: {
        label: 'Quote Term',
        ops: ['getAll', 'create', 'delete', 'update'],
    },
    recurringRevenue: {
        label: 'Recurring Revenue',
        ops: ['getAll'],
    },
    taxCodes: {
        label: 'Tax Code',
        ops: ['getAll'],
    },
    templates: {
        label: 'Template',
        ops: ['getAll'],
    },
    user: {
        label: 'User',
        ops: ['getAll', 'update'],
    },
};

const WRITE_OPERATIONS = new Set([
    'create', 'update', 'delete', 'replace', 'copy', 'deleteVersion',
    'closeAsLost', 'closeAsNoDecision', 'closeAsWon',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function parseToolResult(resultJson: string): IDataObject {
    try {
        return JSON.parse(resultJson) as IDataObject;
    } catch {
        return { error: resultJson };
    }
}

// ── Node class ─────────────────────────────────────────────────────────────

export class ConnectWiseCpqAiTools implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'ConnectWise CPQ AI Tools',
        name: 'connectWiseCpqAiTools',
        icon: 'file:connectwisecpq.svg',
        group: ['output'],
        version: 1,
        description: 'Use ConnectWise CPQ resources as tools in an AI Agent or MCP Trigger',
        defaults: { name: 'ConnectWise CPQ AI Tools' },
        // eslint-disable-next-line n8n-nodes-base/node-class-description-inputs-wrong-regular-node
        inputs: [],
        // eslint-disable-next-line n8n-nodes-base/node-class-description-outputs-wrong
        outputs: [{ type: 'ai_tool' as NodeConnectionType, displayName: 'Tools' }],
        credentials: [{ name: 'connectWiseCpqApi', required: true }],
        properties: [
            {
                displayName: 'Resource Name or ID',
                name: 'resource',
                type: 'options',
                required: true,
                noDataExpression: true,
                typeOptions: { loadOptionsMethod: 'getToolResources' },
                default: '',
                description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
            },
            {
                displayName: 'Operations Names or IDs',
                name: 'operations',
                type: 'multiOptions',
                required: true,
                typeOptions: {
                    loadOptionsMethod: 'getToolResourceOperations',
                    loadOptionsDependsOn: ['resource', 'allowWriteOperations'],
                },
                default: [],
                description: 'Choose from the list, or specify IDs using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
            },
            {
                displayName: 'Allow Write Operations',
                name: 'allowWriteOperations',
                type: 'boolean',
                default: false,
                description: 'Whether to enable mutating operations (create, update, delete, replace, copy, deleteVersion, closeAs*). Disabled = read-only tools.',
            },
        ],
    };

    methods = {
        loadOptions: {
            async getToolResources(
                this: ILoadOptionsFunctions,
            ): Promise<INodePropertyOptions[]> {
                return Object.entries(RESOURCE_OPERATIONS)
                    .map(([value, config]) => ({
                        name: config.label,
                        value,
                        description: `${config.label} resource`,
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name));
            },

            async getToolResourceOperations(
                this: ILoadOptionsFunctions,
            ): Promise<INodePropertyOptions[]> {
                const resource = this.getCurrentNodeParameter('resource') as string;
                const allowWrite = (this.getCurrentNodeParameter('allowWriteOperations') ?? false) as boolean;
                if (!resource) return [];
                const config = RESOURCE_OPERATIONS[resource];
                if (!config) return [];
                return config.ops
                    .filter((op) => allowWrite || !WRITE_OPERATIONS.has(op))
                    .map((op) => ({
                        name: OPERATION_LABELS[op] ?? op,
                        value: op,
                        description: `${op} operation for ${config.label}`,
                    }));
            },
        },
    };

    async supplyData(
        this: ISupplyDataFunctions,
        itemIndex: number,
    ): Promise<SupplyData> {
        const resource = this.getNodeParameter('resource', itemIndex) as string;
        const operations = this.getNodeParameter('operations', itemIndex) as string[];
        const allowWriteOperations = this.getNodeParameter(
            'allowWriteOperations', itemIndex, false,
        ) as boolean;

        if (!resource) {
            throw new NodeOperationError(this.getNode(), 'Resource is required');
        }
        if (!operations?.length) {
            throw new NodeOperationError(this.getNode(), 'At least one operation must be selected');
        }

        const config = RESOURCE_OPERATIONS[resource];
        if (!config) {
            throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
        }

        // Layer 1: Filter effectiveOps — excludes writes when allowWriteOperations=false
        const effectiveOps = operations.filter((op) => {
            if (WRITE_OPERATIONS.has(op) && !allowWriteOperations) return false;
            return config.ops.includes(op);
        });

        if (effectiveOps.length === 0) {
            throw new NodeOperationError(
                this.getNode(),
                'No operations to expose. Select at least one operation, and enable "Allow Write Operations" if needed.',
            );
        }

        const referenceUtc = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        const unifiedSchema = runtimeSchemas.buildUnifiedSchema(resource, effectiveOps);
        const unifiedDescription = buildUnifiedDescription(
            config.label, resource, effectiveOps, referenceUtc,
        );

        // Determine MCP annotation hints based on effective operations
        const hasWriteOps = effectiveOps.some((op) => WRITE_OPERATIONS.has(op));
        const hasDestructiveOps = effectiveOps.some((op) =>
            op === 'delete' || op === 'deleteVersion',
        );

        const self = this;

        // Tool name: connectwisecpq_{resource} — complies with MCP regex ^[a-zA-Z0-9_-]{1,128}$
        const unifiedTool = new RuntimeDynamicStructuredTool({
            name: `connectwisecpq_${resource}`,
            description: unifiedDescription,
            schema: unifiedSchema as any,
            func: async (params: Record<string, unknown>) => {
                const operationFromArgs = params.operation;
                const operation = typeof operationFromArgs === 'string' ? operationFromArgs : undefined;

                // Layer 2 (func path): Re-check operation against effectiveOps
                if (!operation || !effectiveOps.includes(operation)) {
                    // Check if it's a write-blocked operation specifically
                    if (operation && WRITE_OPERATIONS.has(operation) && !allowWriteOperations) {
                        return JSON.stringify(wrapError(
                            resource, operation, ERROR_TYPES.WRITE_OPERATION_BLOCKED,
                            'Write operations are disabled for this tool.',
                            'Enable allowWriteOperations on the ConnectWise CPQ AI Tools node to use mutating operations.',
                        ));
                    }
                    return JSON.stringify(wrapError(
                        resource, operation ?? 'unknown', ERROR_TYPES.INVALID_OPERATION,
                        'Missing or unsupported operation for this tool call.',
                        `Use one of: ${effectiveOps.join(', ')}.`,
                        { providedOperation: operationFromArgs ?? null, allowedOperations: effectiveOps },
                    ));
                }

                // Strip operation before passing to executor
                const { operation: _op, ...operationParams } = params;
                return executeAiTool(self, resource, operation, operationParams);
            },
        });

        // MCP tool annotations (future-ready — applied when n8n/LangChain support lands)
        const toolWithAnnotations = unifiedTool as any;
        toolWithAnnotations.annotations = {
            readOnlyHint: !hasWriteOps,
            destructiveHint: hasDestructiveOps,
            idempotentHint: !effectiveOps.includes('create'),
            openWorldHint: true,
        };

        return { response: unifiedTool };
    }

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const resource = this.getNodeParameter('resource', 0) as string;
        const operations = this.getNodeParameter('operations', 0) as string[];
        const allowWriteOperations = this.getNodeParameter(
            'allowWriteOperations', 0, false,
        ) as boolean;

        if (!resource || !operations?.length) {
            throw new NodeOperationError(
                this.getNode(),
                'Resource and at least one operation must be configured.',
            );
        }

        const config = RESOURCE_OPERATIONS[resource];
        if (!config) {
            throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`);
        }

        const effectiveOps = operations.filter(
            (op) => !WRITE_OPERATIONS.has(op) || allowWriteOperations,
        );
        if (effectiveOps.length === 0) {
            throw new NodeOperationError(
                this.getNode(),
                'No permitted operations. Enable "Allow Write Operations" if needed.',
            );
        }

        const items = this.getInputData();
        const response: INodeExecutionData[] = [];

        for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
            const item = items[itemIndex];
            if (!item) continue;

            const requestedOp = item.json.operation as string | undefined;

            // Layer 3 (execute path): Write-block guard — returns structured error, not silent fallback
            if (requestedOp && WRITE_OPERATIONS.has(requestedOp) && !allowWriteOperations) {
                response.push({
                    json: parseToolResult(JSON.stringify(wrapError(
                        resource, requestedOp, ERROR_TYPES.WRITE_OPERATION_BLOCKED,
                        'Write operations are disabled.',
                        'Enable allowWriteOperations on this node to use mutating operations.',
                    ))),
                    pairedItem: { item: itemIndex },
                });
                continue;
            }

            // Validate operation is in effectiveOps; fall back to getAll only for missing/unknown ops
            const effectiveOp =
                requestedOp && effectiveOps.includes(requestedOp)
                    ? requestedOp
                    : effectiveOps.includes('getAll') ? 'getAll' : effectiveOps[0] ?? '';

            try {
                // Strip n8n metadata fields before passing to executor
                const rawJson = item.json as Record<string, unknown>;
                const params: Record<string, unknown> = {};
                for (const [key, value] of Object.entries(rawJson)) {
                    // N8N_METADATA_FIELDS equivalent for execute path
                    if (!['resource', 'operation', 'tool', 'toolName', 'toolCallId',
                        'sessionId', 'action', 'chatInput', 'root'].includes(key)) {
                        params[key] = value;
                    }
                }
                const resultJson = await executeAiTool(
                    this as unknown as ISupplyDataFunctions,
                    resource,
                    effectiveOp,
                    params,
                );
                response.push({
                    json: parseToolResult(resultJson),
                    pairedItem: { item: itemIndex },
                });
            } catch (error) {
                throw new NodeOperationError(
                    this.getNode(),
                    error instanceof Error ? error.message : String(error),
                    { itemIndex },
                );
            }
        }

        return [response];
    }
}
