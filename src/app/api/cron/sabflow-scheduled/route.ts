/**
 * GET /api/cron/sabflow-scheduled
 *
 * Vercel Cron driver for SabFlow schedule triggers.  Runs once a minute via
 * the entry in `vercel.json` — scans every flow for an enabled schedule
 * event whose `cronExpression` matches the current minute, then fires
 * `executeFlow` for each match.
 *
 * Native Vercel primitive — no node-cron / agenda / Bull (per project rule
 * "Deployment platform — Vercel (native, not integration)" in CLAUDE.md).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` — Vercel attaches it
 * automatically on scheduled invocations.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSabFlowCollection, createExecutionHistory, updateExecutionHistory } from '@/lib/sabflow/db';
import { executeFlow } from '@/lib/sabflow/engine';
import { ConcurrencyLimitError } from '@/lib/sabflow/engine/executeFlow';
import type {
  SabFlowDoc,
  ScheduleEventOptions,
  SabFlowEvent,
} from '@/lib/sabflow/types';
import type { SessionState } from '@/lib/sabflow/engine/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Functions default cap.

export async function GET(req: NextRequest) {
  // Vercel attaches Authorization: Bearer $CRON_SECRET on every cron hit.
  // Reject anything else to prevent random web traffic from triggering runs.
  if (!isAuthorisedCronRequest(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  console.log(`[SABFLOW CRON] tick at ${now.toISOString()}`);

  try {
    const col = await getSabFlowCollection();
    // Only published flows with a schedule event participate.  Mongo query
    // filters at the database level so cold starts stay cheap.
    const due = await col
      .find({
        status: 'PUBLISHED',
        'events.type': 'schedule',
      })
      .toArray();

    const results: Array<{
      flowId: string;
      eventId: string;
      status: 'fired' | 'skipped' | 'error' | 'concurrency';
      message?: string;
    }> = [];

    for (const flow of due) {
      for (const event of flow.events ?? []) {
        if (event.type !== 'schedule') continue;
        const opts = event.options as ScheduleEventOptions | undefined;
        if (!opts || opts.enabled === false) continue;
        if (!opts.cronExpression) continue;
        if (!cronExpressionMatches(opts.cronExpression, now, opts.timezone)) {
          continue;
        }

        const outcome = await fireScheduledFlow(flow, event);
        results.push({
          flowId: flow._id!.toString(),
          eventId: event.id,
          ...outcome,
        });
      }
    }

    console.log(`[SABFLOW CRON] processed ${results.length} match(es)`);
    return NextResponse.json({
      ok: true,
      tick: now.toISOString(),
      fired: results.filter((r) => r.status === 'fired').length,
      results,
    });
  } catch (err) {
    console.error('[SABFLOW CRON] tick error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
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

/**
 * Minimal cron-expression matcher — supports the subset SabFlow surfaces in
 * the UI today: `m h dom mon dow`, with `*`, `*\/N`, ranges (`a-b`), and
 * lists (`a,b,c`) on each field.  Returns true when `now` matches.
 *
 * Timezone defaults to UTC; pass an IANA tz to evaluate in another zone.
 */
function cronExpressionMatches(
  expr: string,
  now: Date,
  timezone?: string,
): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const zoned = timezone ? new Date(now.toLocaleString('en-US', { timeZone: timezone })) : now;
  const [m, h, dom, mon, dow] = parts;
  return (
    matchField(m, zoned.getMinutes(), 0, 59) &&
    matchField(h, zoned.getHours(), 0, 23) &&
    matchField(dom, zoned.getDate(), 1, 31) &&
    matchField(mon, zoned.getMonth() + 1, 1, 12) &&
    matchField(dow, zoned.getDay(), 0, 6)
  );
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;
  for (const token of field.split(',')) {
    const stepMatch = /^(.*)\/(\d+)$/.exec(token);
    if (stepMatch) {
      const base = stepMatch[1] === '*' ? `${min}-${max}` : stepMatch[1];
      const step = Number(stepMatch[2]);
      if (!Number.isFinite(step) || step <= 0) continue;
      const [lo, hi] = parseRange(base, min, max);
      for (let v = lo; v <= hi; v += step) if (v === value) return true;
      continue;
    }
    const [lo, hi] = parseRange(token, min, max);
    if (value >= lo && value <= hi) return true;
  }
  return false;
}

function parseRange(token: string, min: number, max: number): [number, number] {
  if (token === '*') return [min, max];
  const m = /^(\d+)(?:-(\d+))?$/.exec(token);
  if (!m) return [-1, -2]; // never matches
  const lo = Number(m[1]);
  const hi = m[2] !== undefined ? Number(m[2]) : lo;
  return [lo, hi];
}

async function fireScheduledFlow(
  flow: SabFlowDoc,
  event: SabFlowEvent,
): Promise<{ status: 'fired' | 'skipped' | 'error' | 'concurrency'; message?: string }> {
  const flowId = flow._id!.toString();

  // Skip if the flow has no executable starting block.
  const startGroupId = flow.groups[0]?.id;
  if (!startGroupId) {
    return { status: 'skipped', message: 'no executable groups' };
  }

  const session: SessionState = {
    flowId,
    currentGroupId: startGroupId,
    currentBlockIndex: 0,
    variables: seedVarsFromFlow(flow),
    history: [],
  };

  const created = await createExecutionHistory({
    flowId,
    sessionId: `cron:${event.id}:${Date.now()}`,
    triggerMode: 'schedule',
    startedAt: new Date(),
    status: 'running',
    nodeCount: 0,
  });

  const startedAt = Date.now();
  try {
    const result = await executeFlow(flow, session);
    await updateExecutionHistory(created.id, {
      finishedAt: new Date(),
      status: result.result.isCompleted ? 'success' : 'running',
      nodeCount: result.updatedSession.history.length,
      executionTimeMs: Date.now() - startedAt,
      variables: result.result.updatedVariables as Record<string, unknown>,
    });
    return { status: 'fired' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConcurrency = err instanceof ConcurrencyLimitError;
    await updateExecutionHistory(created.id, {
      finishedAt: new Date(),
      status: isConcurrency ? 'cancelled' : 'error',
      error: msg,
    });
    if (isConcurrency) {
      return { status: 'concurrency', message: msg };
    }
    console.error(`[SABFLOW CRON] error flow=${flowId} event=${event.id}:`, err);
    return { status: 'error', message: msg };
  }
}

function seedVarsFromFlow(flow: SabFlowDoc): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of flow.variables ?? []) {
    if (v.defaultValue !== undefined) out[v.name] = String(v.defaultValue);
    else if (v.value !== undefined) out[v.name] = String(v.value);
  }
  return out;
}
