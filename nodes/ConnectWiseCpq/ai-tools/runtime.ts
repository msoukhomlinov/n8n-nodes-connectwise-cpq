// nodes/ConnectWiseCpq/ai-tools/runtime.ts
import { createRequire } from 'module';
import type { DynamicStructuredTool } from '@langchain/core/tools';
import type { z as ZodNamespace } from 'zod';

type DynamicStructuredToolCtor = new (fields: {
    name: string;
    description: string;
    schema: any;
    func: (params: Record<string, unknown>) => Promise<string>;
}) => DynamicStructuredTool;

export type RuntimeZod = typeof ZodNamespace;

/**
 * Anchor candidates — packages in n8n's dependency tree that can serve as a
 * createRequire() anchor to resolve @langchain/core/tools and zod from n8n's
 * own module tree (not this package's bundled copies).
 *
 * IMPORTANT: resolution must NEVER run at module-import time. n8n's
 * node-directory-loader requires every node file in this package (including
 * this one) purely to register node metadata, long before any workflow
 * executes — and it aborts loading the ENTIRE package if any one file throws
 * while being required. That used to be exactly what happened here: under
 * pnpm-strict-isolated n8n installs (v2.29.x+) this package is installed
 * outside n8n's own node_modules tree (e.g. ~/.n8n/nodes/), so neither
 * anchor below resolves at all — @langchain/classic/@langchain/core are only
 * reachable from inside @n8n/n8n-nodes-langchain's own isolated pnpm
 * subtree, which no filesystem-based require.resolve() from here can walk
 * into. The resulting throw took down the plain, non-AI `connectWiseCpq`
 * node too, not just this AI-tools node (every node this package ships
 * reported as "Unrecognized node type").
 *
 * Resolution is therefore deferred to first actual use, inside the Proxy
 * traps below (which only fire when a connected AI tool is invoked at
 * workflow-execution time via supplyData()). By then, n8n's own Agent/MCP
 * Trigger machinery has already loaded @langchain/core/tools itself (to run
 * its own tool-calling logic), so if the anchors still don't resolve, a
 * require.cache scan finds the exact module instance n8n itself loaded —
 * which works regardless of install layout.
 */
const ANCHOR_CANDIDATES = [
    // primary: @langchain/classic is a direct dep of @n8n/nodes-langchain, stable since n8n 2.4.x.
    // Its @langchain/core peerDep resolves to n8n's hoisted @langchain/core.
    '@langchain/classic/agents',
    // secondary: langchain package is in the n8n catalog and also has @langchain/core as peerDep.
    'langchain/agents',
] as const;

// This package's own name — used to exclude our own bundled copies from every
// filesystem/require.cache resolution path (see resolveZod()).
const OWN_PACKAGE_NAME = 'n8n-nodes-connectwise-cpq';

// Memoized ONLY on success — a failed attempt must not permanently disable
// retries (e.g. the require.cache scan fallback below may only succeed on a
// later call, once n8n has finished loading its own langchain-dependent
// nodes).
let _runtimeReq: NodeRequire | undefined;
let _anchorDiagnostic: string | null = null;

function getRuntimeRequire(): NodeRequire | undefined {
    if (_runtimeReq) return _runtimeReq;

    const tried: string[] = [];
    for (const candidate of ANCHOR_CANDIDATES) {
        try {
            const resolved = require.resolve(candidate);
            _runtimeReq = createRequire(resolved);
            _anchorDiagnostic = `resolved via anchor: ${candidate}`;
            return _runtimeReq;
        } catch (e) {
            tried.push(`${candidate}: ${(e as Error).message}`);
        }
    }

    _anchorDiagnostic = `Could not resolve LangChain anchor. Tried:\n${tried.join('\n')}`;
    return undefined;
}

// Anchor-package patterns used to POSITIVELY resolve the host copies of zod / @langchain/core.
//
// These match ONLY packages that are (a) owned/shipped by n8n and (b) NEVER bundled by a
// community node, so a cache key matching one of them provably belongs to n8n's own module tree.
// This is deliberately NOT a `zod` / `@langchain/core` pattern: under pnpm the require.cache key
// is the resolved virtual-store realpath (e.g. `.../.pnpm/zod@3.x/node_modules/zod/...` or
// `.../.pnpm/@langchain+core@0.3.x/node_modules/@langchain/core/...`), which does NOT encode the
// dependent package — so a community node's OWN bundled zod/@langchain/core is indistinguishable
// by path from n8n's, and any name-based exclusion silently no-ops there. Anchoring off an
// unambiguous n8n-owned package and `createRequire()`-ing the dependency FROM it sidesteps that
// entirely: the resolution walks n8n's real dependency graph, landing on n8n's copy regardless of
// store layout.
//
// `@n8n/n8n-nodes-langchain` is first for both deps because it is the package whose
// `normalizeToolSchema` does the `instanceof ZodType` / `instanceof DynamicStructuredTool` checks,
// so the copies IT resolves are the canonical ones — and it is ALWAYS resident in require.cache by
// the time our supplyData() runs (it is what invokes the tool), so this anchor effectively always
// succeeds in practice. `@langchain/classic` (n8n's, not community-bundled) and n8n-core /
// n8n-workflow (peerDeps, never bundled by community nodes) are fallbacks.
const LANGCHAIN_TREE_PATTERNS = [
    /[\\/]@n8n[\\/]n8n-nodes-langchain[\\/]/,
    /[\\/]@langchain[\\/]classic[\\/]/,
] as const;
const ZOD_TREE_PATTERNS = [
    /[\\/]@n8n[\\/]n8n-nodes-langchain[\\/]/,
    /[\\/]n8n-workflow[\\/]/,
    /[\\/]n8n-core[\\/]/,
] as const;

// A community-node package segment (e.g. `.../n8n-nodes-foo/...`). n8n's own
// `@n8n/n8n-nodes-langchain` is NOT a community node, so it is explicitly not matched.
// NOTE: this is a best-effort heuristic for symlinked / nested-node_modules layouts. Under pnpm's
// virtual store the realpath does not contain the dependent package name, so this cannot identify
// a store-resident community copy — correctness there comes from the n8n-owned anchors above, not
// from this predicate. Kept as defense-in-depth for the blind-scan last resort.
function isCommunityNodePath(key: string): boolean {
    return /[\\/]n8n-nodes-/.test(key) && !/[\\/]@n8n[\\/]n8n-nodes-/.test(key);
}

// Requires `id` from the first already-cached module whose key matches one of `patterns` (an
// n8n-owned anchor package) and is not this package's own tree. Because the anchor packages are
// never community-bundled, `createRequire()`-ing `id` from the matched module walks n8n's real
// dependency graph to n8n's copy of `id` — independent of require.cache ordering and of pnpm
// store-path naming. Also recovers the require.main result when require.main is undefined
// (ESM/queue-mode workers). Returns undefined if nothing matches or every require throws.
function requireFromCachedTree(patterns: readonly RegExp[], id: string): unknown | undefined {
    try {
        const cache = require.cache;
        if (!cache) return undefined;
        const keys = Object.keys(cache);
        for (const pattern of patterns) {
            for (const key of keys) {
                if (!pattern.test(key)) continue;
                if (key.includes(OWN_PACKAGE_NAME) || isCommunityNodePath(key)) continue;
                const entry = cache[key];
                if (!entry?.filename) continue;
                try {
                    return createRequire(entry.filename)(id);
                } catch {
                    // try next candidate
                }
            }
        }
    } catch (_e) {
        // best-effort
    }
    return undefined;
}

let _RuntimeDynamicStructuredTool: DynamicStructuredToolCtor | undefined;
let _runtimeZod: RuntimeZod | undefined;
let _langchainLoadError: string | null = null;
let _zodLoadError: string | null = null;
let _zodDiagnostic: string | null = null;

function resolveDynamicStructuredTool(): DynamicStructuredToolCtor | undefined {
    if (_RuntimeDynamicStructuredTool) return _RuntimeDynamicStructuredTool;

    const runtimeReq = getRuntimeRequire();
    if (runtimeReq) {
        try {
            const coreTools = runtimeReq('@langchain/core/tools') as Record<string, any>;
            if (typeof coreTools?.['DynamicStructuredTool'] === 'function') {
                _RuntimeDynamicStructuredTool = coreTools[
                    'DynamicStructuredTool'
                ] as DynamicStructuredToolCtor;
                return _RuntimeDynamicStructuredTool;
            }
        } catch (e) {
            _langchainLoadError = (e as Error).message;
        }
    }

    // Fallback for pnpm-isolated installs where no filesystem anchor reaches @langchain/core.
    // Anchor POSITIVELY off a cached n8n-owned package (never community-bundled) and require
    // '@langchain/core/tools' from there. @n8n/n8n-nodes-langchain — which loads @langchain/core
    // to run the agent, and is therefore always resident by the time our supplyData() runs — is
    // tried first, so this effectively always succeeds in a real invocation. If it does not, we
    // deliberately DO NOT fall back to a blind require.cache scan for a @langchain/core copy:
    // under pnpm the cache key is the flat virtual-store realpath, so we cannot tell n8n's copy
    // apart from another community node's, and returning the wrong one would fail n8n's
    // `instanceof DynamicStructuredTool` silently. Failing here (→ Proxy throws a clear error) is
    // strictly safer than guessing.
    const viaTree = requireFromCachedTree(LANGCHAIN_TREE_PATTERNS, '@langchain/core/tools') as
        | Record<string, unknown>
        | undefined;
    if (viaTree && typeof viaTree['DynamicStructuredTool'] === 'function') {
        _RuntimeDynamicStructuredTool = viaTree['DynamicStructuredTool'] as DynamicStructuredToolCtor;
        _langchainLoadError = null;
    }
    return _RuntimeDynamicStructuredTool;
}

function resolveZod(): RuntimeZod | undefined {
    if (_runtimeZod) return _runtimeZod;

    // Priority order: require.main → positive n8n-tree cache anchor → blind require.cache scan.
    // (There is deliberately NO "resolve zod from the @langchain/classic anchor" step: per the
    // three-module-trees rule, that anchor reaches @langchain/classic's NESTED zod, which fails
    // n8n's top-level `instanceof ZodType` check. zod must come from n8n's top-level tree.)
    //
    // Primary path: resolve zod starting from n8n's own main entry point's module tree
    // (require.main). For a correctly-installed (non-isolated) setup this lands on n8n's
    // top-level zod — the exact copy n8n's own normalizeToolSchema does `instanceof ZodType`
    // against. Even under pnpm-strict isolation this is a DIFFERENT resolution path than this
    // package's own local require('zod'), so it is far more likely to reach n8n's real copy
    // (or fail cleanly) than to silently return this package's OWN bundled zod. Resolved
    // lazily here (NOT at module top level) so node registration never triggers it — that
    // laziness is the entire point of this fix.
    //
    // Only anchor at require.main when it is actually defined. When it is undefined (ESM-
    // launched n8n, worker_threads / queue-mode workers), there is NO useful main to anchor
    // at: falling back to `__filename` would anchor at THIS file (this package's own
    // runtime.js), whose `require.resolve('zod')` lands on this package's OWN bundled zod —
    // the copy that fails n8n's `instanceof ZodType` check. So resolve-then-check the path
    // and skip it if it points into this package's own tree, reusing the same exclusion
    // substring as the cache-scan path below.
    if (require.main?.filename) {
        try {
            const mainReq = createRequire(require.main.filename);
            const resolvedPath = mainReq.resolve('zod');
            if (!resolvedPath.includes(OWN_PACKAGE_NAME)) {
                _runtimeZod = mainReq('zod') as RuntimeZod;
                if (_runtimeZod) {
                    _zodDiagnostic = 'resolved zod via require.main';
                    _zodLoadError = null;
                    return _runtimeZod;
                }
            }
        } catch (e) {
            _zodLoadError = (e as Error).message;
        }
    }

    // Secondary path (positive anchor): resolve zod from a cached module that is provably part of
    // n8n's OWN tree — @n8n/n8n-nodes-langchain (the package whose normalizeToolSchema does the
    // `instanceof ZodType` check), n8n-workflow, or n8n-core. Requiring 'zod' from there lands on
    // n8n's TOP-LEVEL zod (the exact copy the instanceof check uses), recovering the require.main
    // result even when require.main is undefined (ESM/queue-mode). Critically, this does NOT
    // depend on require.cache iteration order NOR on pnpm store-path naming — it ties the result
    // to n8n's tree by walking a known n8n-owned package's real dependency graph, so another
    // community node's bundled zod can never be returned.
    const viaTree = requireFromCachedTree(ZOD_TREE_PATTERNS, 'zod') as RuntimeZod | undefined;
    if (
        viaTree &&
        typeof (viaTree as unknown as Record<string, unknown>)['ZodType'] === 'function' &&
        typeof (viaTree as unknown as Record<string, unknown>)['object'] === 'function'
    ) {
        _runtimeZod = viaTree;
        _zodLoadError = null;
        _zodDiagnostic = 'resolved zod via cached n8n-tree module anchor';
        return _runtimeZod;
    }

    // No blind require.cache scan for a bare `zod` entry as a further fallback: under pnpm the
    // cache key is the flat virtual-store realpath, so a zod entry cannot be attributed to n8n vs
    // another community node, and returning a wrong-tree copy would silently fail n8n's
    // `instanceof ZodType` check. The require.main + n8n-owned-anchor paths above are the only
    // correctness-preserving sources; if both fail we return undefined and the Proxy throws a
    // clear error rather than guessing. (@n8n/n8n-nodes-langchain is always resident at execution,
    // so the anchor path effectively always succeeds in a real tool invocation.)
    return _runtimeZod;
}

// IMPORTANT: Proxy target MUST be `function () {}`, not `{}`.
// ECMAScript spec §10.5.13: a Proxy only has [[Construct]] if its target does.
// Plain objects lack [[Construct]], so `new Proxy({}, ...)` throws
// "is not a constructor" before the construct trap ever fires.
export const RuntimeDynamicStructuredTool: DynamicStructuredToolCtor = new Proxy(
    function () {} as unknown as DynamicStructuredToolCtor,
    {
        construct(_target, args) {
            const ctor = resolveDynamicStructuredTool();
            if (!ctor) {
                throw new Error(
                    `[ConnectWiseCpqAiTools] Could not resolve LangChain's DynamicStructuredTool. ` +
                        `Ensure @n8n/nodes-langchain is installed in n8n's node_modules.` +
                        (_anchorDiagnostic ? ` Diagnostic: ${_anchorDiagnostic}` : '') +
                        (_langchainLoadError ? ` Load error: ${_langchainLoadError}` : ''),
                );
            }
            return new (ctor as any)(...args) as object;
        },
        get(_target, prop) {
            const ctor = resolveDynamicStructuredTool();
            if (ctor) {
                return (ctor as any)[prop];
            }
            return undefined;
        },
    },
) as DynamicStructuredToolCtor;

export const runtimeZod: RuntimeZod = new Proxy({} as RuntimeZod, {
    get(_target, prop) {
        // Guard: frameworks probe Symbol.toPrimitive, Symbol.toStringTag, .then
        // (Promise thenable), and .constructor. Throwing on these causes
        // misleading errors during structural inspection.
        if (typeof prop === 'symbol' || prop === 'then' || prop === 'constructor') return undefined;
        const z = resolveZod();
        if (!z) {
            throw new Error(
                `[ConnectWiseCpqAiTools] Could not resolve zod (accessing .${String(prop)}) ` +
                    `via require.main, LangChain anchor, or require.cache scan. ` +
                    `Ensure @n8n/nodes-langchain is installed in n8n's node_modules.` +
                    (_zodDiagnostic
                        ? ` Diagnostic: ${_zodDiagnostic}`
                        : _anchorDiagnostic
                          ? ` Diagnostic: ${_anchorDiagnostic}`
                          : '') +
                    (_zodLoadError ? ` Load error: ${_zodLoadError}` : ''),
            );
        }
        return (z as any)[prop];
    },
});
