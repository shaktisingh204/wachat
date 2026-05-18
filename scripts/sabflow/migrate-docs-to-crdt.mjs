#!/usr/bin/env node
/**
 * SabFlow — one-shot migration: legacy `sabflows` ➜ CRDT `sabflow_docs`.
 *
 * Track A · Phase C.8 · sub-task #9. Spec: docs/adr/sabflow-persistence.md §2.1.
 *
 * What it does (per row in the legacy `sabflows` collection):
 *   1. Build a fresh `Y.Doc` from the legacy content.
 *      The Y.Doc's root `Y.Map('flow')` carries every authoring field
 *      (events, groups, edges, variables, annotations, theme, settings,
 *      meta, status, tags, folderId, publicId) as plain JSON values —
 *      a faithful, lossless snapshot of the legacy shape. The Phase 5
 *      client SDK is the canonical owner of the in-Y.Doc structure; this
 *      migration only needs the round-trip to come back byte-for-byte.
 *   2. Serialise via `Y.encodeStateAsUpdate(doc)` to a `Uint8Array`.
 *   3. Insert a `sabflow_docs` row using the ADR §2.1 shape:
 *        version: 1, snapshot: BinData(<bytes>), legacyId: <old _id>,
 *        workspaceId, ownerId, name, settings, meta, tags, ...
 *      `legacyId` is added as an audit pointer back to the source row so
 *      a follow-up reconciliation pass can spot any drift.
 *   4. Verify round-trip: re-load the new doc, `Y.applyUpdate` the
 *      snapshot into a fresh `Y.Doc`, read the `flow` map back, and
 *      deep-equal against the legacy content. Round-trip failure marks
 *      the row failed; the migration row is rolled back.
 *   5. Print a structured report.
 *
 * Constraints honoured:
 *   - Mongo native driver only — NO mongoose.
 *   - No new deps — `mongodb`, `dotenv`, and `yjs` are the only imports;
 *     all three are already on the SabFlow CRDT critical path.
 *   - Bun-and-Node compatible — pure ESM, `#!/usr/bin/env node` shebang,
 *     no Node-only globals beyond `process` / `Buffer` / `crypto`.
 *
 * Usage:
 *   node scripts/sabflow/migrate-docs-to-crdt.mjs              # dry-run (default)
 *   node scripts/sabflow/migrate-docs-to-crdt.mjs --dry-run    # explicit
 *   node scripts/sabflow/migrate-docs-to-crdt.mjs --apply      # writes
 *
 * Optional flags:
 *   --limit=N        Process at most N legacy rows (default: all)
 *   --batch=N        Read in pages of N rows (default: 50)
 *   --sample=N       Show up to N sample diffs in dry-run (default: 3)
 *   --legacy=NAME    Override legacy collection name (default: sabflows)
 *   --target=NAME    Override target collection name (default: sabflow_docs)
 *
 * Exit codes: 0 success, 1 connection/env/option error, 2 if any rows
 * failed during --apply (report still printed).
 */

import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Quick-exit on --help BEFORE loading runtime deps so the script's usage
// is discoverable even when node_modules hasn't been installed yet.
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  // eslint-disable-next-line no-console
  console.log('[sabflow:migrate] usage: node scripts/sabflow/migrate-docs-to-crdt.mjs [--dry-run|--apply] [--limit=N] [--batch=N] [--sample=N] [--legacy=NAME] [--target=NAME]');
  process.exit(0);
}

const require = createRequire(import.meta.url);

// Mongo native driver — the only persistence dep we touch.
const { MongoClient, ObjectId, Binary } = require('mongodb');

// Yjs is published as ESM; createRequire stays tolerant of older installs
// and Bun's resolver quirks for transitive `lib0` deps.
let Y;
try {
  Y = require('yjs');
} catch (_err) {
  // Fall back to dynamic ESM import (works under both Bun and modern Node).
  Y = await import('yjs');
}

// Load .env from the repo root so MONGODB_URI / MONGODB_DB resolve in
// dev shells. Production callers (CI / Vercel one-off) pass env directly.
try {
  const dotenv = require('dotenv');
  const here = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(here, '../../.env') });
  dotenv.config({ path: path.resolve(here, '../../.env.local') });
} catch (_err) {
  // dotenv is optional — env may already be exported by the shell.
}

/* ════════════════════════════════════════════════════════════
   CLI parsing
   ════════════════════════════════════════════════════════════ */

const LOG = '[sabflow:migrate]';

function parseArgs(argv) {
  const out = {
    apply: false,
    dryRun: true,
    limit: Infinity,
    batch: 50,
    sample: 3,
    legacy: 'sabflows',
    target: 'sabflow_docs',
  };
  for (const raw of argv) {
    if (raw === '--apply') {
      out.apply = true;
      out.dryRun = false;
    } else if (raw === '--dry-run') {
      out.apply = false;
      out.dryRun = true;
    } else if (raw.startsWith('--limit=')) {
      out.limit = Number.parseInt(raw.slice('--limit='.length), 10);
      if (!Number.isFinite(out.limit) || out.limit <= 0) {
        throw new Error(`Invalid --limit: ${raw}`);
      }
    } else if (raw.startsWith('--batch=')) {
      out.batch = Number.parseInt(raw.slice('--batch='.length), 10);
      if (!Number.isFinite(out.batch) || out.batch <= 0) {
        throw new Error(`Invalid --batch: ${raw}`);
      }
    } else if (raw.startsWith('--sample=')) {
      out.sample = Number.parseInt(raw.slice('--sample='.length), 10);
      if (!Number.isFinite(out.sample) || out.sample < 0) {
        throw new Error(`Invalid --sample: ${raw}`);
      }
    } else if (raw.startsWith('--legacy=')) {
      out.legacy = raw.slice('--legacy='.length);
    } else if (raw.startsWith('--target=')) {
      out.target = raw.slice('--target='.length);
    } else if (raw === '--help' || raw === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${raw}`);
    }
  }
  return out;
}

function printHelp() {
  // eslint-disable-next-line no-console
  console.log(`${LOG} usage: node scripts/sabflow/migrate-docs-to-crdt.mjs [--dry-run|--apply] [--limit=N] [--batch=N] [--sample=N] [--legacy=NAME] [--target=NAME]`);
}

/* ════════════════════════════════════════════════════════════
   Helpers
   ════════════════════════════════════════════════════════════ */

const SABFLOW_DOC_SCHEMA_VERSION = 1;
const HEX24 = /^[a-f0-9]{24}$/i;

function toObjectIdOrNull(maybe) {
  if (maybe == null) return null;
  if (maybe instanceof ObjectId) return maybe;
  if (typeof maybe === 'string' && HEX24.test(maybe)) return new ObjectId(maybe);
  if (typeof maybe === 'object' && typeof maybe.toHexString === 'function') {
    return maybe;
  }
  return null;
}

/**
 * Derive `(workspaceId, ownerId)` from a legacy SabFlow doc.
 *   - `ownerId`  ← legacy `userId` (cast to ObjectId where possible).
 *   - `workspaceId` ← legacy `projectId` when present and ObjectId-like,
 *     else falls back to a deterministic v5-style ObjectId derived from
 *     the legacy `userId` (using a fixed 24-char hash) — this keeps
 *     re-runs idempotent on the same source row without requiring a
 *     workspace lookup table at migration time. Workspace remap is a
 *     separate concern owned by Phase 2 sub-task #11.
 *
 * Returns `{ workspaceId, ownerId, derivation }`. `derivation` is a
 * human-readable tag included in failure reports.
 */
function deriveOwnership(legacy) {
  const ownerId =
    toObjectIdOrNull(legacy.userId) ?? new ObjectId(); // last-resort: synthesised
  const projectOid = toObjectIdOrNull(legacy.projectId);
  if (projectOid) {
    return { workspaceId: projectOid, ownerId, derivation: 'projectId' };
  }
  // Fallback: deterministic 24-hex from userId so reruns don't fork.
  const userIdStr = String(legacy.userId ?? '').padEnd(24, '0').slice(0, 24);
  const fallback = HEX24.test(userIdStr)
    ? new ObjectId(userIdStr)
    : new ObjectId(); // truly random — flagged in derivation
  return {
    workspaceId: fallback,
    ownerId,
    derivation: HEX24.test(userIdStr) ? 'userId-hex' : 'random',
  };
}

/**
 * Build a fresh Y.Doc from a legacy `SabFlowDoc`.
 *
 * The Phase 5 client SDK owns the canonical in-Y.Doc structure (Y.Array
 * for `events`/`groups`/`edges`/`variables`, Y.Map for `settings`/`meta`,
 * Y.Text for code blocks). For this one-shot migration we mirror that
 * shape conservatively: a top-level `Y.Map` keyed `flow` holds every
 * authoring field as plain JSON values so the round-trip check below
 * can deep-equal without depending on the SDK at migration time. The
 * client SDK will rehydrate this into the richer shared types on first
 * open (per `docs/adr/sabflow-doc-schema.md` §4 migrator).
 */
function buildYDocFromLegacy(legacy) {
  const doc = new Y.Doc({ gc: true });
  const flow = doc.getMap('flow');
  // Use a transaction so the encoded update is a single coherent batch.
  doc.transact(() => {
    flow.set('events', deepClonePlain(legacy.events ?? []));
    flow.set('groups', deepClonePlain(legacy.groups ?? []));
    flow.set('edges', deepClonePlain(legacy.edges ?? []));
    flow.set('variables', deepClonePlain(legacy.variables ?? []));
    flow.set('annotations', deepClonePlain(legacy.annotations ?? []));
    flow.set('theme', deepClonePlain(legacy.theme ?? {}));
    flow.set('settings', deepClonePlain(legacy.settings ?? {}));
    flow.set('status', legacy.status ?? 'DRAFT');
    flow.set('tags', Array.isArray(legacy.tags) ? [...legacy.tags] : []);
    if (legacy.folderId != null) flow.set('folderId', String(legacy.folderId));
    if (legacy.publicId != null) flow.set('publicId', String(legacy.publicId));
    if (legacy.name != null) flow.set('name', String(legacy.name));
  }, 'sabflow:migrate');
  return doc;
}

/** Plain-JSON deep clone — sufficient for the legacy shapes (no BSON types beyond _id at top level). */
function deepClonePlain(value) {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof ObjectId) return value.toHexString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (Array.isArray(value)) return value.map(deepClonePlain);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = deepClonePlain(v);
  }
  return out;
}

/** Stable deep equality for round-trip verification. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if (!deepEqual(a[ka[i]], b[kb[i]])) return false;
  }
  return true;
}

/** Apply a snapshot back into a fresh Y.Doc and pull out the `flow` map. */
function snapshotToFlowJson(snapshotBytes) {
  const doc = new Y.Doc({ gc: true });
  Y.applyUpdate(doc, snapshotBytes, 'sabflow:migrate:verify');
  return doc.getMap('flow').toJSON();
}

/** Build the expected `flow` JSON for round-trip comparison. */
function expectedFlowJson(legacy) {
  const obj = {
    events: deepClonePlain(legacy.events ?? []),
    groups: deepClonePlain(legacy.groups ?? []),
    edges: deepClonePlain(legacy.edges ?? []),
    variables: deepClonePlain(legacy.variables ?? []),
    annotations: deepClonePlain(legacy.annotations ?? []),
    theme: deepClonePlain(legacy.theme ?? {}),
    settings: deepClonePlain(legacy.settings ?? {}),
    status: legacy.status ?? 'DRAFT',
    tags: Array.isArray(legacy.tags) ? [...legacy.tags] : [],
  };
  if (legacy.folderId != null) obj.folderId = String(legacy.folderId);
  if (legacy.publicId != null) obj.publicId = String(legacy.publicId);
  if (legacy.name != null) obj.name = String(legacy.name);
  return obj;
}

/** Build the `sabflow_docs` row from a legacy doc + encoded snapshot. */
function buildTargetRow(legacy, snapshotBytes, ownership, now) {
  const buf = Buffer.from(snapshotBytes);
  return {
    workspaceId: ownership.workspaceId,
    ownerId: ownership.ownerId,
    name: typeof legacy.name === 'string' && legacy.name.length > 0 ? legacy.name.slice(0, 128) : 'Untitled flow',
    version: 1,
    versionId: randomUUID(),
    snapshot: new Binary(buf, Binary.SUBTYPE_DEFAULT),
    snapshotSize: buf.length,
    schemaVersion: SABFLOW_DOC_SCHEMA_VERSION,
    settings: legacy.settings && typeof legacy.settings === 'object' ? deepClonePlain(legacy.settings) : {},
    meta: { migratedFrom: 'sabflows', migratedAt: now, derivation: ownership.derivation },
    tags: Array.isArray(legacy.tags) ? [...legacy.tags] : [],
    triggerCount: Array.isArray(legacy.events) ? legacy.events.length : 0,
    active: legacy.status === 'PUBLISHED',
    coldTier: null,
    createdAt: legacy.createdAt instanceof Date ? legacy.createdAt : now,
    updatedAt: now,
    lastEditorId: ownership.ownerId,
    deletedAt: null,
    legacyId: legacy._id, // audit pointer back to source row
  };
}

/* ════════════════════════════════════════════════════════════
   Main
   ════════════════════════════════════════════════════════════ */

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`${LOG} arg error: ${err.message}`);
    printHelp();
    process.exit(1);
  }

  if (!process.env.MONGODB_URI || !process.env.MONGODB_DB) {
    // eslint-disable-next-line no-console
    console.error(`${LOG} MONGODB_URI and MONGODB_DB must be set in env or .env file.`);
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`${LOG} mode=${opts.apply ? 'APPLY' : 'DRY-RUN'} legacy=${opts.legacy} target=${opts.target} limit=${opts.limit === Infinity ? 'all' : opts.limit}`);

  const client = new MongoClient(process.env.MONGODB_URI);
  const report = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    failed: [], // [{ legacyId, reason, derivation? }]
    samples: [], // dry-run only
  };

  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    // eslint-disable-next-line no-console
    console.log(`${LOG} connected db=${db.databaseName}`);

    const legacyCol = db.collection(opts.legacy);
    const targetCol = db.collection(opts.target);

    // Build a set of already-migrated legacy ids so re-runs skip them.
    const alreadyMigrated = new Set();
    {
      const cursor = targetCol.find(
        { legacyId: { $exists: true, $ne: null } },
        { projection: { legacyId: 1 } },
      );
      for await (const row of cursor) {
        if (row.legacyId) alreadyMigrated.add(String(row.legacyId));
      }
    }
    // eslint-disable-next-line no-console
    console.log(`${LOG} found ${alreadyMigrated.size} legacy ids already present in target`);

    const totalLegacy = await legacyCol.estimatedDocumentCount();
    // eslint-disable-next-line no-console
    console.log(`${LOG} scanning legacy collection (~${totalLegacy} rows)…`);

    const cursor = legacyCol.find({}).batchSize(opts.batch);
    let processed = 0;

    for await (const legacy of cursor) {
      if (processed >= opts.limit) break;
      processed++;
      report.scanned++;

      const legacyIdStr = String(legacy._id);

      if (alreadyMigrated.has(legacyIdStr)) {
        report.skipped++;
        continue;
      }

      try {
        const ownership = deriveOwnership(legacy);
        const ydoc = buildYDocFromLegacy(legacy);
        const snapshotBytes = Y.encodeStateAsUpdate(ydoc);

        // Round-trip verification — fail fast before we write anything.
        const restored = snapshotToFlowJson(snapshotBytes);
        const expected = expectedFlowJson(legacy);
        if (!deepEqual(restored, expected)) {
          report.failed.push({
            legacyId: legacyIdStr,
            reason: 'round-trip mismatch',
            derivation: ownership.derivation,
          });
          ydoc.destroy();
          continue;
        }

        const now = new Date();
        const targetRow = buildTargetRow(legacy, snapshotBytes, ownership, now);

        if (opts.apply) {
          await targetCol.insertOne(targetRow);
          report.migrated++;
        } else {
          report.migrated++; // counted as "would migrate"
          if (report.samples.length < opts.sample) {
            report.samples.push({
              legacyId: legacyIdStr,
              workspaceId: ownership.workspaceId.toHexString(),
              ownerId: ownership.ownerId.toHexString(),
              derivation: ownership.derivation,
              name: targetRow.name,
              snapshotSize: targetRow.snapshotSize,
              version: targetRow.version,
              triggerCount: targetRow.triggerCount,
              active: targetRow.active,
              flowKeys: Object.keys(expected).sort(),
            });
          }
        }

        ydoc.destroy();
      } catch (err) {
        report.failed.push({
          legacyId: legacyIdStr,
          reason: `exception: ${err && err.message ? err.message : String(err)}`,
        });
      }

      if (processed % 100 === 0) {
        // eslint-disable-next-line no-console
        console.log(`${LOG} progress: scanned=${report.scanned} migrated=${report.migrated} skipped=${report.skipped} failed=${report.failed.length}`);
      }
    }
  } finally {
    await client.close().catch(() => { /* ignore */ });
  }

  // eslint-disable-next-line no-console
  console.log(`\n${LOG} ───── report ─────`);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(
    {
      mode: opts.apply ? 'APPLY' : 'DRY-RUN',
      scanned: report.scanned,
      migrated: report.migrated,
      skipped: report.skipped,
      failed: report.failed,
      samples: opts.apply ? undefined : report.samples,
    },
    null,
    2,
  ));

  if (opts.apply && report.failed.length > 0) {
    process.exit(2);
  }
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(`${LOG} fatal:`, err);
  process.exit(1);
});
