/**
 * SabFlow — Pin / unpin execution rows.
 *
 *   POST   /api/sabflow/executions/[executionId]/pin
 *     → marks `sabflow_executions.pinned = true` AND clears `expiresAt`
 *       on the matching `sabflow_execution_traces` row so the trace
 *       bypasses the rolling 30-day TTL.
 *
 *   DELETE /api/sabflow/executions/[executionId]/pin
 *     → marks `sabflow_executions.pinned = false` AND re-applies
 *       `expiresAt = now() + 30d` on the trace, putting it back into
 *       the rolling retention window.
 *
 * Authorisation: caller's flow must belong to their project AND they
 * must hold one of:
 *
 *   • `sabflow.execution.pin`   (POST)   or `sabflow.execution.admin`
 *   • `sabflow.execution.unpin` (DELETE) or `sabflow.execution.admin`
 *
 * These keys are reserved in `src/lib/sabflow/rbac-keys.ts` but NOT yet
 * registered globally — per the credentials-rbac forward-declaration
 * pattern (registration happens in Phase B.8 §1).
 *
 * Audit: every pin / unpin emits an audit row under the `exec.*`
 * namespace (`exec.pinned` / `exec.unpinned`) via the existing audit
 * middleware (`recordFlowAction`).
 *
 * Track C · Phase 9 · sub-task #4 of N.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { canServer } from '@/lib/rbac-server';
import { getExecutionById } from '@/lib/sabflow/db';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Rolling trace TTL — must stay in sync with whatever populates `expiresAt` on insert. */
const TRACE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/* ──────────────────────────────────────────────────────────────────────────
   RBAC helpers — forward-declared keys.
   ────────────────────────────────────────────────────────────────────────── */

/**
 * Resolve a workspace id for permission checks.  Mirrors the trigger-replay
 * route — prefer the active project, fall back to the user's own id for
 * single-tenant workspaces.
 */
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

/**
 * True when the caller can perform the given pin action.  Accepts the
 * specific key (`sabflow.execution.pin` / `sabflow.execution.unpin`) OR the
 * catch-all `sabflow.execution.admin`.
 */
async function hasExecutionPinPermission(
    action: 'pin' | 'unpin',
    workspaceId: string,
): Promise<boolean> {
    const specific = `sabflow.execution.${action}`;
    // `edit` is the action verb mapped on permission-module entries; until
    // these keys land in `permission-modules.ts` it falls through to the
    // owner / role-derived grants from `DEFAULT_SABFLOW_ROLE_GRANTS`.
    const [okSpecific, okAdmin] = await Promise.all([
        canServer(specific, 'edit', workspaceId),
        canServer('sabflow.execution.admin', 'edit', workspaceId),
    ]);
    return okSpecific || okAdmin;
}

/* ──────────────────────────────────────────────────────────────────────────
   Shared authorisation — confirm the execution belongs to the caller's flow.
   ────────────────────────────────────────────────────────────────────────── */

type AuthOk = {
    ok: true;
    executionId: string;
    flowId: string;
    workspaceId: string;
    userId: string;
};
type AuthErr = { ok: false; status: number; error: string };

async function authoriseExecution(
    req: NextRequest,
    executionIdRaw: string | undefined,
): Promise<AuthOk | AuthErr> {
    const session = await getSession();
    if (!session?.user) {
        return { ok: false, status: 401, error: 'Authentication required' };
    }

    if (!executionIdRaw) {
        return { ok: false, status: 400, error: 'Missing executionId' };
    }
    if (!ObjectId.isValid(executionIdRaw)) {
        return { ok: false, status: 400, error: 'Invalid executionId' };
    }

    const userId = String(
        (session.user as { _id?: string | { toString(): string } })._id?.toString()
            ?? (session.user as { id?: string }).id
            ?? '',
    );
    if (!userId) {
        return { ok: false, status: 401, error: 'Authentication required' };
    }
    const workspaceId = resolveWorkspaceId(session);
    if (!workspaceId) {
        return { ok: false, status: 400, error: 'Workspace scope missing' };
    }

    const execution = await getExecutionById(executionIdRaw);
    if (!execution) {
        return { ok: false, status: 404, error: 'Execution not found' };
    }

    if (!ObjectId.isValid(execution.flowId)) {
        return { ok: false, status: 400, error: 'Invalid flow id on execution' };
    }
    const { db } = await connectToDatabase();
    const flow = await db.collection('sabflow_flows').findOne(
        { _id: new ObjectId(execution.flowId) },
        { projection: { projectId: 1, userId: 1 } },
    );
    if (!flow) {
        return { ok: false, status: 404, error: 'Flow not found' };
    }
    // Same authorisation shape as the GET execution detail route — the
    // execution's flow must belong to the caller's project OR be owned by them.
    if (flow.projectId !== workspaceId && flow.userId !== workspaceId && flow.userId !== userId) {
        return { ok: false, status: 403, error: 'Forbidden' };
    }

    void req; // request currently unused beyond the audit hook (see callers).
    return { ok: true, executionId: executionIdRaw, flowId: execution.flowId, workspaceId, userId };
}

/* ──────────────────────────────────────────────────────────────────────────
   Trace TTL mutation helpers.
   ────────────────────────────────────────────────────────────────────────── */

interface TraceTtlPatchResult {
    matchedTrace: boolean;
    modifiedTrace: boolean;
}

/**
 * Pin: drop the `expiresAt` field on the matching trace row so the Mongo TTL
 * monitor never sweeps it.  Match by `executionId` — the trace collection's
 * canonical foreign key.
 */
async function clearTraceExpiry(executionId: string): Promise<TraceTtlPatchResult> {
    const { db } = await connectToDatabase();
    const res = await db.collection('sabflow_execution_traces').updateOne(
        { executionId },
        { $unset: { expiresAt: '' } },
    );
    return { matchedTrace: res.matchedCount > 0, modifiedTrace: res.modifiedCount > 0 };
}

/**
 * Unpin: re-apply a rolling 30-day expiry so the trace flows back into the
 * normal retention window.
 */
async function restoreTraceExpiry(executionId: string): Promise<TraceTtlPatchResult> {
    const { db } = await connectToDatabase();
    const expiresAt = new Date(Date.now() + TRACE_TTL_MS);
    const res = await db.collection('sabflow_execution_traces').updateOne(
        { executionId },
        { $set: { expiresAt } },
    );
    return { matchedTrace: res.matchedCount > 0, modifiedTrace: res.modifiedCount > 0 };
}

/* ──────────────────────────────────────────────────────────────────────────
   POST — pin
   ────────────────────────────────────────────────────────────────────────── */

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ executionId: string }> },
) {
    const { executionId } = await ctx.params;
    const guard = await authoriseExecution(req, executionId);
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    if (!(await hasExecutionPinPermission('pin', guard.workspaceId))) {
        return NextResponse.json(
            { error: "You don't have permission to pin executions." },
            { status: 403 },
        );
    }

    try {
        const { db } = await connectToDatabase();
        const execRes = await db.collection('sabflow_executions').updateOne(
            { _id: new ObjectId(guard.executionId) },
            { $set: { pinned: true, pinnedAt: new Date() } },
        );
        if (execRes.matchedCount === 0) {
            return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
        }

        const traceRes = await clearTraceExpiry(guard.executionId);

        // Fire-and-forget audit row — never blocks the response.
        void recordFlowAction('exec.pinned', {
            userId: guard.userId,
            workspaceId: guard.workspaceId,
            flowId: guard.flowId,
            target: guard.executionId,
            request: req,
            metadata: {
                traceMatched: traceRes.matchedTrace,
                traceModified: traceRes.modifiedTrace,
            },
        });

        console.log(
            `[SABFLOW EXEC PIN] user=${guard.userId} exec=${guard.executionId} flow=${guard.flowId} traceMatched=${traceRes.matchedTrace}`,
        );

        return NextResponse.json({
            ok: true,
            executionId: guard.executionId,
            pinned: true,
            trace: traceRes,
        });
    } catch (err) {
        console.error('[SABFLOW EXEC PIN] POST error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/* ──────────────────────────────────────────────────────────────────────────
   DELETE — unpin
   ────────────────────────────────────────────────────────────────────────── */

export async function DELETE(
    req: NextRequest,
    ctx: { params: Promise<{ executionId: string }> },
) {
    const { executionId } = await ctx.params;
    const guard = await authoriseExecution(req, executionId);
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    if (!(await hasExecutionPinPermission('unpin', guard.workspaceId))) {
        return NextResponse.json(
            { error: "You don't have permission to unpin executions." },
            { status: 403 },
        );
    }

    try {
        const { db } = await connectToDatabase();
        const execRes = await db.collection('sabflow_executions').updateOne(
            { _id: new ObjectId(guard.executionId) },
            { $set: { pinned: false }, $unset: { pinnedAt: '' } },
        );
        if (execRes.matchedCount === 0) {
            return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
        }

        const traceRes = await restoreTraceExpiry(guard.executionId);

        void recordFlowAction('exec.unpinned', {
            userId: guard.userId,
            workspaceId: guard.workspaceId,
            flowId: guard.flowId,
            target: guard.executionId,
            request: req,
            metadata: {
                traceMatched: traceRes.matchedTrace,
                traceModified: traceRes.modifiedTrace,
            },
        });

        console.log(
            `[SABFLOW EXEC UNPIN] user=${guard.userId} exec=${guard.executionId} flow=${guard.flowId} traceMatched=${traceRes.matchedTrace}`,
        );

        return NextResponse.json({
            ok: true,
            executionId: guard.executionId,
            pinned: false,
            trace: traceRes,
        });
    } catch (err) {
        console.error('[SABFLOW EXEC PIN] DELETE error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
