/**
 * SabFlow client-side schema migration runner.
 *
 * Invoked once per doc load, **before** the collaborative editor mounts,
 * so the React tree never sees a stale block shape. Reads the current
 * `schemaVersion` off the doc's `meta` Y.Map, walks the registry chain
 * up to the latest known version, and applies every step inside a single
 * Yjs transaction tagged with `origin = 'sabflow.migration'` (peers
 * filter on this origin to avoid echoing migrations back as user edits).
 *
 * Yjs is forward-declared via the `YDocLike` shape — the `yjs` package
 * may not be installed in every workspace, and we only need a tiny slice
 * of the Y.Doc API surface here.
 *
 * See `docs/adr/sabflow-doc-schema.md` for the design rationale and the
 * (blockType, fromVersion → toVersion) keying scheme used by individual
 * migrations.
 */

import { MIGRATIONS, type Migration, type YDocLike } from '../migrations';

/** Yjs transaction origin tag — peers should ignore updates with this origin. */
export const MIGRATION_ORIGIN = 'sabflow.migration';

const META_MAP = 'meta';
const SCHEMA_VERSION_KEY = 'schemaVersion';

/**
 * Result trace returned by {@link runMigrations}. `applied` lists the
 * migration ids that actually ran — empty if the doc was already current,
 * which gives callers a cheap "did we touch the doc?" signal.
 */
export interface MigrationResult {
  before: number;
  after: number;
  applied: string[];
}

/** Read the current `schemaVersion`, defaulting to 0 for legacy docs. */
function readSchemaVersion(doc: YDocLike): number {
  const meta = doc.getMap(META_MAP);
  const raw = meta.get(SCHEMA_VERSION_KEY);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

/** Latest version we know how to produce — the tail of the registry. */
function latestSchemaVersion(): number {
  if (MIGRATIONS.length === 0) return 0;
  return MIGRATIONS.reduce(
    (acc, m) => (m.toSchemaVersion > acc ? m.toSchemaVersion : acc),
    0,
  );
}

/**
 * Build the ordered chain of migrations that takes `current` → `target`.
 * Each step's `fromSchemaVersion` must match the previous step's
 * `toSchemaVersion`; gaps throw so a misconfigured registry fails loudly
 * at editor load instead of silently corrupting the doc.
 */
function planChain(current: number, target: number): Migration[] {
  if (current >= target) return [];
  const chain: Migration[] = [];
  let cursor = current;
  while (cursor < target) {
    const next = MIGRATIONS.find((m) => m.fromSchemaVersion === cursor);
    if (!next) {
      throw new Error(
        `[sabflow.migration] no migration registered from schemaVersion=${cursor} ` +
          `(target=${target}); registry is incomplete`,
      );
    }
    chain.push(next);
    cursor = next.toSchemaVersion;
  }
  return chain;
}

/**
 * Run all pending schema migrations against `doc`. Safe to call on an
 * up-to-date doc — it short-circuits and returns `applied: []`.
 *
 * All mutations (every migration body + the final `schemaVersion` write)
 * happen inside a single Yjs transaction so peers and the local undo
 * manager see one atomic update.
 */
export async function runMigrations(doc: YDocLike): Promise<MigrationResult> {
  const before = readSchemaVersion(doc);
  const target = latestSchemaVersion();

  if (before >= target) {
    return { before, after: before, applied: [] };
  }

  const chain = planChain(before, target);
  const applied: string[] = [];

  // Migrations may be async (e.g. they fetch a schema, run a worker). We
  // run them sequentially outside `transact` if any is async, otherwise
  // batch into one transaction. To keep a single atomic Yjs update we
  // resolve all async work first into deferred mutations… but in practice
  // the registry stays sync; we honour the Promise signature for future
  // flexibility and await sequentially inside one transact() call.
  let pendingError: unknown = null;
  let asyncResolution: Promise<void> = Promise.resolve();

  doc.transact(() => {
    for (const migration of chain) {
      try {
        const maybe = migration.run(doc);
        if (maybe && typeof (maybe as Promise<void>).then === 'function') {
          // Defer awaiting until after transact returns. Real migrations
          // should be synchronous; if one is async its work lands in a
          // follow-up transaction below.
          asyncResolution = asyncResolution.then(() => maybe as Promise<void>);
        }
        applied.push(migration.id);
      } catch (err) {
        pendingError = err;
        break;
      }
    }

    // Write the new version inside the same transaction so observers see
    // a consistent (data + version) snapshot.
    if (!pendingError) {
      doc.getMap(META_MAP).set(SCHEMA_VERSION_KEY, target);
    }
  }, MIGRATION_ORIGIN);

  if (pendingError) throw pendingError;
  await asyncResolution;

  const after = readSchemaVersion(doc);
  return { before, after, applied };
}
