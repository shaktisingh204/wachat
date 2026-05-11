/**
 * SabFlow — Public inbound webhook receiver
 *
 * GET/POST /api/sabflow/webhook/:webhookId
 *
 * Public endpoint — no session auth.  The webhookId itself is the
 * shared secret (UUID generated on activation).
 *
 * Behaviour by responseMode:
 *   "immediately" — enqueue job, return { executionId, status:"queued" } 200
 *   "lastNode"    — enqueue job, wait up to 30 s for completion via Redis
 *                   pub/sub, return the execution result or time out with 202
 *   "responseNode"— same wait but returns only the respond_to_webhook payload
 */

import { NextResponse, type NextRequest } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { SABFLOW_QUEUE, SABFLOW_EXEC_CHANNEL, SABFLOW_WEBHOOK_RESPONSE } from '@/lib/sabflow/worker/queues';
import { getWebhookByWebhookId } from '@/lib/sabflow/db';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ webhookId: string }> };

// ── BullMQ queue singleton ──────────────────────────────────────────────────

const redisConn = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

let _queue: Queue | null = null;
function getQueue(): Queue {
  if (!_queue) _queue = new Queue(SABFLOW_QUEUE, { connection: redisConn });
  return _queue;
}

// ── Auth verification ───────────────────────────────────────────────────────

function checkAuth(
  req: NextRequest,
  webhook: { authentication: string; authHeaderName?: string; authHeaderValue?: string },
): boolean {
  if (webhook.authentication === 'none') return true;
  if (webhook.authentication === 'header') {
    const name = (webhook.authHeaderName ?? 'Authorization').toLowerCase();
    return req.headers.get(name) === webhook.authHeaderValue;
  }
  if (webhook.authentication === 'query') {
    const token = new URL(req.url).searchParams.get('token');
    return token === webhook.authHeaderValue;
  }
  if (webhook.authentication === 'basic') {
    const header = req.headers.get('authorization') ?? '';
    if (!header.startsWith('Basic ')) return false;
    const decoded = Buffer.from(header.slice(6), 'base64').toString();
    const [user, pass] = decoded.split(':', 2);
    const [expectedUser, expectedPass] = (webhook.authHeaderValue ?? ':').split(':', 2);
    return user === expectedUser && pass === expectedPass;
  }
  return false;
}

// ── Wait for execution via Redis pub/sub ────────────────────────────────────

async function waitForExecution(
  executionId: string,
  channel: string,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let subscriber: Redis | null = null;
    const timer = setTimeout(() => {
      subscriber?.unsubscribe(channel).catch(() => {});
      subscriber?.disconnect();
      resolve(null);
    }, timeoutMs);

    try {
      subscriber = new Redis({ ...redisConn, lazyConnect: true, enableReadyCheck: false });
      subscriber.connect().then(() => {
        subscriber!.subscribe(channel, (err) => {
          if (err) { clearTimeout(timer); resolve(null); return; }
        });
        subscriber!.on('message', (_ch: string, msg: string) => {
          try {
            const data = JSON.parse(msg) as Record<string, unknown>;
            const status = data.status as string;
            if (status === 'success' || status === 'error' || status === 'cancelled') {
              clearTimeout(timer);
              subscriber?.unsubscribe(channel).catch(() => {});
              subscriber?.disconnect();
              resolve(data);
            }
          } catch { /* ignore malformed */ }
        });
      }).catch(() => { clearTimeout(timer); resolve(null); });
    } catch {
      clearTimeout(timer);
      resolve(null);
    }
  });
}

// ── Core handler ────────────────────────────────────────────────────────────

async function handleWebhook(req: NextRequest, webhookId: string): Promise<NextResponse> {
  const webhook = await getWebhookByWebhookId(webhookId);
  if (!webhook || !webhook.isActive) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  // Method check (ANY passes everything)
  if (webhook.method !== 'ANY' && req.method !== webhook.method) {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Auth check
  if (!checkAuth(req, webhook)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse trigger data
  let triggerData: unknown = null;
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      triggerData = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      triggerData = Object.fromEntries(new URLSearchParams(text));
    } else {
      const text = await req.text();
      if (text) {
        try { triggerData = JSON.parse(text); } catch { triggerData = { raw: text }; }
      }
    }
  } catch { /* ignore */ }

  // Also capture URL query params
  const queryParams = Object.fromEntries(new URL(req.url).searchParams);

  const payload = {
    body: triggerData,
    query: queryParams,
    headers: Object.fromEntries(req.headers),
    method: req.method,
  };

  const { db } = await connectToDatabase();

  // Get the flow snapshot
  const flow = await db.collection('sabflows').findOne(
    ObjectId.isValid(webhook.flowId)
      ? { _id: new ObjectId(webhook.flowId), userId: webhook.userId }
      : { userId: webhook.userId },
  );
  if (!flow) {
    return NextResponse.json({ error: 'Flow not found or inactive' }, { status: 404 });
  }

  const executionId = new ObjectId().toHexString();
  const now = new Date();

  await db.collection('sabflow_executions').insertOne({
    executionId,
    flowId: webhook.flowId,
    projectId: webhook.userId,
    status: 'queued',
    triggerMode: 'webhook',
    startedAt: null,
    finishedAt: null,
    durationMs: null,
    error: null,
    createdAt: now,
    updatedAt: now,
  });

  await getQueue().add(
    'execute',
    {
      executionId,
      flowId: webhook.flowId,
      projectId: webhook.userId,
      flowSnapshot: flow,
      triggerMode: 'webhook',
      triggerData: payload,
      variables: {},
    },
    {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  );

  if (webhook.responseMode === 'immediately') {
    return NextResponse.json(
      { executionId, status: 'queued' },
      { status: 200 },
    );
  }

  // lastNode / responseNode: wait up to 30 s
  const channel =
    webhook.responseMode === 'responseNode'
      ? SABFLOW_WEBHOOK_RESPONSE(executionId)
      : SABFLOW_EXEC_CHANNEL(executionId);

  const result = await waitForExecution(executionId, channel, 30_000);

  if (!result) {
    // Timed out — return 202 so caller knows it's still running
    return NextResponse.json({ executionId, status: 'running' }, { status: 202 });
  }

  if (result.status === 'error') {
    return NextResponse.json(
      { executionId, status: 'error', error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ executionId, status: 'success', data: result.data ?? result });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { webhookId } = await params;
  return handleWebhook(req, webhookId);
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { webhookId } = await params;
  return handleWebhook(req, webhookId);
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { webhookId } = await params;
  return handleWebhook(req, webhookId);
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { webhookId } = await params;
  return handleWebhook(req, webhookId);
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { webhookId } = await params;
  return handleWebhook(req, webhookId);
}
