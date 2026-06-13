/**
 * GET /api/sabmail/stream
 *
 * Server-Sent Events (SSE) endpoint that pushes real-time inbox updates to the
 * browser. The long-lived IMAP sync worker (`src/workers/sabmail-sync.ts`)
 * `publishNewMail`s a lightweight notification to the per-workspace Redis
 * channel `sabmail:${workspaceId}` whenever new mail lands; this route owns a
 * DEDICATED Redis subscriber on that channel and relays each message to the
 * connected client as an SSE frame.
 *
 * ── Contract (what the client listens for) ─────────────────────────────────
 *   Wire format: standard SSE (`text/event-stream`).
 *
 *   event: new_mail
 *   data: {"type":"new_mail","accountId":"…","email":"…","path":"INBOX",
 *          "count":3,"ts":1700000000000}
 *
 *   The `data` payload is verbatim the JSON published by the worker's
 *   `publishNewMail` — `{ type:'new_mail', accountId, email, path, count, ts }`.
 *   Clients should `EventSource.addEventListener('new_mail', …)` (or just the
 *   default `onmessage`, since the event field is also named `new_mail`) and
 *   `JSON.parse(e.data)`, then refetch the affected folder/account.
 *
 *   Comment frames (lines starting `:`) are keepalives the browser ignores:
 *     - `: connected`  — sent once on open so the connection flushes promptly.
 *     - `: ping`       — heartbeat every ~25s so proxies / Fluid Compute don't
 *                        idle-kill the connection.
 *
 * ── Resilience ─────────────────────────────────────────────────────────────
 *   - A SUBSCRIBED ioredis connection cannot issue normal commands, so we
 *     create a NEW dedicated subscriber per request (never reuse `@/lib/redis`'s
 *     shared client). It is torn down on disconnect/cancel — no leaks.
 *   - When Redis is unconfigured / unavailable we STILL return a valid stream
 *     that only heartbeats (the client transparently falls back to polling).
 *     This route never 500s on a Redis problem.
 *   - On `req.signal` abort (client navigates away) OR `ReadableStream.cancel`
 *     we clear the heartbeat, unsubscribe, and `quit()` the subscriber.
 *
 * Must run as a persistent Node function (not Edge): runtime='nodejs' +
 * dynamic='force-dynamic' so it is never statically optimized or cached.
 */

import type { NextRequest } from 'next/server';
import IORedis, { type Redis } from 'ioredis';

import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Heartbeat cadence — comfortably under typical 30–60s proxy idle timeouts. */
const HEARTBEAT_MS = 25_000;

/**
 * Build a DEDICATED ioredis subscriber, mirroring the worker's connection
 * resolution (`REDIS_URL`, else `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`).
 * Returns `null` when Redis is unconfigured or instantiation throws — callers
 * degrade to a heartbeat-only stream rather than failing the request.
 */
function createSubscriber(): Redis | null {
  try {
    const url = process.env.REDIS_URL;
    if (url) {
      return new IORedis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
      });
    }
    if (process.env.REDIS_HOST) {
      return new IORedis({
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || 6379),
        ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: false,
      });
    }
    console.warn('[sabmail/stream] no REDIS_URL / REDIS_HOST — real-time disabled (heartbeat only)');
    return null;
  } catch (err) {
    console.warn(
      '[sabmail/stream] redis subscriber init failed (heartbeat only):',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) {
    // No valid mail project selected → not authorized to stream this tenant.
    return new Response('Unauthorized', { status: 401 });
  }

  const channel = `sabmail:${workspaceId}`;
  const encoder = new TextEncoder();

  // Captured by both `start` and `cancel` for guaranteed teardown.
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let subscriber: Redis | null = null;
  let onAbort: (() => void) | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (chunk: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          // Controller already closed (client gone) — trigger teardown.
          cleanup();
          return false;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        if (onAbort) {
          try {
            req.signal.removeEventListener('abort', onAbort);
          } catch {
            /* ignore */
          }
          onAbort = null;
        }
        if (subscriber) {
          const sub = subscriber;
          subscriber = null;
          // Best-effort: unsubscribe then close the dedicated connection.
          sub.unsubscribe(channel).catch(() => {});
          sub.quit().catch(() => {
            try {
              sub.disconnect();
            } catch {
              /* ignore */
            }
          });
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      // Tear down promptly when the client disconnects.
      onAbort = cleanup;
      if (req.signal.aborted) {
        cleanup();
        return;
      }
      req.signal.addEventListener('abort', onAbort);

      // Flush an initial comment so the browser marks the connection open and
      // any buffering proxy forwards the first bytes immediately.
      enqueue(': connected\n\n');

      // Heartbeat keeps the connection alive through idle proxies / Fluid.
      heartbeat = setInterval(() => {
        enqueue(': ping\n\n');
      }, HEARTBEAT_MS);

      // Dedicated subscriber. If Redis is unavailable we keep the stream open
      // as a heartbeat-only channel (client falls back to polling).
      subscriber = createSubscriber();
      if (!subscriber) return;

      subscriber.on('error', (err) => {
        // Don't kill the stream on a transient Redis error — log + keep
        // heartbeating; ioredis will attempt to reconnect on its own.
        console.warn('[sabmail/stream] redis subscriber error:', err?.message ?? err);
      });

      subscriber.on('message', (chan, message) => {
        if (chan !== channel) return;
        // Relay the worker's JSON verbatim. The published payload already has
        // `type:'new_mail'`; we also tag the SSE `event:` so clients can use a
        // named listener. `message` is a single line of JSON (no embedded
        // newlines), so it is a safe single `data:` field.
        enqueue(`event: new_mail\ndata: ${message}\n\n`);
      });

      try {
        await subscriber.subscribe(channel);
      } catch (err) {
        console.warn(
          '[sabmail/stream] subscribe failed (heartbeat only):',
          err instanceof Error ? err.message : String(err),
        );
        // Drop the unusable subscriber but leave the heartbeat running.
        const sub = subscriber;
        subscriber = null;
        sub.quit().catch(() => {
          try {
            sub.disconnect();
          } catch {
            /* ignore */
          }
        });
      }
    },

    cancel() {
      // Reader released (client gone / stream piped away). Mirror cleanup.
      if (closed) return;
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (onAbort) {
        try {
          req.signal.removeEventListener('abort', onAbort);
        } catch {
          /* ignore */
        }
        onAbort = null;
      }
      if (subscriber) {
        const sub = subscriber;
        subscriber = null;
        sub.unsubscribe(channel).catch(() => {});
        sub.quit().catch(() => {
          try {
            sub.disconnect();
          } catch {
            /* ignore */
          }
        });
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Defensive: disable nginx proxy buffering so frames flush immediately.
      'X-Accel-Buffering': 'no',
    },
  });
}
