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
 * Resolve the authenticated user's id (string) from the session payload.
 * `activeProjectId` is client-only state (localStorage) — never trust the
 * session for that. We instead verify ownership by walking
 * session → project.userId at the SabWa-session row.
 */
function resolveUserId(
  user: Record<string, unknown> | undefined,
): string | null {
  if (!user) return null;
  const raw =
    user['_id'] ??
    user['id'] ??
    (typeof (user as { _id?: { toString(): string } })._id?.toString === 'function'
      ? (user as { _id: { toString(): string } })._id.toString()
      : undefined);
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

/**
 * Verify the authenticated user owns the given project.
 *
 * `sabwa_sessions` rows aren't written at pair time (the Rust engine
 * keeps sessions in an in-memory pool), so authorization has to happen
 * one level up — on the project. The client passes the projectId it
 * just paired against; we verify ownership here.
 */
async function verifyProjectOwnership(
  projectId: string,
  authedUserId: string,
): Promise<boolean> {
  if (!ObjectId.isValid(projectId) || projectId.length !== 24) return false;
  try {
    const { db } = await connectToDatabase();
    const project = (await db
      .collection('projects')
      .findOne(
        { _id: new ObjectId(projectId) },
        { projection: { userId: 1 } },
      )) as { userId?: unknown } | null;
    const uid = project?.userId;
    const ownerUserId =
      typeof uid === 'string'
        ? uid
        : uid && typeof (uid as { toString?: () => string }).toString === 'function'
          ? (uid as { toString(): string }).toString()
          : null;
    return !!ownerUserId && ownerUserId === authedUserId;
  } catch {
    return false;
  }
}

/**
 * Optional fallback: look up a persisted SabWa session row (for the
 * post-engine-v2 world where sessions ARE persisted at pair time).
 * Returns `null` for the current Phase-1 engine which doesn't write
 * to `sabwa_sessions` on create.
 */
async function loadSessionOwnership(sessionId: string): Promise<{
  projectId: string;
  ownerUserId: string | null;
} | null> {
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
  const projectId =
    typeof pid === 'string'
      ? pid
      : pid && typeof (pid as { toString?: () => string }).toString === 'function'
        ? (pid as { toString(): string }).toString()
        : null;
  if (!projectId) return null;

  // Resolve the project's owning userId.
  let project: Record<string, unknown> | null = null;
  try {
    if (ObjectId.isValid(projectId) && projectId.length === 24) {
      project = (await db
        .collection('projects')
        .findOne(
          { _id: new ObjectId(projectId) },
          { projection: { userId: 1 } },
        )) as Record<string, unknown> | null;
    }
  } catch {
    project = null;
  }
  const uid = project?.['userId'];
  const ownerUserId =
    typeof uid === 'string'
      ? uid
      : uid && typeof (uid as { toString?: () => string }).toString === 'function'
        ? (uid as { toString(): string }).toString()
        : null;

  return { projectId, ownerUserId };
}

export async function GET(req: NextRequest): Promise<Response> {
  // ── 1. Auth ───────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session?.user) {
    return unauthorized();
  }

  const authedUserId = resolveUserId(
    session.user as unknown as Record<string, unknown>,
  );
  if (!authedUserId) {
    return unauthorized('Missing user id on session');
  }

  // ── 2. Resolve & authorize the SabWa session ─────────────────────────
  const sessionId = req.nextUrl.searchParams.get('sessionId')?.trim();
  if (!sessionId) {
    return badRequest('sessionId is required');
  }

  // The client passes the project id it just paired against. Until the
  // engine persists session rows at pair time we can't recover the
  // project id from `sessionId` alone, so the client tells us — and we
  // verify they actually own that project.
  const clientProjectId = req.nextUrl.searchParams
    .get('projectId')
    ?.trim();

  let activeProjectId: string | null = null;

  if (clientProjectId) {
    const owns = await verifyProjectOwnership(clientProjectId, authedUserId);
    if (!owns) {
      return forbidden('You do not own that project');
    }
    activeProjectId = clientProjectId;
  } else {
    // Fallback for callers that persist sessions in Mongo: derive the
    // project from the session row and check the user owns its project.
    const ownership = await loadSessionOwnership(sessionId);
    if (!ownership) {
      return badRequest(
        'projectId is required (session is not persisted in Mongo)',
      );
    }
    if (!ownership.ownerUserId || ownership.ownerUserId !== authedUserId) {
      return forbidden('Session does not belong to you');
    }
    activeProjectId = ownership.projectId;
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
