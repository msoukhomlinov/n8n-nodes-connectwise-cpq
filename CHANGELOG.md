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
