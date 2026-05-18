/**
 * SabFlow — Live progress SSE for the editor's "Execute workflow" button.
 *
 * GET /api/sabflow/workflow/[id]/execute/[executionId]/stream
 *
 * Subscribes to the Redis pub/sub channel `sabflow:exec:<executionId>` and
 * relays every message as an SSE event whose `event:` name matches the
 * payload's `type` field. The dispatcher emits:
 *
 *   - `node.started`
 *   - `node.finished`
 *   - `node.error`
 *   - `execution.finished`
 *
 * Lifecycle:
 *   - Closes immediately on `execution.finished` (terminal).
 *   - Closes after 30 seconds with `event: timeout` if no terminal event
 *     has been observed. The client can reconnect to keep watching.
 *
 * Track B · Phase 6 · sub-task #6 (sibling of the POST route).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { SABFLOW_EXEC_CHANNEL } from '@/lib/sabflow/worker/queues';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SSE_TIMEOUT_MS = 30_000;
const HEARTBEAT_MS = 10_000;

type RouteContext = {
    params: Promise<{ id: string; executionId: string }>;
};

/** Events we forward straight through to the client. */
const RELAYED_EVENTS = new Set([
    'node.started',
    'node.finished',
    'node.error',
    'execution.finished',
]);

export async function GET(_req: NextRequest, { params }: RouteContext) {
    const { id: workflowId, executionId } = await params;

    // 1) Session + RBAC. Same gates as the POST sibling.
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 },
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

    const guard = await requirePermission(
        'wachat_flows',
        'edit',
        projectId,
    );
    if (!guard.ok) {
        return NextResponse.json({ error: guard.error }, { status: 403 });
    }

    if (!workflowId || !executionId) {
        return NextResponse.json(
            { error: 'workflow id and executionId are required' },
            { status: 400 },
        );
    }

    const encoder = new TextEncoder();

    /**
     * Format an SSE frame. `eventName` is omitted for comments/heartbeats.
     * The spec says `data:` is mandatory for events with a non-default name.
     */
    function sseFrame(eventName: string | null, data: unknown): Uint8Array {
        const parts: string[] = [];
        if (eventName) parts.push(`event: ${eventName}`);
        parts.push(`data: ${JSON.stringify(data ?? {})}`);
        return encoder.encode(parts.join('\n') + '\n\n');
    }

    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            let closed = false;
            let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
            let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
            let redisClient:
                | import('ioredis').Redis
                | { quit: () => Promise<unknown> }
                | null = null;

            const safeEnqueue = (chunk: Uint8Array) => {
                if (closed) return;
                try {
                    controller.enqueue(chunk);
                } catch {
                    // controller already torn down
                }
            };

            const cleanupAndClose = (reason: 'terminal' | 'timeout') => {
                if (closed) return;
                closed = true;
                if (heartbeatTimer) clearInterval(heartbeatTimer);
                if (timeoutTimer) clearTimeout(timeoutTimer);
                if (reason === 'timeout') {
                    try {
                        controller.enqueue(sseFrame('timeout', { executionId }));
                    } catch {
                        // ignore
                    }
                }
                redisClient?.quit().catch(() => {});
                try {
                    controller.close();
                } catch {
                    // already closed
                }
            };

            // 30s hard ceiling per spec.
            timeoutTimer = setTimeout(
                () => cleanupAndClose('timeout'),
                SSE_TIMEOUT_MS,
            );

            // Keep the connection warm so intermediaries don't reap it.
            heartbeatTimer = setInterval(() => {
                safeEnqueue(encoder.encode(': ping\n\n'));
            }, HEARTBEAT_MS);

            // 2) Subscribe to the dispatcher's pub/sub channel.
            try {
                const { Redis } = await import('ioredis');
                const client = new Redis({
                    host: process.env.REDIS_HOST ?? 'localhost',
                    port: Number(process.env.REDIS_PORT ?? 6379),
                    ...(process.env.REDIS_PASSWORD
                        ? { password: process.env.REDIS_PASSWORD }
                        : {}),
                    lazyConnect: true,
                    enableReadyCheck: false,
                });
                await client.connect();
                redisClient = client;

                const channel = SABFLOW_EXEC_CHANNEL(executionId);
                await client.subscribe(channel);

                client.on('message', (_ch: string, raw: string) => {
                    if (closed) return;
                    let payload: { type?: string } & Record<string, unknown>;
                    try {
                        payload = JSON.parse(raw);
                    } catch {
                        return; // ignore malformed
                    }

                    const evt = payload.type;
                    if (!evt || !RELAYED_EVENTS.has(evt)) {
                        // Forward unknown events on the default channel so
                        // clients that listen with `onmessage` still see them.
                        safeEnqueue(sseFrame(null, payload));
                        return;
                    }

                    safeEnqueue(sseFrame(evt, payload));

                    if (evt === 'execution.finished') {
                        cleanupAndClose('terminal');
                    }
                });

                client.on('error', () => {
                    // A broken subscription is non-recoverable for this
                    // request — close so the client can re-open.
                    cleanupAndClose('terminal');
                });
            } catch (err) {
                console.error(
                    '[SABFLOW WORKFLOW EXECUTE STREAM] Redis subscribe failed:',
                    err,
                );
                cleanupAndClose('terminal');
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
