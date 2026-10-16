// Fix 1 — the paging loop must terminate for every caller input, and every read must carry a
// client-side timeout. Runs against the compiled output (`npm test` builds first).
const { test } = require('node:test');
const assert = require('node:assert');

const { makeContext, page } = require('./support.js');
const {
  cpqApiRequest,
  cpqApiRequestAllItems,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_PAGES,
} = require('../dist/nodes/ConnectWiseCpq/GenericFunctions.js');

const callLoop = (ctx, limit, pageSize) =>
  cpqApiRequestAllItems.call(ctx, '', 'GET', '/api/quotes', {}, {}, {}, limit, pageSize);

test('limit 0 with pageSize 0 terminates instead of dialing the vendor forever', async () => {
  // A full page on every call, so the short-page break can never fire: only the page bound can
  // stop this walk. Before the fix this combination (`limit = 0` from an expression) looped with
  // no bound at all.
  const ctx = makeContext(() => page(50));

  await assert.rejects(
    () => callLoop(ctx, 0, 0),
    /page bound was reached and the list is not exhausted/,
  );

  assert.strictEqual(
    ctx.requests.length,
    MAX_PAGES,
    'the walk must stop after MAX_PAGES vendor calls',
  );
  assert.deepStrictEqual(
    ctx.requests.map((r) => r.qs.page),
    Array.from({ length: MAX_PAGES }, (_, i) => i + 1),
    'pages must be numbered consecutively from 1',
  );
});

test('an out-of-contract page size never reaches the vendor below 1', async () => {
  for (const pageSize of [0, -5, NaN, 0.4, '0', 1.9]) {
    const ctx = makeContext(() => page(50));
    await assert.rejects(() => callLoop(ctx, 0, pageSize));
    for (const request of ctx.requests) {
      assert.ok(
        Number.isInteger(request.qs.pageSize) && request.qs.pageSize >= 1,
        `pageSize ${String(pageSize)} was sent to the vendor as ${String(request.qs.pageSize)}`,
      );
    }
  }
});

test('a short page still ends the walk, and the records survive', async () => {
  const ctx = makeContext(() => page(3));
  const records = await callLoop(ctx, 0, 0);
  assert.strictEqual(ctx.requests.length, 1);
  assert.strictEqual(records.length, 3);
});

test('a positive limit still caps the result exactly', async () => {
  const ctx = makeContext(() => page(3));
  const records = await callLoop(ctx, 7, 3);
  assert.strictEqual(records.length, 7);
  assert.strictEqual(ctx.requests.length, 3);
});

test('every request carries the client-side timeout, and options may override it', async () => {
  const ctx = makeContext(() => page(1));
  await cpqApiRequest.call(ctx, 'GET', '/api/quotes');
  assert.strictEqual(ctx.requests[0].timeout, DEFAULT_REQUEST_TIMEOUT_MS);

  const withOptions = makeContext(() => page(1));
  await cpqApiRequest.call(withOptions, 'GET', '/api/quotes', undefined, undefined, { timeout: 1234 });
  assert.strictEqual(withOptions.requests[0].timeout, 1234);
});

// ── The audit-cited reachable path: the regular node's getAll with limit 0 ──────────────

const { executeQuotes } = require('../dist/nodes/ConnectWiseCpq/resources/quotes.resource.js');

function quotesContext(responder, overrides = {}) {
  const params = {
    operation: 'getAll',
    returnAll: false,
    pageSize: 50,
    limit: 100,
    filters: {},
    filterLogic: 'and',
    additionalOptions: {},
    includeFields: '',
    showAllVersions: false,
    quoteStatus: 'all',
    idFormat: 'all',
    ...overrides,
  };
  const ctx = makeContext(responder);
  ctx.getNodeParameter = (name, _itemIndex, fallback) => (name in params ? params[name] : fallback);
  return ctx;
}

test('regular node getAll with an expression-driven limit of 0 terminates', async () => {
  // `effectivePageSize = Math.min(limit, MAX_PAGE_SIZE)` is 0 here, which used to make both of
  // the loop's breaks unreachable: the UI's minValue: 1 does not constrain an expression.
  const ctx = quotesContext(() => page(50), { limit: 0 });

  await assert.rejects(
    () => executeQuotes.call(ctx, 0, []),
    /page bound was reached and the list is not exhausted/,
  );
  assert.strictEqual(ctx.requests.length, MAX_PAGES);
});

test('regular node getAll with the UI default limit still returns exactly that many', async () => {
  const ctx = quotesContext(() => page(50), { limit: 50 });
  const out = [];

  await executeQuotes.call(ctx, 0, out);

  assert.strictEqual(out.length, 50);
  assert.strictEqual(ctx.requests.length, 1);
});
