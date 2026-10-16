// Shared fixtures for the node's tests. Loaded as a module, not as a test file.
const DIST = '../dist/nodes/ConnectWiseCpq';

/** A minimal stand-in for an n8n execution context: records requests, scripts responses. */
function makeContext(responder) {
  const ctx = {
    requests: [],
    getNode: () => ({
      name: 'ConnectWiseCpq',
      type: 'n8n-nodes-base.connectWiseCpq',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }),
    getCredentials: async () => ({
      accessKey: 'ACCESS',
      publicKey: 'PUBLIC',
      privateKey: 'PRIVATE',
      baseUrl: 'https://vendor.invalid',
    }),
    helpers: {
      httpRequest: async (options) => {
        ctx.requests.push(options);
        return responder(options, ctx.requests.length);
      },
    },
  };
  return ctx;
}

/** A page of `count` records, as the vendor list endpoints return them. */
function page(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `id-${i}`, name: `Quote ${i}` }));
}

module.exports = { DIST, makeContext, page };
