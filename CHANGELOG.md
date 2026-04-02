## 0.4.3 — 2026-04-02

### Fixed

- Strip `Prompt__*` framework keys injected by Agent Tool Node v3 (n8n ≥1.116) in the `execute()` path; these leaked into field validation and caused INVALID_WRITE_FIELDS errors on write operations

---

## 0.4.2 — 2026-04-02

### Verified

- Audited AI Tools node against updated n8n AI Tools standards (April 2026)
- Confirmed compliance: 3-layer write safety, envelope standard, metadata stripping (all 8 fields), null/empty guards, MCP tool naming, Zod `.describe()` coverage, dual-path `execute()` dispatch, module-level `getRuntimeSchemaBuilders()`, anchor candidates

### No changes required

- All structural, schema, description, and cross-reference checks passed

---

## 0.4.1 — 2026-03-16

### Fixed

- Added missing codex metadata files (`ConnectWiseCpq.node.json`, `ConnectWiseCpqAiTools.node.json`)
- Removed duplicate `sourceMap` key in `tsconfig.json`
- Removed unused Prettier dependency and `format` script

---

## 0.4.0 — 2026-03-13

### Breaking Changes

- **Removed `expiredOnly` toggle from Quotes getAll** — Existing workflows using this parameter must replace it with a date filter row on `expirationDate` using the "Before Date" preset (or "On Date" for exact matches). This was removed because the new date presets make it redundant.

### Added

- **Date presets for filters** — When Value Type is set to "Date", the Operator and Value fields are replaced by a Date Preset dropdown with 34 options:
  - **Exact day:** Today, Yesterday, Tomorrow
  - **Past rolling windows:** Last 7/14/30/45/60/90/120/180 Days
  - **Past calendar periods:** This Week, Last Week, This Month, Last Month, This Quarter, Last Quarter, This Year, Last Year
  - **Future rolling windows:** Next 7/14/30/45/60/90/120/180 Days
  - **Future calendar periods:** Next Week, Next Month, Next Quarter
  - **Custom:** On Date, Before Date, After Date, Custom Range (with date pickers)
  - All presets resolve at execution time relative to today. Multi-fragment presets (ranges) are AND-grouped and wrapped in parentheses when the filter combinator is OR.
- **`resolveDatePreset()` helper** in `GenericFunctions.ts` — date arithmetic engine with helpers for week/month/quarter/year boundaries (Monday-based ISO weeks).

### Changed

- **Filter combinator renamed** — "Filter Combinator" → "Combine Filters Using" and moved to appear after the Filters block instead of before it.
- **Filter notice simplified** — Reduced to a single sentence pointing users to use filters and noting the reference field syntax.

### Internal

- `buildFiltersFromUi()` extended with date preset branch — checks for `datePreset` on datetime rows, calls `resolveDatePreset()`, falls through to legacy operator+value path when `datePreset` is absent (backward compatible).
- Date arithmetic helpers added to `GenericFunctions.ts`: `formatDateOnly`, `addDays`, `startOfWeek`, `endOfWeek`, `startOfMonth`, `endOfMonth`, `startOfQuarter`, `endOfQuarter`.

---

## 0.3.1 — 2026-03-13

### Changed

- **AI Tools: Result envelope standard (v2)** — All tool responses now use a unified envelope with `schemaVersion: "1"`, `success` boolean, `resource`, and `operation` fields. Success responses wrap results in `wrapSuccess()`, errors in `wrapError()` with typed `ERROR_TYPES` constants. This gives LLMs a consistent, parseable response shape across all resources and operations.
- **AI Tools: getAll `results` → `items`** — The `result` field key for listing operations changed from `results` to `items` to align with the envelope standard. MCP clients or cached prompts referencing `results` should update to `items`.
- **AI Tools: Three-layer write safety enforcement** — Write operations are now blocked with a structured `WRITE_OPERATION_BLOCKED` error in all three execution paths (`supplyData()`, `func()`, `execute()`). Previously, the `execute()` path silently fell back to a default read operation when a write was blocked.
- **AI Tools: `closeAsLost`, `closeAsNoDecision`, `closeAsWon` classified as write operations** — These PATCH-based operations are now gated by the `allowWriteOperations` toggle (previously they were always exposed regardless of the toggle).
- **AI Tools: Hardened runtime anchor resolution** — `runtime.ts` now tries an `ANCHOR_CANDIDATES` array (`@langchain/classic/agents`, `langchain/agents`) with fail-fast diagnostics instead of silently falling back to the community node's bundled copy.
- **AI Tools: MCP tool annotations** — Tools now include `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` annotations (future-ready for when n8n/LangChain surface them to MCP clients).
- **AI Tools: Safety language in descriptions** — `delete`/`deleteVersion` descriptions now include "ONLY on explicit user intent. Do not infer from context." `create`/`update`/`replace` descriptions now include "Confirm field values with user before executing when acting autonomously."
- **AI Tools: Default case uses `INVALID_OPERATION`** — All executor switch-default cases now return `wrapError(..., ERROR_TYPES.INVALID_OPERATION)` instead of the previous `UNSUPPORTED_OPERATION` flat error.

### Fixed

- **AI Tools: `root` metadata stripping in `execute()` path** — The `execute()` path now strips the n8n-injected `root` canvas UUID from item JSON before passing to the executor. Previously, `root` could leak into API request bodies causing 400 errors.

---

## 0.3.0 — 2026-03-12

### Added

- **ConnectWise CPQ AI Tools node** (`ConnectWiseCpqAiTools`) — a new companion node that exposes all 9 CPQ resources as AI tools for the n8n AI Agent and MCP Trigger (including queue mode).
  - One unified `DynamicStructuredTool` per resource with a required `operation` enum field in the schema — ensures reliable dispatch through all execution paths, including MCP Trigger queue mode.
  - Resources exposed: Quote, Quote Item, Quote Customer, Quote Tab, Quote Term, Recurring Revenue, Tax Code, Template, User.
  - All filter/listing operations accept a raw `conditions` string (CPQ filter syntax, e.g. `name = "Acme" and closedFlag = True`).
  - PATCH operations accept an `updatePatch` JSON array (`[{"field":"name","value":"Acme"}]`) and route through the existing `castUpdateValue` type-casting logic.
  - `allowWriteOperations` toggle (default off) gates mutating operations (create, update, delete, replace, copy, deleteVersion) — safe-by-default for read-only agent use.
  - LLM-optimised tool descriptions with CPQ conditions syntax reminders and `updatePatch` format hints.
  - Structured error responses with `nextAction` guidance to help agents self-correct (e.g. `NO_RESULTS_FOUND`, `MISSING_ENTITY_ID`, `ENTITY_NOT_FOUND`).
  - Runtime Zod and `DynamicStructuredTool` resolved from n8n's own module tree via `createRequire` — fixes silent `instanceof` failures that break MCP Trigger tool registration.

### Internal

- `QUOTE_FIELD_TYPES`, `QUOTE_ITEM_FIELD_TYPES`, `CUSTOMER_FIELD_TYPES`, `QUOTE_TERM_FIELD_TYPES`, `USER_FIELD_TYPES` constants in their respective resource files are now exported (previously private) so they can be reused by the AI Tools executor.
- Added `@langchain/core` and `zod` as `devDependencies` (TypeScript types only; runtime instances come from n8n's module tree).

---

## 0.2.0 — 2026-03-03

### Breaking Changes

- **Filter UX redesign** — The three old "Get Many" filter parameters (`conditions`, `conditionsUi`, `conditionsLogic`) have been replaced with a cleaner set of four parameters:
  - `filters` — fixedCollection with rows: Field → Operator → Value Type → Value
  - `filterLogic` — AND/OR combinator (replaces `conditionsLogic`)
  - `additionalOptions.rawConditions` — advanced raw conditions string (replaces the top-level `conditions` field)
  - `filterNotice` — informational banner (no data)
- Existing workflows that used the old `conditions`, `conditionsUi`, or `conditionsLogic` parameters **must be reconfigured** after upgrading.
- `in` / `not in` operators now split the single `value` field on commas instead of requiring a separate `values` field.
- `valueType: 'list'` option removed; list formatting is now triggered automatically by the `in`/`not in` operator choice.
- Reference subfield filtering: type `field/subfield` directly in the Field input (no separate `referenceSubfield` field).
- **Patch UX redesign** — The raw "Patch Operations (JSON)" text field has been replaced with a user-friendly "Fields to Update" collection on all patch resources (quotes, quoteItems, quoteTerms, quoteCustomers, user). Existing workflows that passed raw JSON patch arrays **must be reconfigured**.

### Changed

- **All patch resources:** Users now select a field from a searchable dropdown and enter a value; the node builds the JSON Patch array automatically. Boolean values: `true`/`false`. Number values: digits only. Date values: ISO format (`YYYY-MM-DD`).

### Fixed

- **Update field validation** — Integer and number inputs now reject partial numeric strings (e.g. `"42abc"`) with a clear error instead of silently truncating to `42`.
- **Update field safety** — Removed `id` (primary key) from the "Fields to Update" dropdown on all patch resources to prevent accidental record corruption. Relation IDs (`idQuote`, `idQuoteTabs`, etc.) are still available.

### Internal

- `buildConditionsFromUi` in `GenericFunctions.ts` replaced by `buildFiltersFromUi` with simplified signature: `(filters, logic, rawConditions)`.
- Added `castUpdateValue` to `GenericFunctions.ts`: casts string UI inputs to the correct JSON type for patch bodies, with regex-validated integer/number parsing.

---

## 0.1.2 — 2026-03-03

### Fixed

- **quoteCustomers getAll** — replaced bare single-page `cpqApiRequest` call with `cpqApiRequestAllItems`; now honours `returnAll`, `limit`, `pageSize`, `conditions`, Condition Builder, and `includeFields` parameters (silently truncated to one page previously).
- **templates getAll** — same fix; now fully paginated with conditions and `includeFields` support.
- **quoteTabs getItems** — replaced single-page `cpqApiRequest` with `cpqApiRequestAllItems` to prevent silent truncation on tabs with many items.
- **quoteTabs showAllVersions default** — corrected default from `true` to `false` to match all other resources (was silently returning archived/deleted tabs).
- **Condition Builder string escaping** — fixed inverted regex in `buildConditionsFromUi`: `string` and `list` value types now correctly escape embedded `"` characters (`"` → `\"`) instead of un-escaping them (which produced malformed API condition strings).

### Changed

- **Debug logging** — `username` field in debug output is now masked as `accessKey+***` unless `debugShowAuthToken` is set (was logged in plain text).
- **quoteTerms Patch Operations field** — added missing `description` hint to match `quoteItems` and `quoteCustomers`.
- **Code comments** — added cross-reference notes between `GenericFunctions.ts` and `ConnectWiseCpqApi.credentials.ts` auth-build logic; added explanation for `templates → QuoteView` mapping (no `TemplatesView` exists in the SellAPI spec).

## 0.1.1 — 2025-08-13

- Fixed: Condition Builder field options not loading for get-many operations by wiring the Field selector to the dynamic include-fields loader (resource-aware).

## 0.1.0 — 2025-08-12

- Intial build
- Supported endpoints and operations:
  - Quotes
    - GET `/api/quotes` (list; supports `conditions`, `includeFields`, `showAllVersions`, pagination)
    - GET `/api/quotes/{id}` (retrieve)
    - DELETE `/api/quotes/{id}` (delete)
  - QuoteItems
    - GET `/api/quoteItems` (list; filters + pagination)
    - POST `/api/quoteItems` (create)
    - PATCH `/api/quoteItems/{id}` (update via JSON Patch)
    - DELETE `/api/quoteItems/{id}` (delete)
  - QuoteCustomers
    - GET `/api/quotes/{quoteId}/customers` (list)
    - PUT `/api/quotes/{quoteId}/customers/{id}` (replace/update)
    - PATCH `/api/quotes/{quoteId}/customers/{id}` (partial update)
    - DELETE `/api/quotes/{quoteId}/customers/{id}` (delete)
  - QuoteTabs
    - GET `/api/quoteTabs` (list)
    - GET `/api/quoteTabs/{id}/quoteItems` (list items by tab)
  - QuoteTerms
    - GET `/api/quotes/{quoteId}/quoteTerms` (list)
    - POST `/api/quotes/{quoteId}/quoteTerms` (create)
    - PATCH `/api/quotes/{quoteId}/quoteTerms/{id}` (update)
    - DELETE `/api/quotes/{quoteId}/quoteTerms/{id}` (delete)
  - RecurringRevenues
    - GET `/api/recurringRevenues` (list)
  - TaxCodes
    - GET `/api/taxCodes` (list)
  - Templates
    - GET `/api/templates` (list)
  - User
    - GET `/settings/user` (list/read)
    - PATCH `/settings/user/{id}` (update)
