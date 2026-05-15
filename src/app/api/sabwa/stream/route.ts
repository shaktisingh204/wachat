/**
 * SabWa — realtime SSE proxy.
 *
 * `GET /api/sabwa/stream?sessionId=<id>`
 *
 * Flow:
 *   1. Authenticate the caller (Next.js cookie session).
 *   2. Look the SabWa session up in `sabwa_sessions` and assert that the
 *      authenticated user's active project owns it.
 *   3. Ask the Rust engine to mint a short-lived stream JWT for
 *      `(projectId, sessionId)` via `POST /v1/realtime/token` (service-token
 *      gated — only this server-side route can call it).
 *   4. Open an upstream connection to the engine SSE endpoint
 *      (`/realtime/sse/:sessionId?token=<jwt>`) and pipe the response body
 *      straight back to the browser.
 *
 * The browser sees a plain `text/event-stream` and never touches the engine
 * service token.
 *
 * Implementation notes:
 *  - `runtime = 'nodejs'` (Fluid Compute). Edge has limited streaming and
 *    `AbortController` semantics for long-lived upstream fetches.
 *  - Client disconnect cancels the upstream fetch via `AbortController`,
 *    which in turn closes the Rust subscription and the Redis pub/sub.
 *  - We never buffer the SSE body; we hand `res.body` (a `ReadableStream`)
 *    back to Next.js directly so events flow as soon as Rust emits them.
 *
 * Companion: the browser uses SSE; the Rust `/realtime/ws/:id` socket is
 * reserved for direct (non-browser) integrators.
 */

import 'server-only';

import { type NextRequest } from 'next/server';
import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { engineFetch, SabwaEngineError } from '@/lib/sabwa/engine-client';
import { SABWA_COLLECTIONS } from '@/lib/sabwa/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// SSE must never be cached anywhere along the path.
export const fetchCache = 'force-no-store';
export const revalidate = 0;

interface IssueTokenResponse {
  token: string;
  expiresAt: number;
}

function unauthorized(message = 'Authentication required'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

function forbidden(message = 'Forbidden'): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Resolve the caller's active project id from their session, matching the
 * shape used elsewhere in this repo (`session.user.activeProjectId`).
 */
function resolveActiveProjectId(
  user: Record<string, unknown> | undefined,
): string | null {
  if (!user) return null;
  const direct = user['activeProjectId'];
  if (typeof direct === 'string' && direct.trim()) return direct;

  // Fall back to the user's own id (single-project users / pre-project repos).
  const id =
    user['_id'] ??
    user['id'] ??
    (typeof (user as { _id?: { toString(): string } })._id?.toString === 'function'
      ? (user as { _id: { toString(): string } })._id.toString()
      : undefined);
  return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Look up `sabwa_sessions` by `_id` (or by `sessionId` string) and return
 * the row's `projectId` as a string, or `null` if missing.
 */
async function loadSessionProjectId(sessionId: string): Promise<string | null> {
  const { db } = await connectToDatabase();
  const sessions = db.collection(SABWA_COLLECTIONS.sessions);

  // Most callers pass the synthetic `sess_<uuid>` id; some may pass an
  // `ObjectId` hex. Try both shapes — the lookup is cheap.
  const candidates: Record<string, unknown>[] = [{ sessionId }];
  if (ObjectId.isValid(sessionId) && sessionId.length === 24) {
    candidates.push({ _id: new ObjectId(sessionId) });
  }

  const row = await sessions.findOne({ $or: candidates });
  if (!row) return null;

  const pid = (row as { projectId?: unknown }).projectId;
  if (typeof pid === 'string') return pid;
  if (pid && typeof (pid as { toString?: () => string }).toString === 'function') {
    return (pid as { toString(): string }).toString();
  }
  return null;
}

export async function GET(req: NextRequest): Promise<Response> {
  // ── 1. Auth ───────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return unauthorized();
  }

  const activeProjectId = resolveActiveProjectId(
    session.user as unknown as Record<string, unknown>,
  );
  if (!activeProjectId) {
    return forbidden('No active project');
  }

  // ── 2. Resolve & authorize the SabWa session ─────────────────────────
  const sessionId = req.nextUrl.searchParams.get('sessionId')?.trim();
  if (!sessionId) {
    return badRequest('sessionId is required');
  }

  const ownerProjectId = await loadSessionProjectId(sessionId);
  if (!ownerProjectId) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (ownerProjectId !== activeProjectId) {
    return forbidden('Session does not belong to active project');
  }

  // ── 3. Mint a short-lived stream JWT via the Rust engine ─────────────
  let issued: IssueTokenResponse;
  try {
    issued = await engineFetch<IssueTokenResponse>('/v1/realtime/token', {
      method: 'POST',
      json: { projectId: activeProjectId, sessionId },
      timeoutMs: 5_000,
    });
  } catch (err) {
    const status = err instanceof SabwaEngineError ? err.status || 502 : 502;
    return new Response(
      JSON.stringify({ error: 'Failed to mint realtime token' }),
      { status, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── 4. Open the upstream SSE and pipe it back to the browser ────────
  const baseUrl = (
    process.env.SABWA_ENGINE_URL ?? 'http://localhost:4001'
  ).replace(/\/+$/, '');
  const upstreamUrl = `${baseUrl}/realtime/sse/${encodeURIComponent(
    sessionId,
  )}?token=${encodeURIComponent(issued.token)}`;

  // Forward client disconnects to the upstream so Redis pub/sub closes.
  const abort = new AbortController();
  req.signal.addEventListener('abort', () => abort.abort(), { once: true });

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: abort.signal,
      // SSE needs streaming — don't let any layer try to cache or buffer.
      cache: 'no-store',
    });
  } catch (err) {
    if ((err as { name?: string } | undefined)?.name === 'AbortError') {
      return new Response(null, { status: 499 });
    }
    return new Response(
      JSON.stringify({ error: 'Upstream SSE connection failed' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    return new Response(
      JSON.stringify({
        error: `Upstream SSE ${upstream.status}`,
        detail: text.slice(0, 200),
      }),
      {
        status: upstream.status === 401 ? 401 : 502,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx, etc.) so events flush immediately.
      'X-Accel-Buffering': 'no',
    },
  });
}
