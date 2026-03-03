# Patch UX: Fields-to-Update fixedCollection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the raw "Patch Operations (JSON)" text field on all 5 patchable resources with a user-friendly `fixedCollection` that lets users pick fields from a dropdown and type values — the node builds the JSON Patch array automatically.

**Architecture:** Each resource file gets a `updateFields` fixedCollection parameter (field dropdown + value string) replacing `patchOperations`. A static `FIELD_TYPES` const per resource drives auto-casting via a new `castUpdateValue()` helper in `GenericFunctions.ts`. The `prepareJsonPatch()` call is unchanged — only the input changes.

**Tech Stack:** TypeScript, n8n INodeProperties, n8n `fixedCollection` UI element, Swagger spec at `.docs/references/SellAPI.json`

---

## Context for Implementer

### Affected files
- `nodes/ConnectWiseCpq/GenericFunctions.ts` — add `castUpdateValue`
- `nodes/ConnectWiseCpq/resources/quotes.resource.ts`
- `nodes/ConnectWiseCpq/resources/quoteItems.resource.ts`
- `nodes/ConnectWiseCpq/resources/quoteTerms.resource.ts`
- `nodes/ConnectWiseCpq/resources/quoteCustomers.resource.ts`
- `nodes/ConnectWiseCpq/resources/user.resource.ts`

### No tests exist in this project
There are no automated tests. Manual verification = build succeeds + lint passes. After each task, run:
```bash
npm run build && npm run lint
```
Expected: zero errors.

### How `fixedCollection` works in n8n

```ts
{
  displayName: 'Fields to Update',
  name: 'updateFields',
  type: 'fixedCollection',
  typeOptions: { multipleValues: true },
  placeholder: 'Add Field',
  default: {},
  required: true,
  displayOptions: { show: { resource: ['quotes'], operation: ['update'] } },
  description: 'Fields to update on the resource',
  options: [
    {
      name: 'values',
      displayName: 'Field',
      values: [
        {
          displayName: 'Field',
          name: 'field',
          type: 'options',
          options: [ /* INodePropertyOption[] */ ],
          default: '',
          description: 'The field to update',
        },
        {
          displayName: 'Value',
          name: 'value',
          type: 'string',
          default: '',
          description: 'The new value. For boolean fields use "true" or "false". For date fields use ISO format (YYYY-MM-DD).',
        },
      ],
    },
  ],
}
```

Reading in execute:
```ts
const updateFields = this.getNodeParameter('updateFields', i, {}) as {
  values?: Array<{ field: string; value: string }>;
};
const rows = updateFields.values ?? [];
```

### How `castUpdateValue` is used

```ts
import { castUpdateValue } from '../GenericFunctions';

const FIELD_TYPES: Record<string, string> = {
  name: 'string',
  quoteNumber: 'integer',
  grossMargin: 'number',
  isArchive: 'boolean',
  // ... all fields
};

const ops = rows.map(({ field, value }) => ({
  op: 'replace',
  path: `/${field}`,
  value: castUpdateValue(this.getNode(), i, value, FIELD_TYPES[field] ?? 'string'),
}));
const patchBody = prepareJsonPatch(ops);
```

### Field/type generation script

Run this to regenerate options arrays and type maps if needed:

```bash
node << 'SCRIPT'
const spec = require('./.docs/references/SellAPI.json');
function title(s) { return s.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()).trim(); }
function gen(defName) {
  const props = spec.definitions[defName]?.properties ?? {};
  const entries = Object.entries(props)
    .filter(([,p]) => p.type && p.type !== 'object')
    .sort(([a],[b]) => a.localeCompare(b));
  const opts = entries.map(([k]) => `          { name: '${title(k)}', value: '${k}' },`).join('\n');
  const tmap = entries.map(([k,p]) => {
    const t = p.format==='date-time' ? 'string' : p.format==='int32' ? 'integer' : p.type;
    return `  ${k}: '${t}',`;
  }).join('\n');
  console.log('OPTIONS:\n' + opts + '\n\nTYPEMAP:\n' + tmap + '\n');
}
gen('QuoteView'); // change to QuoteItemView / QuoteTermView / CustomerView / UserView
SCRIPT
```

Pre-generated output is in `docs/plans/_gen_*.txt`.

---

## Task 1: Add `castUpdateValue` to GenericFunctions.ts

**Files:**
- Modify: `nodes/ConnectWiseCpq/GenericFunctions.ts`

**Step 1: Add the function**

Append this export to the end of `GenericFunctions.ts` (after `formatSingleValue`):

```ts
/**
 * Cast a string value from the fixedCollection UI to the correct JSON type
 * for a JSON Patch body, based on the field's Swagger type.
 *
 * @throws NodeOperationError when a numeric field cannot be parsed
 */
export function castUpdateValue(
  node: import('n8n-workflow').INode,
  itemIndex: number,
  value: string,
  type: string,
): unknown {
  switch (type) {
    case 'boolean':
      return /^true$/i.test(value);
    case 'integer': {
      const n = parseInt(value, 10);
      if (Number.isNaN(n)) {
        throw new (require('n8n-workflow').NodeOperationError)(
          node,
          `Cannot parse "${value}" as integer.`,
          { itemIndex },
        );
      }
      return n;
    }
    case 'number': {
      const n = parseFloat(value);
      if (Number.isNaN(n)) {
        throw new (require('n8n-workflow').NodeOperationError)(
          node,
          `Cannot parse "${value}" as number.`,
          { itemIndex },
        );
      }
      return n;
    }
    default:
      return value;
  }
}
```

> **Note on imports:** `NodeOperationError` is already imported at the top of GenericFunctions.ts — you can use it directly instead of `require`. Check the existing imports at line 1 and adjust accordingly. The proper way:

```ts
import { ..., NodeOperationError } from 'n8n-workflow';

export function castUpdateValue(
  node: import('n8n-workflow').INode,
  itemIndex: number,
  value: string,
  type: string,
): unknown {
  switch (type) {
    case 'boolean':
      return /^true$/i.test(value);
    case 'integer': {
      const n = parseInt(value, 10);
      if (Number.isNaN(n)) throw new NodeOperationError(node, `Cannot parse "${value}" as integer.`, { itemIndex });
      return n;
    }
    case 'number': {
      const n = parseFloat(value);
      if (Number.isNaN(n)) throw new NodeOperationError(node, `Cannot parse "${value}" as number.`, { itemIndex });
      return n;
    }
    default:
      return value;
  }
}
```

**Step 2: Verify build**
```bash
npm run build
```
Expected: `dist/` updated, no errors.

**Step 3: Commit**
```bash
git add nodes/ConnectWiseCpq/GenericFunctions.ts
git commit -m "feat: add castUpdateValue helper for patch UX"
```

---

## Task 2: Update `quotes.resource.ts`

**Files:**
- Modify: `nodes/ConnectWiseCpq/resources/quotes.resource.ts`

The `quotes` resource patches `QuoteView` (200 fields).

**Step 1: Update the import line**

In `quotes.resource.ts`, the current import is:
```ts
import { cpqApiRequest, cpqApiRequestAllItems, buildFiltersFromUi, prepareJsonPatch } from '../GenericFunctions';
```

Change to:
```ts
import { cpqApiRequest, cpqApiRequestAllItems, buildFiltersFromUi, prepareJsonPatch, castUpdateValue } from '../GenericFunctions';
```

**Step 2: Add FIELD_TYPES constant**

Add this constant just before `export const quotesOperations`. The full content is in `docs/plans/_gen_quotes.txt` under `TYPEMAP:`. Copy all those lines into this structure:

```ts
const QUOTE_FIELD_TYPES: Record<string, string> = {
  // paste TYPEMAP lines here from docs/plans/_gen_quotes.txt
};
```

Example of what the first lines look like:
```ts
const QUOTE_FIELD_TYPES: Record<string, string> = {
  accountName: 'string',
  approvalAmount: 'number',
  approvalComment: 'string',
  approvalMargin: 'number',
  approvalMode: 'string',
  // ... 195 more lines from _gen_quotes.txt
};
```

**Step 3: Replace the `patchOperations` field in `quotesFields`**

Find and remove this entry from `quotesFields`:
```ts
  {
    displayName: 'Patch Operations (JSON)',
    name: 'patchOperations',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'JSON Patch array, e.g. [{"op":"replace","path":"/name","value":"New Name"}]',
    displayOptions: { show: { resource: ['quotes'], operation: ['update'] } },
  },
```

Replace with:
```ts
  {
    displayName: 'Fields to Update',
    name: 'updateFields',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    placeholder: 'Add Field',
    default: {},
    required: true,
    description: 'Fields to update on the quote. For boolean fields use "true" or "false". For date fields use ISO format (YYYY-MM-DD).',
    displayOptions: { show: { resource: ['quotes'], operation: ['update'] } },
    options: [
      {
        name: 'values',
        displayName: 'Field',
        values: [
          {
            displayName: 'Field',
            name: 'field',
            type: 'options',
            options: [
              // paste OPTIONS lines here from docs/plans/_gen_quotes.txt
            ],
            default: 'name',
            description: 'The quote field to update',
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'The new value for the field',
          },
        ],
      },
    ],
  },
```

**Step 4: Update the `update` execute block**

Find this block (around line 196):
```ts
  if (operation === 'update') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const patchOperations = this.getNodeParameter('patchOperations', i) as string;
    let opsRaw: Array<{ op: string; path: string; value?: unknown; from?: string }>;
    try {
      opsRaw = patchOperations ? JSON.parse(patchOperations) : [];
    } catch {
      throw new NodeOperationError(
        this.getNode(),
        'Patch Operations is not valid JSON. Ensure the value is a JSON array.',
        { itemIndex: i },
      );
    }
    if (opsRaw.length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'Patch Operations must not be empty for the Update operation.',
        { itemIndex: i },
      );
    }
    const patchBody = prepareJsonPatch(opsRaw);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}`, patchBody)) as IDataObject;
    returnData.push({ json: res });
  }
```

Replace with:
```ts
  if (operation === 'update') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const updateFields = this.getNodeParameter('updateFields', i, {}) as {
      values?: Array<{ field: string; value: string }>;
    };
    const rows = updateFields.values ?? [];
    if (rows.length === 0) {
      throw new NodeOperationError(
        this.getNode(),
        'Add at least one field to update.',
        { itemIndex: i },
      );
    }
    const ops = rows.map(({ field, value }) => ({
      op: 'replace' as const,
      path: `/${field}`,
      value: castUpdateValue(this.getNode(), i, value, QUOTE_FIELD_TYPES[field] ?? 'string'),
    }));
    const patchBody = prepareJsonPatch(ops);
    const res = (await cpqApiRequest.call(this, 'PATCH', `/api/quotes/${encodeURIComponent(quoteId)}`, patchBody)) as IDataObject;
    returnData.push({ json: res });
  }
```

**Step 5: Build and lint**
```bash
npm run build && npm run lint
```
Expected: no errors.

**Step 6: Commit**
```bash
git add nodes/ConnectWiseCpq/resources/quotes.resource.ts
git commit -m "feat(quotes): replace raw patch JSON with fields-to-update UI"
```

---

## Task 3: Update `quoteItems.resource.ts`

**Files:**
- Modify: `nodes/ConnectWiseCpq/resources/quoteItems.resource.ts`

QuoteItemView has 222 fields. Pre-generated in `docs/plans/_gen_quoteItems.txt`.

**Step 1: Update import**

Add `castUpdateValue` to the import:
```ts
import { cpqApiRequest, cpqApiRequestAllItems, prepareJsonPatch, buildFiltersFromUi, castUpdateValue } from '../GenericFunctions';
```

**Step 2: Add FIELD_TYPES constant**

Before `export const quoteItemsOperations`, add:
```ts
const QUOTE_ITEM_FIELD_TYPES: Record<string, string> = {
  // paste TYPEMAP lines from docs/plans/_gen_quoteItems.txt
};
```

**Step 3: Replace `patchOperations` in `quoteItemsFields`**

Remove:
```ts
  {
    displayName: 'Patch Operations (JSON)',
    name: 'patchOperations',
    type: 'string',
    typeOptions: { rows: 6 },
    default: '',
    required: true,
    description: 'JSON Patch array, e.g. [{"op":"replace","path":"/quantity","value":2}]',
    displayOptions: { show: { resource: ['quoteItems'], operation: ['update'] } },
  },
```

Add:
```ts
  {
    displayName: 'Fields to Update',
    name: 'updateFields',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    placeholder: 'Add Field',
    default: {},
    required: true,
    description: 'Fields to update on the quote item. For boolean fields use "true" or "false". For date fields use ISO format (YYYY-MM-DD).',
    displayOptions: { show: { resource: ['quoteItems'], operation: ['update'] } },
    options: [
      {
        name: 'values',
        displayName: 'Field',
        values: [
          {
            displayName: 'Field',
            name: 'field',
            type: 'options',
            options: [
              // paste OPTIONS lines from docs/plans/_gen_quoteItems.txt
            ],
            default: 'id',
            description: 'The quote item field to update',
          },
          {
            displayName: 'Value',
            name: 'value',
            type: 'string',
            default: '',
            description: 'The new value for the field',
          },
        ],
      },
    ],
  },
```

**Step 4: Read the execute block for update in quoteItems**

Find and read the current `update` block (it will look similar to quotes). Replace `patchOperations` parsing with:

```ts
  if (operation === 'update') {
    const quoteId = this.getNodeParameter('quoteId', i) as string;
    const id = this.getNodeParameter('id', i) as string;
    const updateFields = this.getNodeParameter('updateFields', i, {}) as {
      values?: Array<{ field: string; value: string }>;
    };
    const rows = updateFields.values ?? [];
    if (rows.length === 0) {
      throw new NodeOperationError(this.getNode(), 'Add at least one field to update.', { itemIndex: i });
    }
    const ops = rows.map(({ field, value }) => ({
      op: 'replace' as const,
      path: `/${field}`,
      value: castUpdateValue(this.getNode(), i, value, QUOTE_ITEM_FIELD_TYPES[field] ?? 'string'),
    }));
    const patchBody = prepareJsonPatch(ops);
    const res = (await cpqApiRequest.call(
      this,
      'PATCH',
      `/api/quotes/${encodeURIComponent(quoteId)}/items/${encodeURIComponent(id)}`,
      patchBody,
    )) as IDataObject;
    returnData.push({ json: res });
  }
```

> **Important:** First read the existing execute block to verify the API endpoint URL (it should be `/api/quotes/{quoteId}/items/{id}` — confirm before pasting).

**Step 5: Build and lint**
```bash
npm run build && npm run lint
```

**Step 6: Commit**
```bash
git add nodes/ConnectWiseCpq/resources/quoteItems.resource.ts
git commit -m "feat(quoteItems): replace raw patch JSON with fields-to-update UI"
```

---

## Task 4: Update `quoteTerms.resource.ts`

**Files:**
- Modify: `nodes/ConnectWiseCpq/resources/quoteTerms.resource.ts`

QuoteTermView has 61 fields. Pre-generated in `docs/plans/_gen_quoteTerms.txt`.

Apply the same pattern as Tasks 2–3:

1. Add `castUpdateValue` to import
2. Add `QUOTE_TERM_FIELD_TYPES` constant from `_gen_quoteTerms.txt` TYPEMAP section
3. Replace `patchOperations` field with `updateFields` fixedCollection (options from `_gen_quoteTerms.txt` OPTIONS section, `displayOptions: { show: { resource: ['quoteTerms'], operation: ['update'] } }`)
4. Update execute block — read existing to get the correct endpoint URL, then replace `patchOperations` parsing with the `updateFields` pattern

**Step 5: Build and lint**
```bash
npm run build && npm run lint
```

**Step 6: Commit**
```bash
git add nodes/ConnectWiseCpq/resources/quoteTerms.resource.ts
git commit -m "feat(quoteTerms): replace raw patch JSON with fields-to-update UI"
```

---

## Task 5: Update `quoteCustomers.resource.ts`

**Files:**
- Modify: `nodes/ConnectWiseCpq/resources/quoteCustomers.resource.ts`

CustomerView has 32 fields. Pre-generated in `docs/plans/_gen_quoteCustomers.txt`.

**Important context:** First read the existing file — `quoteCustomers` has both a `replace` operation (full PUT) and an `update` operation (PATCH). Only the `update` operation uses `patchOperations`. The `customerJson` field (for `replace`) stays untouched.

Apply the same pattern:

1. Add `castUpdateValue` to import
2. Add `CUSTOMER_FIELD_TYPES` constant from `_gen_quoteCustomers.txt` TYPEMAP section
3. Replace `patchOperations` field (the one with `operation: ['update']`) with `updateFields` fixedCollection (options from OPTIONS section, `displayOptions: { show: { resource: ['quoteCustomers'], operation: ['update'] } }`)
4. Update the `update` execute block (confirm endpoint URL from existing code)

**Step 5: Build and lint**
```bash
npm run build && npm run lint
```

**Step 6: Commit**
```bash
git add nodes/ConnectWiseCpq/resources/quoteCustomers.resource.ts
git commit -m "feat(quoteCustomers): replace raw patch JSON with fields-to-update UI"
```

---

## Task 6: Update `user.resource.ts`

**Files:**
- Modify: `nodes/ConnectWiseCpq/resources/user.resource.ts`

UserView has 39 fields. Pre-generated in `docs/plans/_gen_user.txt`.

Apply the same pattern:

1. Add `castUpdateValue` to import
2. Add `USER_FIELD_TYPES` constant from `_gen_user.txt` TYPEMAP section
3. Replace `patchOperations` with `updateFields` fixedCollection (`displayOptions: { show: { resource: ['user'], operation: ['update'] } }`)
4. Update execute block

**Step 5: Build and lint**
```bash
npm run build && npm run lint
```

**Step 6: Commit**
```bash
git add nodes/ConnectWiseCpq/resources/user.resource.ts
git commit -m "feat(user): replace raw patch JSON with fields-to-update UI"
```

---

## Task 7: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

Add a new entry at the top of the changelog (check existing format):

```markdown
## [Unreleased]

### Changed
- **All patch resources (quotes, quoteItems, quoteTerms, quoteCustomers, user):** Replaced the raw "Patch Operations (JSON)" text field with a user-friendly "Fields to Update" collection. Users now select a field from a searchable dropdown and enter a value — the node builds the JSON Patch array automatically. Boolean values: use `true`/`false`. Date values: use ISO format (`YYYY-MM-DD`).
```

**Commit:**
```bash
git add CHANGELOG.md
git commit -m "docs: update changelog for patch UX improvement"
```

---

## Task 8: Final verification

**Step 1: Full clean build**
```bash
npm run build
```
Expected: no errors, `dist/` updated.

**Step 2: Lint**
```bash
npm run lint
```
Expected: no errors or warnings.

**Step 3: Pre-publish check**
```bash
npm run prepublishOnly
```
Expected: passes completely.

**Step 4: Smoke-test checklist (manual, requires running n8n)**

If you have a running n8n instance with the node installed:

- [ ] quotes → Update: "Fields to Update" collection appears, field dropdown is searchable, adding 2+ rows works, execution sends correct PATCH body
- [ ] quoteItems → Update: same check
- [ ] quoteTerms → Update: same check
- [ ] quoteCustomers → Update: "Fields to Update" appears, `customerJson` (for replace op) is unaffected
- [ ] user → Update: same check
- [ ] All: empty collection shows NodeOperationError
- [ ] All: invalid number input (e.g. "abc" for a number field) shows NodeOperationError

**Step 5: Final commit (if any fixups)**
```bash
git add -A
git commit -m "fix: patch UX final adjustments"
```
