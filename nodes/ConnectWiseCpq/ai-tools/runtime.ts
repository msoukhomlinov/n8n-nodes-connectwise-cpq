import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { z as ZodNamespace } from 'zod';
import { createRequire } from 'module';

type DynamicStructuredToolCtor = new (fields: {
    name: string;
    description: string;
    schema: any;
    func: (params: Record<string, unknown>) => Promise<string>;
}) => DynamicStructuredTool;

export type RuntimeZod = typeof ZodNamespace;

// ── Hardened anchor resolution ────────────────────────────────────────────
// Community nodes bundle their own zod and @langchain/core. At runtime, n8n
// loads its own copies. JavaScript instanceof fails across module copies.
// We resolve both classes from n8n's module tree using createRequire(),
// anchored to a candidate list tried in order.

const ANCHOR_CANDIDATES = [
    '@langchain/classic/agents',  // primary: stable in n8n ≥ 2.4.x
    'langchain/agents',           // secondary: fallback
];

let runtimeRequire: NodeRequire | null = null;
const errors: string[] = [];

for (const candidate of ANCHOR_CANDIDATES) {
    try {
        const resolved = require.resolve(candidate);
        runtimeRequire = createRequire(resolved);
        break;
    } catch (e) {
        errors.push(`${candidate}: ${(e as Error).message}`);
    }
}

if (!runtimeRequire) {
    throw new Error(
        `[runtime.ts] Could not resolve LangChain anchor. Tried:\n${errors.join('\n')}\n` +
        'Ensure @n8n/nodes-langchain is installed in n8n\'s node_modules.',
    );
}

// NOTE: require.resolve() works here because n8n loads community nodes within
// its own module resolution context — community node packages share n8n's
// node_modules tree.

const coreTools = runtimeRequire('@langchain/core/tools') as Record<string, unknown>;
export const RuntimeDynamicStructuredTool = coreTools['DynamicStructuredTool'] as DynamicStructuredToolCtor;

export const runtimeZod = runtimeRequire('zod') as RuntimeZod;
