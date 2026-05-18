/**
 * SabFlow doc-schema migration registry.
 *
 * Per `docs/adr/sabflow-doc-schema.md`, every collaborative SabFlow document
 * carries a top-level `schemaVersion` integer stored at
 * `doc.getMap('meta').get('schemaVersion')`. When the editor loads a doc it
 * runs the chain of migrations whose `fromSchemaVersion` matches the current
 * version, advancing through `toSchemaVersion` until it reaches the latest.
 *
 * Each entry below is a small, focused mutation — typically scoped to a
 * single `blockType`'s data shape (the (blockType, fromVersion → toVersion)
 * key from the ADR). The runner in `../client/schema-migrate.ts` orchestrates
 * them; this file is just the ordered list.
 *
 * Yjs is forward-declared so this module remains importable from any layer
 * (the `yjs` package may not be installed in every workspace yet).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Minimal structural shape of a Y.Doc we need at the migration boundary. */
export interface YDocLike {
  getMap(name: string): {
    get(key: string): any;
    set(key: string, value: any): any;
  };
  transact(fn: () => void, origin?: unknown): void;
}

/**
 * A single ordered transformation step.
 *
 * Migrations must be **idempotent within a chain** — i.e. if the doc already
 * sits past `toSchemaVersion`, the runner skips this entry entirely. The
 * `run` body itself should also tolerate a partially-migrated doc (defensive
 * lookups, default-on-missing) so a crash mid-chain can recover on retry.
 */
export interface Migration {
  /** Stable identifier, e.g. `meta.v0-v1.noop` or `httpRequest.v1-v2.renameHeadersField`. */
  id: string;
  /** Schema version this migration upgrades **from**. */
  fromSchemaVersion: number;
  /** Schema version the doc carries **after** the migration runs. */
  toSchemaVersion: number;
  /**
   * Apply the migration. Called inside a single Yjs transaction by the
   * runner — implementations should mutate the doc directly and must not
   * start their own transaction.
   */
  run(doc: YDocLike): void | Promise<void>;
}

/**
 * Example skeleton migration. v0 is the implicit starting version for docs
 * that pre-date the `schemaVersion` field; bumping to v1 just establishes
 * the meta map so future migrations have a stable place to read/write.
 *
 * Keep this in place even once real migrations land — it doubles as a
 * "smoke test" entry for the runner's empty-doc path.
 */
const noopV0toV1: Migration = {
  id: 'meta.v0-v1.noop',
  fromSchemaVersion: 0,
  toSchemaVersion: 1,
  run(_doc: YDocLike): void {
    // Intentional no-op. The runner is responsible for writing the new
    // schemaVersion back to the meta map after this returns.
  },
};

/**
 * Ordered list of migrations. The runner walks this array in order; gaps
 * (e.g. v2→v4 with no v3 entry) are not supported — each step must bridge
 * exactly one version.
 */
export const MIGRATIONS: Migration[] = [noopV0toV1];
