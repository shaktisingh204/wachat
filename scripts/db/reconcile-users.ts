'use server';

/**
 * Phase 2 — Stage 4 reconcile (PLAN.md §3).
 *
 * Diffs the Mongo `users` collection against `sabnode_identity.users`
 * (matched on `legacy_mongo_id` = the Mongo `_id` string) and reports:
 *   - total counts on each side
 *   - users present in Mongo but missing in Postgres (the backfill gap)
 *   - field drift (email / name) on matched rows
 *
 * Emits a single-line JSON summary to stdout (parse-friendly for the cron) and
 * exits non-zero when the drift ratio exceeds a threshold, so the continuous
 * reconcile cron can GATE promotion of the auth read path (stage 4 → stage 5).
 *
 * INERT by default: this is a standalone script — it changes nothing in the
 * running app, performs no writes, and only reads from both stores. It is the
 * read-only gate described in PLAN.md ("Reconcile cron blocks promotion to
 * stage 5"). It connects to Postgres lazily via the C1 pool, which throws a
 * clear error if `SABNODE_PG_URL` is not provisioned.
 *
 * Usage:
 *   tsx scripts/db/reconcile-users.ts
 *
 * Env:
 *   RECONCILE_DRIFT_THRESHOLD  Max allowed (missing + drifted) / mongoTotal
 *                              ratio before exiting non-zero. Default: 0.01 (1%).
 *   RECONCILE_MAX_SAMPLES      Cap on how many example ids/diffs to include in
 *                              the JSON output (full counts are always exact).
 *                              Default: 50.
 */

import { connectToDatabase } from '../../src/lib/mongodb';
import { getPgPool, closePgPool } from '../../src/lib/postgres';
import { IDENTITY_SCHEMA, type PgUserRow } from '../../src/lib/postgres-schema';

interface FieldDrift {
  legacyMongoId: string;
  field: 'email' | 'name';
  mongo: string | null;
  pg: string | null;
}

interface ReconcileSummary {
  ok: boolean;
  generatedAt: string;
  threshold: number;
  driftRatio: number;
  counts: {
    mongoTotal: number;
    pgTotal: number;
    pgWithLegacyId: number;
    matched: number;
    missingInPg: number;
    drifted: number;
  };
  /** Capped samples — see RECONCILE_MAX_SAMPLES. */
  missingInPgSample: string[];
  driftSample: FieldDrift[];
}

/** Normalize a possibly-missing string field for comparison (trim, null-coalesce). */
function norm(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length === 0 ? null : s;
}

/** Email compares case-insensitively (PG enforces a lower(email) unique index). */
function emailEq(a: string | null, b: string | null): boolean {
  return (a?.toLowerCase() ?? null) === (b?.toLowerCase() ?? null);
}

async function reconcileUsers(): Promise<void> {
  const threshold = Number(process.env.RECONCILE_DRIFT_THRESHOLD ?? '0.01');
  const maxSamples = Number(process.env.RECONCILE_MAX_SAMPLES ?? '50');

  // ── Mongo side ──────────────────────────────────────────────
  const { db } = await connectToDatabase();
  const mongoTotal = await db.collection('users').countDocuments();

  // Map legacy_mongo_id (string form of _id) → { email, name }.
  const mongoUsers = new Map<string, { email: string | null; name: string | null }>();
  const mongoCursor = db
    .collection('users')
    .find({}, { projection: { _id: 1, email: 1, name: 1 } });
  for await (const doc of mongoCursor) {
    const id = String((doc as { _id: unknown })._id);
    mongoUsers.set(id, {
      email: norm((doc as { email?: unknown }).email),
      name: norm((doc as { name?: unknown }).name),
    });
  }

  // ── Postgres side ───────────────────────────────────────────
  const pool = getPgPool();
  const pgTotalRes = await pool.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${IDENTITY_SCHEMA}.users`,
  );
  const pgTotal = Number(pgTotalRes.rows[0]?.count ?? '0');

  // Only rows carrying a legacy id can be reconciled 1:1 against Mongo.
  const pgRows = await pool.query<Pick<PgUserRow, 'legacy_mongo_id' | 'email' | 'name'>>(
    `SELECT legacy_mongo_id, email, name
       FROM ${IDENTITY_SCHEMA}.users
      WHERE legacy_mongo_id IS NOT NULL`,
  );

  const pgByLegacyId = new Map<string, { email: string | null; name: string | null }>();
  for (const row of pgRows.rows) {
    if (!row.legacy_mongo_id) continue;
    pgByLegacyId.set(row.legacy_mongo_id, {
      email: norm(row.email),
      name: norm(row.name),
    });
  }
  const pgWithLegacyId = pgByLegacyId.size;

  // ── Diff ────────────────────────────────────────────────────
  const missingInPg: string[] = [];
  const drift: FieldDrift[] = [];
  let matched = 0;

  for (const [legacyId, m] of mongoUsers) {
    const p = pgByLegacyId.get(legacyId);
    if (!p) {
      missingInPg.push(legacyId);
      continue;
    }
    matched += 1;

    if (!emailEq(m.email, p.email)) {
      drift.push({ legacyMongoId: legacyId, field: 'email', mongo: m.email, pg: p.email });
    }
    if (m.name !== p.name) {
      drift.push({ legacyMongoId: legacyId, field: 'name', mongo: m.name, pg: p.name });
    }
  }

  const missingCount = missingInPg.length;
  // Count distinct drifted rows (a row can drift on both fields).
  const driftedRowIds = new Set(drift.map((d) => d.legacyMongoId));
  const driftedRows = driftedRowIds.size;

  // Drift ratio gates promotion: fraction of Mongo users that are either
  // missing from PG or have a field mismatch on a matched row.
  const offending = missingCount + driftedRows;
  const driftRatio = mongoTotal > 0 ? offending / mongoTotal : 0;
  const ok = driftRatio <= threshold;

  const summary: ReconcileSummary = {
    ok,
    generatedAt: new Date().toISOString(),
    threshold,
    driftRatio: Number(driftRatio.toFixed(6)),
    counts: {
      mongoTotal,
      pgTotal,
      pgWithLegacyId,
      matched,
      missingInPg: missingCount,
      drifted: driftedRows,
    },
    missingInPgSample: missingInPg.slice(0, maxSamples),
    driftSample: drift.slice(0, maxSamples),
  };

  // Single-line JSON to stdout for the cron / log pipeline to parse.
  process.stdout.write(JSON.stringify(summary) + '\n');

  await closePgPool().catch(() => {});

  // Non-zero exit when drift exceeds threshold → gates stage-5 promotion.
  process.exit(ok ? 0 : 1);
}

reconcileUsers().catch(async (err) => {
  await closePgPool().catch(() => {});
  process.stderr.write(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      generatedAt: new Date().toISOString(),
    }) + '\n',
  );
  // Exit code 2 distinguishes a run failure from a clean drift-over-threshold (1).
  process.exit(2);
});
