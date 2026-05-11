/**
 * SabFlow — Live execution log streaming via SSE
 *
 * GET /api/sabflow/executions/[executionId]/stream
 *
 * Subscribes to the Redis pub/sub channel `sabflow:exec:{executionId}` and
 * streams `ExecutionUpdate` events to the client as Server-Sent Events until
 * the execution reaches a terminal state (success, error, cancelled) or the
 * client disconnects.
 *
 * Falls back to polling MongoDB every 2 s when Redis pub/sub is unavailable.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { SABFLOW_EXEC_CHANNEL } from '@/lib/sabflow/worker/queues';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TERMINAL_STATUSES = new Set(['success', 'error', 'cancelled']);
const POLL_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 10 * 60 * 1000; // 10 min timeout

type RouteContext = { params: Promise<{ executionId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { executionId } = await params;
  const projectId =
    (session.user as { _id?: string | { toString(): string }; id?: string })._id?.toString()
    ?? (session.user as { id?: string }).id
    ?? '';

  const encoder = new TextEncoder();

  function sseEvent(data: unknown): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const { db } = await connectToDatabase();
      const col = db.collection('sabflow_executions');

      let done = false;
      const deadline = Date.now() + MAX_WAIT_MS;

      // Initial fetch
      const initial = await col.findOne({ executionId, projectId });
      if (!initial) {
        controller.enqueue(sseEvent({ error: 'Execution not found' }));
        controller.close();
        return;
      }

      controller.enqueue(sseEvent({ type: 'snapshot', data: initial }));

      if (TERMINAL_STATUSES.has(initial.status)) {
        controller.close();
        return;
      }

      // Try Redis pub/sub; fall back to polling if unavailable
      let useRedis = false;
      let redisClient: import('ioredis').Redis | null = null;

      try {
        const { Redis } = await import('ioredis');
        redisClient = new Redis({
          host: process.env.REDIS_HOST ?? 'localhost',
          port: Number(process.env.REDIS_PORT ?? 6379),
          ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
          lazyConnect: true,
          enableReadyCheck: false,
        });
        await redisClient.connect();
        useRedis = true;
      } catch {
        // Redis unavailable — fall back to polling
      }

      if (useRedis && redisClient) {
        const channel = SABFLOW_EXEC_CHANNEL(executionId);
        await redisClient.subscribe(channel);

        redisClient.on('message', (_ch: string, msg: string) => {
          try {
            const update = JSON.parse(msg);
            controller.enqueue(sseEvent({ type: 'update', data: update }));
            if (TERMINAL_STATUSES.has(update.status)) {
              done = true;
              redisClient?.quit().catch(() => {});
              controller.close();
            }
          } catch {
            // ignore malformed messages
          }
        });

        // Heartbeat
        const heartbeat = setInterval(() => {
          if (done || Date.now() > deadline) {
            clearInterval(heartbeat);
            if (!done) {
              redisClient?.quit().catch(() => {});
              controller.close();
            }
            return;
          }
          controller.enqueue(encoder.encode(': ping\n\n'));
        }, 15_000);

      } else {
        // Polling fallback
        const poll = async () => {
          while (!done && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
            try {
              const row = await col.findOne({ executionId, projectId });
              if (!row) break;
              controller.enqueue(sseEvent({ type: 'update', data: row }));
              if (TERMINAL_STATUSES.has(row.status)) {
                done = true;
                controller.close();
                return;
              }
            } catch {
              // ignore transient DB errors
            }
          }
          if (!done) {
            controller.enqueue(sseEvent({ type: 'timeout' }));
            controller.close();
          }
        };
        poll().catch(() => controller.close());
      }
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
