/**
 * Phase 2 — stage-1 backfill of Mongo `users` + `plans` into the
 * `sabnode_identity` Postgres schema (PLAN.md §3, "Backfill" stage).
 *
 * Reads the live Mongo collections through the project's existing
 * `connectToDatabase()` (`src/lib/mongodb.ts`) and writes them into Postgres:
 *
 *   • users → upserted via the C2 contract `pgUserStore.upsertByMongoId(...)`
 *     (keyed on `legacy_mongo_id` = the Mongo `_id` string), so this stage uses
 *     the exact same write path the dual-write code uses — no re-implementation.
 *   • plans → direct idempotent INSERT … ON CONFLICT into
 *     `sabnode_identity.plans`, preserving the Mongo `_id` string as
 *     `legacy_mongo_id` and stashing the full plan document in `data` (jsonb).
 *
 * Properties:
 *   • Idempotent — safe to re-run (both writes are upserts keyed on the Mongo id).
 *   • Batched — streams each collection in fixed-size chunks.
 *   • Observable — logs per-batch progress and a final reconciliation count.
 *   • Fails loud — exits non-zero on any error.
 *
 * INERT by default: nothing imports this module; it only does work when an
 * operator explicitly runs it. It reads Mongo and writes the dedicated
 * `sabnode_identity` Postgres schema; it does not change any live code path.
 *
 * Run with (Node ≥ 22, native TS strip + module hooks):
 *
 *   node --env-file=.env scripts/db/backfill-users.ts
 *   node --env-file=.env scripts/db/backfill-users.ts --batch=1000 --dry-run
 *
 * Requires env:
 *   MONGODB_URI, MONGODB_DB   (Mongo source — read by connectToDatabase)
 *   SABNODE_PG_URL            (Postgres target — read by the C1 pool via C2)
 *
 * Flags:
 *   --batch=<n>   chunk size (default 500)
 *   --dry-run     read + log counts only; perform no Postgres writes
 *
 * Implementation note: the C2 store (`src/lib/identity/pg-stores.ts`) and the C1
 * pool it uses both begin with `import 'server-only'`, a Next.js bundler marker
 * with no standalone Node module. To run the *real contract code* unmodified in
 * a plain Node process we register a loader hook (below) that (a) resolves
 * `server-only` to a no-op stub and (b) rewrites the `@/…` path alias to
 * `./src/…`, mirroring tsconfig `paths`. This keeps the backfill bound to the
 * committed contracts instead of duplicating their SQL.
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

/* ── repo + loader-hook bootstrap ──────────────────────────────
 * Register an in-process resolve hook so the contract modules' import graph
 * resolves under a bare Node runtime, then dynamically import them. We keep the
 * hook INSIDE this single owned file by encoding it as a `data:` URL (no second
 * file). The hook does two things, mirroring the Next.js/tsconfig environment:
 *
 *   1. `server-only`  → a no-op stub module. Both C1 (`postgres.ts`) and C2
 *      (`pg-stores.ts`) start with `import 'server-only'`, a bundler marker
 *      with no standalone Node package; without this they fail to resolve.
 *   2. `@/…`          → `<repoRoot>/src/…`, mirroring tsconfig `paths`, because
 *      C2 imports `@/lib/postgres` and `@/lib/postgres-schema` internally.
 *
 * This lets the backfill run the REAL committed contract code unmodified rather
 * than duplicating its SQL. The hook runs in a worker thread, so the repo root
 * is baked into the data-URL source as a literal.
 */

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const SRC_URL = pathToFileURL(path.join(REPO_ROOT, 'src') + path.sep).href;

const HOOK_SOURCE = `
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const SRC_URL = ${JSON.stringify(SRC_URL)};
const hasExt = (s) => /\\.[cm]?[jt]sx?$/.test(s) || s.endsWith('.json') || s.endsWith('.node');
// TS-aware extension fallback for an extensionless file URL: try .ts/.tsx
// then a package-style /index.ts, mirroring the Next.js/tsconfig bundler so
// the contract modules' own relative + aliased imports resolve under plain Node.
function withExt(url) {
  const p = fileURLToPath(url);
  if (existsSync(p + '.ts')) return url + '.ts';
  if (existsSync(p + '.tsx')) return url + '.tsx';
  if (existsSync(p) && !p.endsWith('.ts') && !p.endsWith('.tsx')) {
    if (existsSync(p + '/index.ts')) return url + '/index.ts';
    if (existsSync(p + '/index.tsx')) return url + '/index.tsx';
  }
  return url;
}
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'server-only') {
    return { url: 'data:text/javascript,export%20default%20undefined', shortCircuit: true };
  }
  // tsconfig 'paths': @/… → <repo>/src/…
  if (specifier.startsWith('@/')) {
    let target = SRC_URL + specifier.slice(2);
    if (!hasExt(specifier)) target = withExt(target);
    return nextResolve(target, context);
  }
  // Bare relative imports inside the contract graph are extensionless TS; the
  // bundler adds .ts/.tsx. Resolve them against the parent module URL.
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && !hasExt(specifier)) {
    if (context.parentURL && context.parentURL.startsWith('file:')) {
      const target = withExt(new URL(specifier, context.parentURL).href);
      return nextResolve(target, context);
    }
  }
  return nextResolve(specifier, context);
}
`;

register(
  'data:text/javascript,' + encodeURIComponent(HOOK_SOURCE),
  import.meta.url,
);

/* The hook is registered synchronously above; the dynamic imports in main()
 * (deferred to runtime) pick it up. */

/* ── types (local mirrors of the real Mongo shapes) ────────────
 * These mirror `src/lib/definitions.ts` (`User`, `Plan`) for the only fields
 * this stage touches. We read them loosely (the live documents carry far more)
 * and coerce defensively, since legacy rows predate several fields.
 */

interface MongoUserDoc {
  _id: unknown; // ObjectId
  email?: string;
  name?: string;
  image?: string; // → picture
  planId?: unknown; // ObjectId
  firebaseUid?: string; // not on the canonical type, tolerated if present
}

interface MongoPlanDoc {
  _id: unknown; // ObjectId
  name?: string;
  [k: string]: unknown; // full document stored verbatim in `data`
}

/* ── arg parsing ───────────────────────────────────────────── */

function parseArgs(argv: string[]): { batchSize: number; dryRun: boolean } {
  let batchSize = 500;
  let dryRun = false;
  for (const a of argv) {
    if (a === '--dry-run') dryRun = true;
    else if (a.startsWith('--batch=')) {
      const n = Number.parseInt(a.slice('--batch='.length), 10);
      if (Number.isFinite(n) && n > 0) batchSize = n;
    }
  }
  return { batchSize, dryRun };
}

/* ── helpers ───────────────────────────────────────────────── */

const LOG = '[backfill-users]';

function idToString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  // ObjectId has a toString() that yields the 24-char hex; strings pass through.
  const s = String(v);
  return s.length > 0 ? s : null;
}

/* ── main ──────────────────────────────────────────────────── */

async function main(): Promise<void> {
  const { batchSize, dryRun } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
    throw new Error(
      'MONGODB_URI and MONGODB_DB must be set (Mongo source). ' +
        'Run with: node --env-file=.env scripts/db/backfill-users.ts',
    );
  }
  if (!dryRun && !process.env.SABNODE_PG_URL) {
    throw new Error(
      'SABNODE_PG_URL must be set (Postgres target) unless --dry-run is passed. ' +
        'Provision Postgres and set SABNODE_PG_URL before running the backfill.',
    );
  }

  console.log(
    `${LOG} starting (batchSize=${batchSize}${dryRun ? ', DRY RUN — no Postgres writes' : ''})`,
  );

  /* C2 (users) + C1 (pool, for the plans INSERT + final counts). Imported
   * dynamically so the loader hook above is active before their `server-only`
   * import is resolved. The committed `IDENTITY_SCHEMA` (C3) names the schema. */
  const { connectToDatabase } = await import('../../src/lib/mongodb.ts');
  const { pgUserStore } = await import('../../src/lib/identity/pg-stores.ts');
  const { pgQuery } = await import('../../src/lib/postgres.ts');
  const { IDENTITY_SCHEMA } = await import('../../src/lib/postgres-schema.ts');

  const PLANS_TABLE = `${IDENTITY_SCHEMA}.plans`;

  const { client, db } = await connectToDatabase();
  console.log(`${LOG} connected to Mongo db "${process.env.MONGODB_DB}"`);

  try {
    /* ── plans first (users reference plan_id) ─────────────── */
    const plansCol = db.collection<MongoPlanDoc>('plans');
    const plansTotal = await plansCol.estimatedDocumentCount();
    console.log(`${LOG} plans: ~${plansTotal} document(s) to process`);

    let plansSeen = 0;
    let plansWritten = 0;
    let plansSkipped = 0;
    {
      const cursor = plansCol.find({}, { batchSize });
      let batch: MongoPlanDoc[] = [];
      const flush = async () => {
        if (batch.length === 0) return;
        for (const doc of batch) {
          plansSeen++;
          const legacyId = idToString(doc._id);
          if (!legacyId) {
            plansSkipped++;
            console.warn(`${LOG} plans: skipping document with no _id`);
            continue;
          }
          const name = typeof doc.name === 'string' && doc.name.trim() ? doc.name : '(unnamed plan)';
          if (!dryRun) {
            // Direct idempotent upsert. PK `id` is the Mongo _id string so the
            // user.plan_id (also the Mongo id string) lines up 1:1.
            await pgQuery(
              `INSERT INTO ${PLANS_TABLE} (id, legacy_mongo_id, name, data, updated_at)
                 VALUES ($1, $2, $3, $4::jsonb, now())
               ON CONFLICT (id) DO UPDATE SET
                 legacy_mongo_id = EXCLUDED.legacy_mongo_id,
                 name            = EXCLUDED.name,
                 data            = EXCLUDED.data,
                 updated_at      = now()`,
              [legacyId, legacyId, name, JSON.stringify(doc)],
            );
          }
          plansWritten++;
        }
        console.log(
          `${LOG} plans: processed ${plansSeen}/${plansTotal} (written=${plansWritten}, skipped=${plansSkipped})`,
        );
        batch = [];
      };
      for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= batchSize) await flush();
      }
      await flush();
    }
    console.log(
      `${LOG} plans DONE — seen=${plansSeen}, written=${plansWritten}, skipped=${plansSkipped}`,
    );

    /* ── users ─────────────────────────────────────────────── */
    const usersCol = db.collection<MongoUserDoc>('users');
    const usersTotal = await usersCol.estimatedDocumentCount();
    console.log(`${LOG} users: ~${usersTotal} document(s) to process`);

    let usersSeen = 0;
    let usersWritten = 0;
    let usersSkipped = 0;
    {
      const cursor = usersCol.find({}, { batchSize });
      let batch: MongoUserDoc[] = [];
      const flush = async () => {
        if (batch.length === 0) return;
        for (const doc of batch) {
          usersSeen++;
          const legacyId = idToString(doc._id);
          const email = typeof doc.email === 'string' ? doc.email.trim() : '';
          if (!legacyId || !email) {
            usersSkipped++;
            console.warn(
              `${LOG} users: skipping document (id=${legacyId ?? 'null'}, email=${email ? 'present' : 'missing'})`,
            );
            continue;
          }
          if (!dryRun) {
            // C2 contract write — same upsert the dual-write path uses.
            await pgUserStore.upsertByMongoId({
              legacyMongoId: legacyId,
              email,
              name: typeof doc.name === 'string' ? doc.name : null,
              picture: typeof doc.image === 'string' ? doc.image : null,
              firebaseUid: typeof doc.firebaseUid === 'string' ? doc.firebaseUid : null,
              planId: idToString(doc.planId),
            });
          }
          usersWritten++;
        }
        console.log(
          `${LOG} users: processed ${usersSeen}/${usersTotal} (written=${usersWritten}, skipped=${usersSkipped})`,
        );
        batch = [];
      };
      for await (const doc of cursor) {
        batch.push(doc);
        if (batch.length >= batchSize) await flush();
      }
      await flush();
    }
    console.log(
      `${LOG} users DONE — seen=${usersSeen}, written=${usersWritten}, skipped=${usersSkipped}`,
    );

    /* ── final reconciliation counts ───────────────────────── */
    if (!dryRun) {
      const usersPg = await pgQuery<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${IDENTITY_SCHEMA}.users`,
      );
      const plansPg = await pgQuery<{ count: string }>(
        `SELECT count(*)::text AS count FROM ${PLANS_TABLE}`,
      );
      console.log(
        `${LOG} FINAL — Postgres now holds ${usersPg.rows[0]?.count ?? '?'} user(s) and ` +
          `${plansPg.rows[0]?.count ?? '?'} plan(s) in schema "${IDENTITY_SCHEMA}".`,
      );
    } else {
      console.log(`${LOG} FINAL (dry run) — would write ${usersWritten} user(s) and ${plansWritten} plan(s).`);
    }

    console.log(`${LOG} backfill complete.`);
  } finally {
    await client.close().catch(() => {});
    // Close the C1 pool so the process can exit cleanly (no-op if never opened).
    try {
      const { closePgPool } = await import('../../src/lib/postgres.ts');
      await closePgPool();
    } catch {
      /* ignore — pool may not have been imported */
    }
  }
}

main().catch((err) => {
  console.error(`${LOG} FAILED:`, err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exitCode = 1;
  process.exit(1);
});

// Reference for type-only locals so unused-import linters stay quiet without
// pulling runtime deps; these mirror src/lib/definitions.ts User/Plan shapes.
export type { MongoUserDoc, MongoPlanDoc };
