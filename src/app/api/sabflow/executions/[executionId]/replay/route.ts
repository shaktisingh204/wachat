/**
 * SabFlow — Execution replay via SSE
 *
 * GET /api/sabflow/executions/[executionId]/replay
 *
 * Fetches all persisted TraceEvent docs for the given executionId from
 * `sabflow_execution_traces`, then streams them as Server-Sent Events
 * with timing delays that reproduce the original run's cadence, optionally
 * scaled by a `speed` multiplier.
 *
 * Query params:
 *   - `speed`  (float, default 1.0) — replay speed multiplier. 2.0 = 2× faster.
 *   - `from`   (int,   default 0)   — start replaying from this itemIndex offset.
 *
 * SSE event shape:
 *   - `event: trace\ndata: <TraceEvent JSON>\n\n`  for each trace event.
 *   - `event: done\ndata: {}\n\n`                  when all events are drained.
 *
 * Timing:
 *   - Delays are computed as the delta between consecutive event `at` timestamps
 *     divided by `speed`.
 *   - Hard cap: 5 minutes total replay time. Once the cap is hit, remaining
 *     events are flushed immediately without further delay.
 *
 * Auth: valid session + `sabflow.workflow.read` permission (covers "run history").
 * Falls back to accepting `sabflow.execution.admin` as a catch-all.
 *
 * Track C · Phase 9 · sub-task #3.
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import { type NextRequest } from 'next/server';

import { getSession } from '@/app/actions/user.actions';
import { canServer } from '@/lib/rbac-server';
import { connectToDatabase } from '@/lib/mongodb';
import {
  getExecutionTraceCollection,
  type TraceEvent,
} from '@/lib/sabflow/persistence/executionTraces';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/* ──────────────────────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────────────────────── */

/** Hard cap on total wall-clock replay delay across all events. */
const MAX_REPLAY_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/** Default replay speed multiplier (1× = real-time). */
const DEFAULT_SPEED = 1.0;

/** Minimum inter-event delay floor so fast flows don't send a burst. */
const MIN_DELAY_MS = 0;

/* ──────────────────────────────────────────────────────────────────────────
   SSE helpers
   ────────────────────────────────────────────────────────────────────────── */

const encoder = new TextEncoder();

function sseTrace(event: TraceEvent): Uint8Array {
  return encoder.encode(`event: trace\ndata: ${JSON.stringify(event)}\n\n`);
}

const SSE_DONE = encoder.encode('event: done\ndata: {}\n\n');

/* ──────────────────────────────────────────────────────────────────────────
   Auth helpers
   ────────────────────────────────────────────────────────────────────────── */

function resolveWorkspaceId(session: { user: unknown } | null): string {
  const u = (session?.user ?? {}) as {
    activeProjectId?: string;
    _id?: string | { toString(): string };
    id?: string;
  };
  return String(
    u.activeProjectId
      ?? (typeof u._id === 'string' ? u._id : u._id?.toString())
      ?? u.id
      ?? '',
  );
}

/** True when the caller holds the read or admin execution permission. */
async function hasReplayPermission(workspaceId: string): Promise<boolean> {
  const [okRead, okAdmin] = await Promise.all([
    canServer('sabflow.workflow.read', 'view', workspaceId),
    canServer('sabflow.execution.admin', 'edit', workspaceId),
  ]);
  return okRead || okAdmin;
}

/* ──────────────────────────────────────────────────────────────────────────
   Delay helper
   ────────────────────────────────────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ──────────────────────────────────────────────────────────────────────────
   Route context type (Next.js 15 async params)
   ────────────────────────────────────────────────────────────────────────── */

type RouteContext = { params: Promise<{ executionId: string }> };

/* ──────────────────────────────────────────────────────────────────────────
   GET handler
   ────────────────────────────────────────────────────────────────────────── */

export async function GET(req: NextRequest, { params }: RouteContext) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const workspaceId = resolveWorkspaceId(session);
  if (!workspaceId) {
    return new Response(
      JSON.stringify({ error: 'Workspace scope missing' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!(await hasReplayPermission(workspaceId))) {
    return new Response(
      JSON.stringify({ error: "You don't have permission to replay executions." }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 2. Route params & query params ───────────────────────────────────────
  const { executionId } = await params;

  if (!executionId || !ObjectId.isValid(executionId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid executionId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { searchParams } = new URL(req.url);

  const speedRaw = parseFloat(searchParams.get('speed') ?? '');
  const speed = Number.isFinite(speedRaw) && speedRaw > 0 ? speedRaw : DEFAULT_SPEED;

  const fromRaw = parseInt(searchParams.get('from') ?? '0', 10);
  const fromIndex = Number.isFinite(fromRaw) && fromRaw >= 0 ? fromRaw : 0;

  // ── 3. Authorise: execution's flow must belong to the caller's project ───
  // (mirrors the GET /executions/[id] pattern)
  const userId = String(
    (session.user as { _id?: string | { toString(): string } })._id?.toString()
      ?? (session.user as { id?: string }).id
      ?? '',
  );

  try {
    const { db } = await connectToDatabase();
    const execRow = await db.collection('sabflow_executions').findOne(
      { _id: new ObjectId(executionId) },
      { projection: { flowId: 1, projectId: 1 } },
    );
    if (!execRow) {
      return new Response(
        JSON.stringify({ error: 'Execution not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (ObjectId.isValid(execRow.flowId)) {
      const flow = await db.collection('sabflow_flows').findOne(
        { _id: new ObjectId(execRow.flowId) },
        { projection: { projectId: 1, userId: 1 } },
      );
      if (!flow) {
        return new Response(
          JSON.stringify({ error: 'Flow not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (
        flow.projectId !== workspaceId
        && flow.userId !== workspaceId
        && flow.userId !== userId
      ) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }
  } catch (err) {
    console.error('[SABFLOW REPLAY] pre-auth DB error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 4. Fetch trace events ─────────────────────────────────────────────────
  let events: TraceEvent[];
  try {
    const col = await getExecutionTraceCollection();
    const traceDoc = await col.findOne(
      { executionId: new ObjectId(executionId) },
      { projection: { events: 1 } },
    );

    if (!traceDoc) {
      // No trace persisted for this execution — stream done immediately.
      const emptyStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(SSE_DONE);
          controller.close();
        },
      });
      return new Response(emptyStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // Sort by `at` ascending — guarantees chronological replay even if events
    // were appended slightly out of order under concurrent writes.
    events = [...traceDoc.events].sort(
      (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
    );

    // Apply `from` offset — skip events whose itemIndex is below the threshold.
    // Events without an itemIndex (e.g. node_start, end) are always included;
    // the `from` param only gates itemIndex-bearing events.
    if (fromIndex > 0) {
      events = events.filter(
        (e) => e.itemIndex === undefined || e.itemIndex >= fromIndex,
      );
    }
  } catch (err) {
    console.error('[SABFLOW REPLAY] trace fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 5. Build streaming SSE response ──────────────────────────────────────
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let replayElapsedMs = 0;
      let prevAt: number | null = null;

      for (const event of events) {
        // Compute inter-event delay.
        const eventAt = new Date(event.at).getTime();

        if (prevAt !== null) {
          const rawDelta = Math.max(MIN_DELAY_MS, eventAt - prevAt);
          const scaledDelay = rawDelta / speed;
          const remainingBudget = MAX_REPLAY_DURATION_MS - replayElapsedMs;

          if (remainingBudget > 0 && scaledDelay > 0) {
            const actualDelay = Math.min(scaledDelay, remainingBudget);
            await sleep(actualDelay);
            replayElapsedMs += actualDelay;
          }
          // If budget is exhausted, fall through with no delay (flush remaining events).
        }

        prevAt = eventAt;
        controller.enqueue(sseTrace(event));
      }

      controller.enqueue(SSE_DONE);
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
