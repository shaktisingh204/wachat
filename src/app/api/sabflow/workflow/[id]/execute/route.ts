/**
 * SabFlow — Editor "Execute workflow" manual trigger.
 *
 * POST /api/sabflow/workflow/[id]/execute
 *
 * Request body:
 *   {
 *     pinData?: Record<string, unknown>;          // optional per-node pinned data
 *     mode: 'all' | 'singleNode';                 // run entire flow or a single node
 *     nodeId?: string;                            // required when mode === 'singleNode'
 *     inputItems?: unknown[];                     // input items to feed the single node
 *   }
 *
 * Response: { executionId, status: 'queued' }
 *
 * Behaviour:
 *   - Authenticates the caller via the project session cookie.
 *   - Gates on the `sabflow.workflow.execute` RBAC key.
 *   - Loads the workflow IR (the persisted `sabflows` document).
 *   - Inserts an `sabflow_executions` row in status `queued`.
 *   - Enqueues onto the BullMQ queue consumed by the PM2 `sabflow-worker`
 *     (Rust engine with TS fallback). The worker publishes live progress on
 *     `sabflow:exec:<executionId>`, consumed by the sibling SSE route.
 *   - `mode: 'singleNode'` is not supported by the worker yet and returns
 *     501 (it was designed for the Rust dispatcher loop, which is not
 *     deployed; the editor's single-node testing uses /api/sabflow/execute).
 *
 * Track B · Phase 6 · sub-task #6.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { enqueueWorkerExecution } from '@/lib/sabflow/queue/enqueue-worker';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

interface ExecuteBody {
    pinData?: Record<string, unknown>;
    mode?: 'all' | 'singleNode';
    nodeId?: string;
    inputItems?: unknown[];
}

export async function POST(req: NextRequest, { params }: RouteContext) {
    const { id: workflowId } = await params;

    // 1) Session check.
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 },
        );
    }

    if (!ObjectId.isValid(workflowId)) {
        return NextResponse.json(
            { error: 'Invalid workflow id' },
            { status: 400 },
        );
    }

    const projectId =
        (
            session.user as {
                _id?: string | { toString(): string };
                id?: string;
            }
        )._id?.toString() ??
        (session.user as { id?: string }).id ??
        '';

    // 2) RBAC — `sabflow.workflow.execute` is mapped to the canonical
    //    `wachat_flows` module (see src/config/dashboard-config.ts), so we
    //    enforce the `edit` action on it which is the closest semantic
    //    fit ("execute" is a write-side operation on a flow).
    const guard = await requirePermission(
        'wachat_flows',
        'edit',
        projectId,
    );
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: 403 });
    }

    // 3) Parse body.
    let body: ExecuteBody = {};
    try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
    } catch {
        return NextResponse.json(
            { error: 'Invalid JSON body' },
            { status: 400 },
        );
    }

    const mode: 'all' | 'singleNode' = body.mode ?? 'all';
    if (mode !== 'all' && mode !== 'singleNode') {
        return NextResponse.json(
            { error: "`mode` must be 'all' or 'singleNode'" },
            { status: 400 },
        );
    }
    if (mode === 'singleNode' && !body.nodeId) {
        return NextResponse.json(
            { error: "`nodeId` is required when mode is 'singleNode'" },
            { status: 400 },
        );
    }
    if (mode === 'singleNode') {
        // The queue worker runs whole flows only; single-node isolation was
        // designed for the Rust dispatcher loop, which is not deployed.
        // Failing loudly beats enqueueing a job nothing will ever consume.
        return NextResponse.json(
            {
                error:
                    "mode 'singleNode' is not supported by the queue worker yet — use the direct execute API for single-node testing",
            },
            { status: 501 },
        );
    }

    try {
        const { db } = await connectToDatabase();

        // 4) Load + scope-check the workflow IR.
        const workflow = await db.collection('sabflows').findOne({
            _id: new ObjectId(workflowId),
            userId: projectId,
        });
        if (!workflow) {
            return NextResponse.json(
                { error: 'Workflow not found or access denied' },
                { status: 404 },
            );
        }

        // 5) Mint an executionId + record the queued row so the SSE
        //    stream has something to read on its first tick.
        const executionId = new ObjectId().toHexString();
        const now = new Date();

        await db.collection('sabflow_executions').insertOne({
            executionId,
            flowId: workflowId,
            projectId,
            status: 'queued',
            triggerMode: 'manual',
            mode,
            startedAt: null,
            finishedAt: null,
            durationMs: null,
            error: null,
            createdAt: now,
            updatedAt: now,
        });

        // 6) Enqueue onto the BullMQ queue the PM2 sabflow-worker consumes.
        await enqueueWorkerExecution({
            executionId,
            flowId: workflowId,
            projectId,
            flowSnapshot: workflow,
            triggerMode: 'manual',
            triggerData: body.pinData ? { pinData: body.pinData } : undefined,
            variables: {},
        });

        return NextResponse.json(
            { executionId, status: 'queued' as const },
            { status: 202 },
        );
    } catch (err) {
        console.error('[SABFLOW WORKFLOW EXECUTE] POST error:', err);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 },
        );
    }
}
