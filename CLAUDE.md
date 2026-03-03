# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Keeping this file up to date

Update this file whenever you make changes that affect any of the sections below:

- **New resource added** — update the resource list in Architecture, the `includeFields` mapping, and the "Adding a new resource" checklist if the steps change
- **New shared helper or GenericFunctions change** — update the Pagination, Conditions, or Authentication sections as appropriate
- **Credential fields added/removed** — update the Authentication section
- **New npm script or build step** — update Commands
- **`MAX_PAGE_SIZE` or pagination logic changed** — update the Pagination section
- **Filter operators or value types changed** — update the Conditions section
- **`castUpdateValue` logic or `FIELD_TYPES` conventions changed** — update the Update (PATCH) field UI section

The goal is that a future Claude session can read this file and have an accurate picture of the codebase without needing to re-read every source file.

## Commands

```bash
# Build (clean dist, compile TypeScript, copy icons)
npm run build

# Watch mode (TypeScript only, no icons)
npm run dev

# Lint
npm run lint

# Lint with auto-fix
npm run lintfix

# Format with Prettier
npm run format

# Pre-publish check (build + lint with strict rules)
npm run prepublishOnly
```

There are no automated tests. Manual testing requires installing the node in a running n8n instance.

## Architecture

This is an n8n v1 community node package exposing the ConnectWise CPQ (Sell) REST API.

### Key directories

- `credentials/` — Credential type definition (`ConnectWiseCpqApi.credentials.ts`)
- `nodes/ConnectWiseCpq/` — Node implementation
  - `ConnectWiseCpq.node.ts` — Entry point: resource selector, `loadOptions` for dynamic field lists, `execute()` dispatcher
  - `GenericFunctions.ts` — Shared HTTP helpers, pagination, conditions builder, JSON Patch formatter
  - `resources/` — One file per resource; each exports `*Operations`, `*Fields`, and `execute*`
  - `resources/index.ts` — Re-exports all resource modules
  - `resources/constants.ts` — Shared constants (`MAX_PAGE_SIZE = 1000`)
- `.docs/references/SellAPI.json` — Swagger spec used at runtime to populate `includeFields` multi-select options

### Authentication

CPQ 2022.2+ only. Basic auth with:
- Username: `accessKey+publicKey` (whitespace trimmed)
- Password: `privateKey`
- Header: `Authorization: Basic base64(username:password)`
- Fixed headers on every request: `Content-Type: application/json; version=1.0`, `Accept: application/json`, `User-Agent: n8n-connectwise-cpq`
- Base URL default: `https://sellapi.quosalsell.com`

Auth is built in two places: `credentials/ConnectWiseCpqApi.credentials.ts` (for credential test connections via n8n's `authenticate` property) and `GenericFunctions.ts` `cpqApiRequest` (for actual node execution). Both must stay in sync.

### Resource pattern

Each resource file follows this convention:

```ts
// 1. Operations array (the Operation dropdown options)
export const fooOperations: INodeProperties[] = [ ... ];

// 2. Fields array (parameters shown per operation)
export const fooFields: INodeProperties[] = [ ... ];

// 3. Execute function called from the main node switch
export async function executeFoo(
  this: IExecuteFunctions,
  i: number,
  returnData: INodeExecutionData[],
): Promise<void> { ... }
```

The main node's `execute()` method dispatches by `resource` value using a `switch` statement, calling the appropriate `execute*` function.

### Pagination

`cpqApiRequestAllItems` in `GenericFunctions.ts` handles all pagination:
- **Return All**: uses `pageSize = MAX_PAGE_SIZE` (1000), loops until fewer items than `pageSize` returned
- **Limited**: uses `effectivePageSize = min(limit, MAX_PAGE_SIZE)`, stops at `limit` items
- Resources that support listing always call this function rather than `cpqApiRequest` directly

### Conditions / filtering

Three node parameters resolved by `buildFiltersFromUi` in `GenericFunctions.ts` before sending to the API:
- **`filters`** — fixedCollection with rows: `field`, `operator`, `valueType`, `value`. Compiled by `buildFiltersFromUi`.
- **`filterLogic`** — `'and'` or `'or'`; joins filter rows and glues them to any raw conditions string.
- **`additionalOptions.rawConditions`** — advanced raw string passed through as-is (e.g. `summary = "Acme" and closedFlag = True`).

**Supported operators (confirmed from official CPQ docs):** `=`, `!=`, `<`, `<=`, `>`, `>=`, `contains`, `not contains`, `in`, `not in`. The `like` operator is NOT supported by the CPQ API and must not be added back.

Value formatting rules (confirmed from official CPQ docs):
- Strings → `"double-quoted"` (embedded `"` escaped as `\"`)
- Integers → bare number (NaN rows skipped)
- Booleans → `True` or `False` (capitalised, no quotes)
- Dates → `[YYYY-MM-DD]` brackets, **date only** — the CPQ API does not support time components in condition expressions; any T/time/timezone portion is stripped automatically in `formatSingleValue`

`in` / `not in` operators split the single `value` field on commas; each item is formatted per `valueType`. No separate `values` field or `list` value type exists.

Reference subfield filtering: type `field/subfield` directly in the Field input (e.g. `manufacturer/name`). No separate `referenceSubfield` field.

**Important:** The `SellAPI.json` Swagger spec documents field names and types but contains **no conditions syntax documentation**. For conditions syntax, see the official CPQ REST API docs at `https://developer.connectwise.com/Products/ConnectWise_CPQ/REST` (login required).

### Update (PATCH) field UI

Patch resources expose a `updateFields` fixedCollection (not a raw JSON field) so users can select which fields to update via a searchable dropdown:

- **`FIELD_TYPES` constant** — defined near the top of each resource file; maps field names to Swagger primitive types (`'string'`, `'integer'`, `'number'`, `'boolean'`). Drives value casting in `castUpdateValue`.
- **`castUpdateValue`** — exported from `GenericFunctions.ts`; casts a string UI input to the correct JSON type based on the field's entry in `FIELD_TYPES`. Uses regex pre-validation for integer (`/^-?\d+$/`) and number (`/^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/`) before parsing; throws `NodeOperationError` on invalid input.
- **`id` exclusion rule** — the primary key (`id`) must **never** appear in `updateFields` options or in the resource's `FIELD_TYPES` map. Relation IDs (`idQuote`, `idQuoteTabs`, etc.) may remain.
- Field options are generated from the Swagger spec (`SellAPI.json`) and hardcoded alphabetically in the resource file. When adding update support to a new resource, derive the `FIELD_TYPES` map and dropdown options from the resource's Swagger definition, then omit `id`.

### `includeFields` multi-select

Populated at runtime via `loadOptions.getIncludeFields` by reading `SellAPI.json` definitions. The mapping from `resource` value → definition name lives in `ConnectWiseCpq.node.ts`. When a new resource is added, this map must be updated.

### Build output

`tsc` compiles everything to `dist/`. The `n8n` section in `package.json` points to the compiled files. Icons are copied by the `gulp build:icons` task. The `dist/` directory is what gets published to npm.

### Adding a new resource

1. Create `nodes/ConnectWiseCpq/resources/myResource.resource.ts` following the three-export pattern above
2. Export it from `resources/index.ts`
3. Spread the `Operations` and `Fields` arrays into `ConnectWiseCpq.node.ts` `properties`
4. Add the `case 'myResource':` branch in `execute()`
5. Add the resource→definition mapping in `loadOptions.getIncludeFields`
6. Add the resource option to the Resource dropdown in `ConnectWiseCpq.node.ts`
