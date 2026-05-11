/**
 * SabFlow — Trigger a background execution via BullMQ
 *
 * POST /api/sabflow/[flowId]/trigger
 *   Body (optional): { triggerMode?, triggerData?, variables? }
 *   → { executionId, status: "queued" }
 *
 * Creates an ExecutionRecord in sabflow_executions with status "queued",
 * then enqueues a BullMQ job so the sabflow-worker picks it up.
 * The Rust engine endpoint is preferred when the Rust server is available;
 * this route acts as the Next.js fallback that writes directly to MongoDB +
 * Redis without going through the Rust BFF.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { ObjectId } from 'mongodb';
import { Queue } from 'bullmq';
import { SABFLOW_QUEUE } from '@/lib/sabflow/worker/queues';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ flowId: string }> };

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

let queue: Queue | null = null;
function getQueue(): Queue {
  if (!queue) queue = new Queue(SABFLOW_QUEUE, { connection });
  return queue;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { flowId } = await params;

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!ObjectId.isValid(flowId)) {
    return NextResponse.json({ error: 'Invalid flow ID' }, { status: 400 });
  }

  let body: {
    triggerMode?: string;
    triggerData?: unknown;
    variables?: Record<string, string>;
  } = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const projectId = (session.user as { _id?: string | { toString(): string }; id?: string })._id?.toString()
    ?? (session.user as { id?: string }).id
    ?? '';

  try {
    const { db } = await connectToDatabase();

    // Verify ownership
    const flow = await db.collection('sabflows').findOne({
      _id: new ObjectId(flowId),
      userId: projectId,
    });
    if (!flow) {
      return NextResponse.json({ error: 'Flow not found or access denied' }, { status: 404 });
    }

    const executionId = new ObjectId().toHexString();
    const now = new Date();

    // Insert the execution record
    await db.collection('sabflow_executions').insertOne({
      executionId,
      flowId,
      projectId,
      status: 'queued',
      triggerMode: body.triggerMode ?? 'manual',
      startedAt: null,
      finishedAt: null,
      durationMs: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    });

    // Enqueue BullMQ job
    await getQueue().add(
      'execute',
      {
        executionId,
        flowId,
        projectId,
        flowSnapshot: flow,
        triggerMode: body.triggerMode ?? 'manual',
        triggerData: body.triggerData,
        variables: body.variables ?? {},
      },
      {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 500 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );

    return NextResponse.json({ executionId, status: 'queued' }, { status: 202 });
  } catch (err) {
    console.error('[SABFLOW TRIGGER] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
