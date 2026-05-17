/**
 * GET /api/cron/sabflow-executions-retention
 *
 * Vercel-Cron-driven retention cleanup for the `sabflow_executions`
 * collection.  SabFlow keeps execution history forever by default; this
 * cron prunes two ways:
 *
 *   1. Age-based — deletes finished executions older than
 *      `SABFLOW_EXECUTION_RETENTION_DAYS` (default 90 days).  Rows still
 *      in `running` status are NEVER touched so we don't decapitate
 *      in-flight runs.
 *
 *   2. Per-flow cap — for every flow holding more than
 *      `SABFLOW_MAX_EXECUTIONS_PER_FLOW` rows (default 1000), the oldest
 *      rows beyond the cap are dropped (again skipping `running`).
 *
 * Auth: matches `/api/cron/sabflow-scheduled` — `Authorization: Bearer
 * $CRON_SECRET` when the env var is set, else fall back to the
 * `vercel-cron: 1` header that Vercel attaches to scheduled invocations
 * (suitable for staging where no secret is configured).
 *
 * Response: `{ ok, deleted, capped, durationMs }`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_PER_FLOW_CAP = 1000;

export async function GET(req: NextRequest) {
  if (!isAuthorisedCronRequest(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const startedAt = Date.now();
  const retentionDays = parsePositiveInt(
    process.env.SABFLOW_EXECUTION_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
  );
  const perFlowCap = parsePositiveInt(
    process.env.SABFLOW_MAX_EXECUTIONS_PER_FLOW,
    DEFAULT_PER_FLOW_CAP,
  );

  console.log(
    `[SABFLOW RETENTION] tick retentionDays=${retentionDays} perFlowCap=${perFlowCap}`,
  );

  try {
    const { db } = await connectToDatabase();
    const col = db.collection('sabflow_executions');

    /* ── 1. Age-based delete ─────────────────────────────────────────── */
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const ageResult = await col.deleteMany({
      finishedAt: { $lt: cutoff },
      status: { $ne: 'running' },
    });
    const deleted = ageResult.deletedCount ?? 0;

    /* ── 2. Per-flow cap ─────────────────────────────────────────────── */
    // Aggregation finds flows whose non-running rows exceed the cap and
    // emits the ObjectIds of every row beyond `perFlowCap` (oldest first,
    // since we sort by startedAt descending and slice the tail).
    const overflowIds: ObjectId[] = [];
    const flowsToTrim = await col
      .aggregate<{ _id: string; ids: ObjectId[] }>([
        { $match: { status: { $ne: 'running' } } },
        { $sort: { startedAt: -1 } },
        {
          $group: {
            _id: '$flowId',
            ids: { $push: '$_id' },
            count: { $sum: 1 },
          },
        },
        { $match: { count: { $gt: perFlowCap } } },
        {
          $project: {
            ids: { $slice: ['$ids', perFlowCap, { $size: '$ids' }] },
          },
        },
      ])
      .toArray();

    for (const flow of flowsToTrim) {
      for (const id of flow.ids) overflowIds.push(id);
    }

    let capped = 0;
    if (overflowIds.length > 0) {
      const capResult = await col.deleteMany({ _id: { $in: overflowIds } });
      capped = capResult.deletedCount ?? 0;
    }

    const durationMs = Date.now() - startedAt;
    console.log(
      `[SABFLOW RETENTION] done deleted=${deleted} capped=${capped} durationMs=${durationMs}`,
    );

    return NextResponse.json({ ok: true, deleted, capped, durationMs });
  } catch (err) {
    console.error('[SABFLOW RETENTION] tick error:', err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

function isAuthorisedCronRequest(req: NextRequest): boolean {
  const auth = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured — fall back to checking the Vercel-Cron header,
    // which Vercel attaches automatically.  Suitable for staging only.
    return req.headers.get('vercel-cron') === '1';
  }
  return auth === `Bearer ${secret}`;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
