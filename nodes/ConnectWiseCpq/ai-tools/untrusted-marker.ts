// ── Untrusted-content marking (AI-tool path) ───────────────────────────────
// Vendor text (quote names, notes, terms, approval reasons, error bodies) reaches a model
// through the AI-tool result envelope. Marking it tells the model the text is DATA, not
// instructions — the only client-side mitigation for a vendor channel that echoes
// caller-supplied text back. Same marker pair and the same tiered policy as the sibling SDK
// (node-connectwisecpq/untrusted), which is the single source of truth for the convention:
// free text is MARKED, structural values (ids, dates, urls) stay BARE, and a field with no
// known class fails safe to MARKED. This node does not depend on the SDK, so the class rule
// here is the key-name form of that policy rather than the SDK's per-resource field table.

/** Opening marker. Identical to the SDK's, so both surfaces read the same convention. */
export const UNTRUSTED_OPEN = '\u27E6UNTRUSTED\u27E7';
/** Closing marker. */
export const UNTRUSTED_CLOSE = '\u27E6/UNTRUSTED\u27E7';

/** Wrap vendor text in untrusted-content markers. Idempotent. */
export function markUntrusted(text: string): string {
    if (typeof text !== 'string') return text;
    if (text.startsWith(UNTRUSTED_OPEN) && text.endsWith(UNTRUSTED_CLOSE)) return text;
    return `${UNTRUSTED_OPEN}${text}${UNTRUSTED_CLOSE}`;
}

/**
 * Keys whose values are structural rather than vendor prose. A vendor field name is part of the
 * vendor's schema, not attacker-chosen text, so classifying by name is safe; anything not listed
 * here (every unknown key included) is treated as free text and marked.
 */
function isStructuralKey(key: string): boolean {
    return (
        /^id$/i.test(key) ||
        /Ids?$/i.test(key) ||
        /Date(Time)?$/i.test(key) ||
        /(Url|Uri)$/i.test(key) ||
        /^(url|uri)$/i.test(key)
    );
}

/**
 * Walk a vendor payload and wrap its free-text leaves in the untrusted marker. Objects and arrays
 * are walked recursively, structural keys are left bare, non-string leaves (numbers, booleans,
 * null) are returned as they are, and empty strings are not wrapped (no injection surface).
 * Idempotent, and the served text stays `JSON.parse`-able because markers only ever land inside
 * string values.
 */
export function markTiered(value: unknown): unknown {
    if (typeof value === 'string') return value.length === 0 ? value : markUntrusted(value);
    if (Array.isArray(value)) return value.map((entry) => markTiered(entry));
    if (value !== null && typeof value === 'object') {
        const marked: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
            marked[key] =
                typeof entry === 'string' && isStructuralKey(key) ? entry : markTiered(entry);
        }
        return marked;
    }
    return value;
}
