// Empty CommonJS shim that stands in for the `server-only` package during
// `node:test`-driven unit tests. Production code resolves the real package
// via Next.js's bundled copy; tsx + Node have no such resolver, so we map
// the import to this file via a `Module._resolveFilename` patch in the
// test bootstrap (see `idempotency.test.ts`).
module.exports = {};
