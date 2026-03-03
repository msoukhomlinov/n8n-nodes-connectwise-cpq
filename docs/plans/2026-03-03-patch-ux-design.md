# Design: UX-Friendly Patch Operations

**Date:** 2026-03-03
**Status:** Approved
**Scope:** All 5 resources with JSON Patch update operations

---

## Problem

The `Update` operation on all patchable resources (quotes, quoteItems, quoteTerms,
quoteCustomers, user) exposes a raw `Patch Operations (JSON)` text field. Users must
hand-craft a JSON Patch array such as:

```json
[{"op":"replace","path":"/name","value":"Acme Q1"}]
```

This is error-prone, requires API knowledge, and is a poor n8n UX pattern.

---

## Solution

Replace the raw JSON string field with a `fixedCollection` UI element called
**"Fields to Update"**. Each row lets the user pick a field from a searchable
dropdown and enter a value. The execute function assembles the JSON Patch array
automatically — the user never sees the patch format.

### UI (all 5 resources)

**Before:**
```
Patch Operations (JSON): [{"op":"replace","path":"/name","value":"Acme Q1"}]
```

**After:**
```
Fields to Update:
  [+ Add Field]
  ┌───────────────────────────────┬─────────────────┐
  │ Field: [Name ▾]               │ Value: Acme Q1  │
  ├───────────────────────────────┼─────────────────┤
  │ Field: [Expected Close Date ▾]│ Value: 2026-06-30│
  └───────────────────────────────┴─────────────────┘
```

- `field` — `options` type (searchable dropdown). Contains **all non-ref, non-array
  fields** from the Swagger spec for that resource.
- `value` — `string` type. Description advises: *"For boolean fields use 'true' or
  'false'. For date fields use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)."*
- At least one row is required; an empty collection throws `NodeOperationError`.

### Field counts per resource

| Resource      | Definition    | Field count |
|---------------|---------------|-------------|
| quotes        | QuoteView     | 200         |
| quoteItems    | QuoteItemView | 222         |
| quoteTerms    | QuoteTermView | 61          |
| quoteCustomers| CustomerView  | 32          |
| user          | UserView      | 39          |

---

## Type Auto-Casting

Each resource file exports a `FIELD_TYPES` constant mapping field name → Swagger
primitive type. The new `castUpdateValue()` helper in `GenericFunctions.ts` converts
the user's string input to the correct JSON type before building the patch:

| Swagger type      | User input     | Patch value  |
|-------------------|----------------|--------------|
| `boolean`         | `"true"`        | `true`       |
| `boolean`         | `"false"`       | `false`      |
| `integer`         | `"42"`          | `42`         |
| `number` (double) | `"3.14"`        | `3.14`       |
| `string`          | `"Acme"`        | `"Acme"`     |
| unknown / missing | any            | string as-is |

**Error cases:**
- Number/integer field where `parseFloat`/`parseInt` returns `NaN` → `NodeOperationError`
- Empty `updateFields.values` array → `NodeOperationError`

All operations are built as `op: "replace"`. The `add`, `move`, `copy`, `remove`
operations are out of scope for this feature (they represent a tiny minority of use
cases and remain achievable by using expressions to pass a pre-built array if needed).

---

## Code Changes

### `GenericFunctions.ts`

Add one new exported function:

```ts
export function castUpdateValue(value: string, type: string): unknown
```

Casts `value` string to boolean/integer/number/string based on `type`. Throws
`NodeOperationError` on NaN for numeric types.

### Resource files (×5)

For each of `quotes`, `quoteItems`, `quoteTerms`, `quoteCustomers`, `user`:

1. **Remove** the `patchOperations` `INodeProperties` entry.
2. **Add** `updateFields` `fixedCollection` `INodeProperties` entry with:
   - `typeOptions: { multipleValues: true }`
   - `options[0].values` containing `field` (options dropdown) and `value` (string)
3. **Add** `FIELD_TYPES: Record<string, string>` constant (generated from Swagger).
4. **Update** the `update` execute block:
   - Read `updateFields.values`
   - Map to patch ops using `castUpdateValue` + `FIELD_TYPES`
   - Call `prepareJsonPatch` as before

### Field option generation

The `field` options arrays are generated from `.docs/references/SellAPI.json` —
specifically, all properties of the relevant `*View` definition where `type` is not
`ref` or `array`. Display names are produced by splitting camelCase to Title Case
(e.g. `expectedCloseDate` → `Expected Close Date`).

A one-off Node.js script is used to generate the arrays and embed them in the
resource files.

---

## Out of Scope

- `add`, `remove`, `move`, `copy` patch ops (replace-only covers 99% of use cases)
- Type-specific input widgets (toggle for booleans, date picker, etc.) — would require
  conditional sub-fields, significantly more complexity, and isn't supported cleanly
  by n8n's `fixedCollection`
- Runtime Swagger field loading (`loadOptions`) — static arrays are simpler and
  sufficient since the Swagger spec is bundled with the package

---

## Risks / Mitigations

| Risk | Mitigation |
|------|-----------|
| Swagger adds new fields after publish | Field dropdown won't list them, but user can still use an expression on `updateFields` or file a PR |
| User enters wrong type (e.g. string in a number field) | `castUpdateValue` throws a clear `NodeOperationError` with item index |
| Breaking change to existing workflows using raw JSON | Old `patchOperations` parameter is removed; existing workflows will show a validation error and need migrating. This is acceptable — raw JSON was never a stable API contract. |
