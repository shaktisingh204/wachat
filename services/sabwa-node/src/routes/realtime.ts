/**
 * Realtime SSE bridge for sabwa-node.
 *
 * Two endpoints live here, mounted on *different* prefixes by `index.ts`:
 *
 *   POST /v1/realtime/token   — service-token-gated. Mints a short-lived
 *                               HS256 JWT bound to `(projectId, sessionId)`.
 *                               Called server-side by the Next.js SSE proxy
 *                               (`/api/sabwa/stream/route.ts`).
 *
 *   GET  /realtime/sse/:sessionId?token=<jwt>
 *                             — unauthenticated at the service-token layer
 *                               (browsers can't safely carry that secret).
 *                               The JWT *is* validated here. On success we
 *                               subscribe to `sabwa:{sessionId}:events` and
 *                               forward every message as a named SSE frame:
 *
 *                                   event: qr
 *                                   data: {"kind":"qr",...}
 *
 *                               The connection closes when the client
 *                               disconnects (which aborts the Redis
 *                               subscription via AbortSignal).
 *
 * The JWT shape and validation mirror `services/sabwa-engine/src/auth.rs`
 * so the Rust engine and the Node engine can issue interchangeable tokens
 * during the migration.
 */

import { Router, type Request, type Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';

import type { AppState } from '../state.js';
import { subscribe, type SabwaEvent } from '../realtime/pubsub.js';
import { asString } from './_helpers.js';

/** Default TTL applied when the caller doesn't pass `ttlSecs`. */
const DEFAULT_TTL_SECS = 60;
/** Hard cap on requested TTL — bounds the blast radius of a leaked token. */
const MAX_TTL_SECS = 60 * 60;

/** Env var carrying the HS256 secret for stream JWTs. */
const JWT_SECRET_ENV = 'SABWA_JWT_SECRET';
/** Fallback env name kept for compatibility with the Rust engine. */
const LEGACY_JWT_SECRET_ENV = 'SABWA_STREAM_JWT_SECRET';

/** Stream JWT claim shape. Matches Rust's `StreamClaims`. */
interface StreamClaims extends JwtPayload {
  /** SabWa session id this token is scoped to. */
  sid: string;
  /** Project id the caller was acting under at mint time. */
  pid: string;
  /** Issued-at (seconds since epoch). */
  iat: number;
  /** Expiration (seconds since epoch). */
  exp: number;
}

/**
 * Resolve the HS256 secret used to sign / verify stream tokens.
 *
 * Lookup order:
 *   1. `SABWA_JWT_SECRET`            — preferred (matches Next.js proxy expectations).
 *   2. `SABWA_STREAM_JWT_SECRET`     — fallback for parity with the Rust engine.
 *   3. `state.config.serviceToken`   — dev fallback so single-machine setups Just Work.
 */
function streamJwtSecret(state: AppState): string {
  const explicit = process.env[JWT_SECRET_ENV];
  if (explicit && explicit.trim().length > 0) return explicit;
  const legacy = process.env[LEGACY_JWT_SECRET_ENV];
  if (legacy && legacy.trim().length > 0) return legacy;
  return state.config.serviceToken;
}

const IssueTokenBody = z.object({
  projectId: z.string().trim().min(1, 'projectId is required'),
  sessionId: z.string().trim().min(1, 'sessionId is required'),
  ttlSecs: z.number().int().positive().optional(),
});

/**
 * Build the `/v1/realtime` sub-router (service-token gated).
 *
 * Currently exposes:
 *   - `POST /token` — issue a short-lived stream JWT.
 */
export function buildRealtimeTokenRouter(state: AppState): Router {
  const router = Router();

  router.post('/token', (req: Request, res: Response): void => {
    const parsed = IssueTokenBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? 'invalid body',
        code: 'bad_request',
      });
      return;
    }
    const { projectId, sessionId, ttlSecs } = parsed.data;
    const ttl = Math.min(ttlSecs ?? DEFAULT_TTL_SECS, MAX_TTL_SECS);
    const now = Math.floor(Date.now() / 1000);
    const exp = now + ttl;

    const secret = streamJwtSecret(state);

    let token: string;
    try {
      token = jwt.sign(
        {
          sid: sessionId,
          pid: projectId,
          iat: now,
          exp,
        } satisfies StreamClaims,
        secret,
        { algorithm: 'HS256' },
      );
    } catch (err) {
      state.log.error({ err }, 'failed to sign stream jwt');
      res.status(500).json({ error: 'failed to sign token', code: 'internal' });
      return;
    }

    res.json({ token, expiresAt: exp });
  });

  return router;
}

/**
 * Verify a stream JWT and return its claims, or `null` on any failure
 * (bad signature, expired, malformed, missing required claim).
 */
function verifyStreamToken(state: AppState, token: string): StreamClaims | null {
  try {
    const secret = streamJwtSecret(state);
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      clockTolerance: 5,
    });
    if (typeof decoded !== 'object' || decoded === null) return null;
    const claims = decoded as JwtPayload & Partial<StreamClaims>;
    if (typeof claims.sid !== 'string' || typeof claims.pid !== 'string') {
      return null;
    }
    if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
      return null;
    }
    return {
      sid: claims.sid,
      pid: claims.pid,
      iat: claims.iat,
      exp: claims.exp,
    };
  } catch (err) {
    state.log.debug({ err }, 'stream token verification failed');
    return null;
  }
}

/**
 * Map a SabwaEvent's `kind` to an SSE `event:` name. Unknown kinds are
 * forwarded verbatim so future event types don't require a bridge update.
 */
function sseEventName(event: SabwaEvent): string {
  return event.kind || 'message';
}

/**
 * Build the `/realtime` sub-router (NOT service-token gated).
 *
 * The SSE handler validates the JWT itself, then opens a Redis subscription
 * and streams events to the browser.
 */
export function buildRealtimeStreamRouter(state: AppState): Router {
  const router = Router();

  router.get('/sse/:sessionId', async (req: Request, res: Response): Promise<void> => {
    const sessionId = asString(req.params.sessionId);
    if (!sessionId) {
      res.status(400).type('text/plain').send('missing sessionId');
      return;
    }

    const tokenRaw = req.query['token'];
    const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : '';
    if (!token) {
      res.status(401).type('text/plain').send('missing token');
      return;
    }

    const claims = verifyStreamToken(state, token);
    if (!claims) {
      res.status(401).type('text/plain').send('invalid token');
      return;
    }
    if (claims.sid !== sessionId) {
      state.log.warn(
        { tokenSid: claims.sid, pathSid: sessionId },
        'stream token session_id mismatch',
      );
      res.status(401).type('text/plain').send('session mismatch');
      return;
    }

    state.log.info(
      { sessionId, projectId: claims.pid },
      'sse client connected',
    );

    // Set SSE headers and flush so the browser opens the connection.
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Disable proxy buffering (nginx, etc.) so events flush immediately.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Best-effort: bump TCP-level keepalive on the underlying socket so
    // long-idle SSE connections aren't reaped by intermediaries.
    req.socket.setKeepAlive(true);
    req.socket.setNoDelay(true);

    // Tie a Redis subscription to the client's lifecycle.
    const abort = new AbortController();
    const onClose = (): void => abort.abort();
    req.on('close', onClose);
    res.on('close', onClose);

    // Periodic keep-alive comment so proxies don't reap an idle stream.
    const KEEPALIVE_MS = 20_000;
    const keepalive = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch (err) {
        state.log.debug({ err, sessionId }, 'keep-alive write failed');
        abort.abort();
      }
    }, KEEPALIVE_MS);
    // Don't keep the event loop alive solely for this timer.
    if (typeof keepalive.unref === 'function') keepalive.unref();

    let unsubscribe: (() => Promise<void>) | null = null;
    try {
      unsubscribe = await subscribe(
        state.redis,
        sessionId,
        (event: SabwaEvent): void => {
          if (abort.signal.aborted) return;
          const eventName = sseEventName(event);
          const data = JSON.stringify(event);
          try {
            res.write(`event: ${eventName}\n`);
            res.write(`data: ${data}\n\n`);
          } catch (err) {
            state.log.debug({ err, sessionId }, 'sse write failed');
            abort.abort();
          }
        },
        abort.signal,
        state.log,
      );
    } catch (err) {
      state.log.warn(
        { err, sessionId },
        'failed to subscribe to Redis; emitting error event',
      );
      try {
        res.write('event: error\n');
        res.write(`data: ${JSON.stringify({ error: 'subscribe_failed' })}\n\n`);
      } catch {
        /* socket already gone */
      }
      clearInterval(keepalive);
      res.end();
      return;
    }

    const cleanup = async (): Promise<void> => {
      clearInterval(keepalive);
      req.off('close', onClose);
      res.off('close', onClose);
      try {
        await unsubscribe?.();
      } catch (err) {
        state.log.debug({ err, sessionId }, 'unsubscribe failed on cleanup');
      }
      try {
        if (!res.writableEnded) res.end();
      } catch {
        /* already ended */
      }
      state.log.info({ sessionId }, 'sse client disconnected');
    };

    abort.signal.addEventListener('abort', () => {
      void cleanup();
    }, { once: true });
  });

  return router;
}
