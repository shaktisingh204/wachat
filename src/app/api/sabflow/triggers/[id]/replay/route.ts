/**
 * SabFlow — replay missed trigger fires (API route).
 *
 * POST `/api/sabflow/triggers/[id]/replay`
 *   Body: `{ from: string; to: string; dryRun?: boolean }` (ISO timestamps).
 *
 * Auth: requires BOTH
 *   - `sabflow.workflow.execute` (can fire workflow runs)
 *   - `sabflow.trigger.admin`   (can manage trigger sources)
 *
 * Hard cap: `to - from ≤ 30 days`. The library re-checks this defensively;
 * we reject early to avoid loading any flow state for an obviously bad request.
 *
 * Track B · Phase 6 · sub-task #10 of 10.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import {
  replayTriggerWindow,
  ReplayWindowError,
} from '@/lib/sabflow/triggers/replay';

export const dynamic = 'force-dynamic';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface ReplayBody {
  from?: unknown;
  to?: unknown;
  dryRun?: unknown;
}

function parseIsoDate(value: unknown, field: 'from' | 'to'): Date | { error: string } {
  if (typeof value !== 'string' || !value) {
    return { error: `\`${field}\` is required and must be an ISO timestamp string.` };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { error: `\`${field}\` is not a valid ISO timestamp.` };
  }
  return d;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // Next.js 15+: dynamic route params are async.
  const { id: triggerId } = await context.params;
  if (!triggerId || typeof triggerId !== 'string') {
    return NextResponse.json({ error: 'Missing trigger id.' }, { status: 400 });
  }

  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }
  const requesterId = String(session.user._id ?? '');
  // Workspace scope: use the user's active project id (carried on session.user
  // by the identity service). Replay never crosses tenants.
  const workspaceId = String(
    (session.user as { activeProjectId?: string }).activeProjectId ??
      (session.user as { _id?: string })._id ??
      '',
  );
  if (!requesterId || !workspaceId) {
    return NextResponse.json({ error: 'Workspace scope missing.' }, { status: 400 });
  }

  // Forward-declared RBAC keys: `sabflow.workflow.execute` and
  // `sabflow.trigger.admin`. The `requirePermission` helper takes a single
  // moduleKey, so we check both keys in series. Either failure surfaces as 403.
  const execGuard = await requirePermission('sabflow.workflow.execute', 'edit', workspaceId);
  if (!execGuard.ok) {
    return NextResponse.json({ error: execGuard.error }, { status: 403 });
  }
  const adminGuard = await requirePermission('sabflow.trigger.admin', 'edit', workspaceId);
  if (!adminGuard.ok) {
    return NextResponse.json({ error: adminGuard.error }, { status: 403 });
  }

  // ── 2. Body parsing ────────────────────────────────────────────────────────
  let body: ReplayBody;
  try {
    body = (await request.json()) as ReplayBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const fromOrErr = parseIsoDate(body.from, 'from');
  if ('error' in fromOrErr) {
    return NextResponse.json({ error: fromOrErr.error }, { status: 400 });
  }
  const toOrErr = parseIsoDate(body.to, 'to');
  if ('error' in toOrErr) {
    return NextResponse.json({ error: toOrErr.error }, { status: 400 });
  }
  const from = fromOrErr;
  const to = toOrErr;

  if (to.getTime() <= from.getTime()) {
    return NextResponse.json(
      { error: '`to` must be strictly after `from`.' },
      { status: 400 },
    );
  }
  if (to.getTime() - from.getTime() > THIRTY_DAYS_MS) {
    return NextResponse.json(
      { error: 'Replay window cannot exceed 30 days.' },
      { status: 400 },
    );
  }

  const dryRun = body.dryRun === true;

  // ── 3. Delegate ────────────────────────────────────────────────────────────
  try {
    const result = await replayTriggerWindow({
      triggerId,
      from,
      to,
      requesterId,
      workspaceId,
      dryRun,
    });

    return NextResponse.json({
      triggerId,
      source: result.source,
      dryRun: result.dryRun,
      replayed: result.replayed,
      skipped: result.skipped,
      counts: {
        replayed: result.replayed.length,
        skipped: result.skipped.length,
      },
    });
  } catch (err) {
    if (err instanceof ReplayWindowError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[SABFLOW REPLAY] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
