/**
 * GET /api/cron/sabflow-gc
 *
 * Vercel Cron driver for SabFlow CRDT doc compaction (Track A · Phase 2 · sub-task #6).
 *
 * Periodically scans `sabflow_docs` for documents whose oplog has grown past
 * the snapshot threshold or that haven't been compacted recently, then calls
 * `compactDoc` to fold pending oplog entries into a fresh Yjs snapshot.
 *
 * Native Vercel primitive — no node-cron / agenda / Bull (per project rule
 * "Deployment platform — Vercel (native, not integration)" in CLAUDE.md).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` — Vercel attaches it
 * automatically on scheduled invocations.
 *
 * Cadence: every 6 hours (see `vercel.ts` / `vercel.json` `crons`).
 *
 * Response: `{ processed, skipped, errors }`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { connectToDatabase } from '@/lib/mongodb';
import { compactDoc } from '@/lib/sabflow/persistence/compaction';
import { makeCompactionDeps } from '@/lib/sabflow/persistence/compaction-deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // compaction is I/O-bound.

/** Oplog entry threshold above which a doc becomes eligible for compaction. */
const OPLOG_PENDING_THRESHOLD = 256;
/** Max age since last compaction (ms) above which a doc becomes eligible. */
const MAX_AGE_SINCE_COMPACTION_MS = 5 * 60 * 1000;
/** Defensive ceiling on per-tick doc count so a backlog can't blow past `maxDuration`. */
const MAX_DOCS_PER_TICK = 500;
/** Concurrency cap when fanning out `compactDoc` calls. */
const COMPACTION_CONCURRENCY = 4;

type SabFlowDocRow = {
    workspaceId: string;
    docId: string;
    oplogPending?: number;
    lastCompactedAt?: Date | null;
};

type CompactionOutcome =
    | { status: 'processed'; workspaceId: string; docId: string }
    | { status: 'skipped'; workspaceId: string; docId: string; reason: string }
    | { status: 'error'; workspaceId: string; docId: string; error: string };

function authorize(
    request: NextRequest,
): { ok: true } | { ok: false; status: number; body: unknown } {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        return {
            ok: false,
            status: 503,
            body: { error: 'CRON_SECRET not configured' },
        };
    }
    const auth = request.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return { ok: true };
    // Vercel cron's canonical header — accept as a secondary signal so the
    // job still fires when `CRON_SECRET` rotation lags behind the dashboard.
    const xCron = request.headers.get('x-cron-secret') ?? '';
    if (xCron === expected) return { ok: true };
    return { ok: false, status: 401, body: { error: 'Unauthorized' } };
}

/**
 * Pick docs eligible for compaction from `sabflow_docs`.
 *
 * Schema note: the live rows (see `persistence/snapshot.ts`) use `_id` AS
 * the doc id — there is no separate `docId` column. Hot docs only
 * (`coldTier: null`), live docs only (`deletedAt: null`).
 */
async function findEligibleDocs(now: Date): Promise<SabFlowDocRow[]> {
    const { db } = await connectToDatabase();
    const col = db.collection('sabflow_docs');

    const ageCutoff = new Date(now.getTime() - MAX_AGE_SINCE_COMPACTION_MS);

    // Either the oplog has grown past the snapshot threshold, OR the doc
    // hasn't been compacted in the last MAX_AGE_SINCE_COMPACTION_MS.
    const rows = await col
        .find(
            {
                deletedAt: null,
                coldTier: null,
                $or: [
                    { oplogPending: { $gt: OPLOG_PENDING_THRESHOLD } },
                    { lastCompactedAt: { $lt: ageCutoff } },
                    { lastCompactedAt: { $exists: false } },
                ],
            },
            { projection: { _id: 1, workspaceId: 1 } },
        )
        .limit(MAX_DOCS_PER_TICK)
        .toArray();

    return rows.map((row) => ({
        workspaceId: String(row.workspaceId),
        docId: String(row._id),
    }));
}

/**
 * Run `compactDoc` across `docs` with a fixed concurrency window.
 * Uses `Promise.allSettled` in chunks of `COMPACTION_CONCURRENCY` so a
 * single doc failing can't stall the rest of the batch.
 */
async function runCompactionBatch(
    docs: SabFlowDocRow[],
): Promise<CompactionOutcome[]> {
    const deps = makeCompactionDeps();
    const outcomes: CompactionOutcome[] = [];

    for (let i = 0; i < docs.length; i += COMPACTION_CONCURRENCY) {
        const chunk = docs.slice(i, i + COMPACTION_CONCURRENCY);
        const settled = await Promise.allSettled(
            chunk.map((d) =>
                compactDoc({ workspaceId: d.workspaceId, docId: d.docId }, deps),
            ),
        );
        settled.forEach((result, idx) => {
            const d = chunk[idx];
            if (result.status === 'fulfilled') {
                if (result.value.skipped) {
                    outcomes.push({
                        status: 'skipped',
                        workspaceId: d.workspaceId,
                        docId: d.docId,
                        reason: result.value.skipped,
                    });
                } else {
                    outcomes.push({
                        status: 'processed',
                        workspaceId: d.workspaceId,
                        docId: d.docId,
                    });
                }
            } else {
                const error =
                    result.reason instanceof Error
                        ? result.reason.message
                        : String(result.reason);
                outcomes.push({
                    status: 'error',
                    workspaceId: d.workspaceId,
                    docId: d.docId,
                    error,
                });
            }
        });
    }

    return outcomes;
}

export async function GET(request: NextRequest) {
    const guard = authorize(request);
    if (!guard.ok) {
        return NextResponse.json(guard.body, { status: guard.status });
    }

    const now = new Date();
    const startedAt = Date.now();

    let processed = 0;
    let skipped = 0;
    const errors: Array<{ workspaceId: string; docId: string; error: string }> = [];

    try {
        const docs = await findEligibleDocs(now);

        if (docs.length === 0) {
            return NextResponse.json({
                processed: 0,
                skipped: 0,
                errors: [],
                tick: now.toISOString(),
                durationMs: Date.now() - startedAt,
            });
        }

        const outcomes = await runCompactionBatch(docs);

        for (const o of outcomes) {
            if (o.status === 'processed') processed += 1;
            else if (o.status === 'skipped') skipped += 1;
            else {
                errors.push({
                    workspaceId: o.workspaceId,
                    docId: o.docId,
                    error: o.error,
                });
            }
        }

        return NextResponse.json({
            processed,
            skipped,
            errors,
            tick: now.toISOString(),
            durationMs: Date.now() - startedAt,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[sabflow-gc] tick error:', err);
        return NextResponse.json(
            {
                processed,
                skipped,
                errors: [
                    ...errors,
                    { workspaceId: '', docId: '', error: message },
                ],
                tick: now.toISOString(),
                durationMs: Date.now() - startedAt,
            },
            { status: 500 },
        );
    }
}
