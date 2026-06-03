/**
 * `/v1/sessions` — pairing, lifecycle and status for linked WhatsApp accounts.
 *
 * Wire shape matches the Rust engine's `src/routes/sessions.rs` so the
 * Next.js `engineFetch` client keeps working unchanged:
 *
 *   POST   /v1/sessions               → create + start pairing
 *   GET    /v1/sessions?projectId=    → list sessions for a project
 *   GET    /v1/sessions/:id           → single session summary
 *   PATCH  /v1/sessions/:id           → update label / rateLimitProfile
 *   DELETE /v1/sessions/:id           → logout + wipe row + evict from pool
 *
 * Every handler reads the shared `AppState` from `req.app.locals.state`.
 */

import { Router, type Request, type Response } from 'express';
import type { AppState } from '../state.js';
import {
  deleteSession,
  findById,
  findByProject,
  insertPending,
  updateMetadata,
  type PairMethod,
  type RateProfile,
  type SessionSummary,
} from '../db/sessions.js';
import { asString } from './_helpers.js';

/** Pull the request-scoped `AppState`. */
function getState(req: Request): AppState {
  const s = req.app.locals.state as AppState | undefined;
  if (!s) throw new Error('AppState missing from app.locals');
  return s;
}

/** Validate `pairMethod`. */
function parsePairMethod(raw: unknown): PairMethod | undefined {
  if (raw === 'qr' || raw === 'code') return raw;
  return undefined;
}

function parseRateProfile(raw: unknown): RateProfile | undefined {
  if (raw === 'safe' || raw === 'normal' || raw === 'aggressive') return raw;
  return undefined;
}

/**
 * Wait briefly for a QR string to appear after the socket spawns. Baileys
 * emits the QR shortly after `start()` resolves, so we poll the in-memory
 * cache rather than blocking on a one-shot event. Returns whichever
 * artifact is known first (qr or pairCode).
 */
async function waitForFirstArtifact(
  pool: AppState['pool'],
  sessionId: string,
  timeoutMs: number,
  preferPairCode: boolean,
  phoneE164: string | undefined,
): Promise<{ qr?: string; pairCode?: string }> {
  const deadline = Date.now() + timeoutMs;
  // Poll every 100ms — Baileys typically emits the first QR within ~1-2s.
  while (Date.now() < deadline) {
    const session = pool.get(sessionId);
    if (!session) return {};
    const status = session.getStatus();
    if (preferPairCode) {
      if (status.pairCode) return { pairCode: status.pairCode };
      // Once a QR has appeared the socket is ready to accept
      // `requestPairingCode`; trigger the request if it hasn't fired yet.
      if (status.qr && phoneE164) {
        const code = await session.getPairCode(phoneE164);
        if (code) return { pairCode: code };
      }
    } else if (status.qr) {
      return { qr: status.qr };
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return {};
}

// ----- Handlers -----

async function createSession(req: Request, res: Response): Promise<void> {
  const state = getState(req);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const projectId = typeof body.projectId === 'string' ? body.projectId : '';
  const userId = typeof body.userId === 'string' ? body.userId : '';
  const pairMethod = parsePairMethod(body.pairMethod);
  const phoneE164 =
    typeof body.phoneE164 === 'string' && body.phoneE164.trim().length > 0
      ? body.phoneE164.trim()
      : undefined;

  if (!projectId) {
    res.status(400).json({ error: 'projectId is required', code: 'bad_request' });
    return;
  }
  if (!userId) {
    res.status(400).json({ error: 'userId is required', code: 'bad_request' });
    return;
  }
  if (!pairMethod) {
    res
      .status(400)
      .json({ error: "pairMethod must be 'qr' or 'code'", code: 'bad_request' });
    return;
  }
  if (pairMethod === 'code' && !phoneE164) {
    res.status(400).json({
      error: "pairMethod 'code' requires phoneE164",
      code: 'bad_request',
    });
    return;
  }

  // Insert a `pending` row first so `listSessions` reflects the new
  // account immediately and the post-pair persister can resolve it by id.
  let inserted: { sessionId: string };
  try {
    inserted = await insertPending(state.db, {
      projectId,
      userId,
      pairMethod,
      phoneE164,
    });
  } catch (err) {
    state.log.warn({ err }, 'sessions.insertPending failed');
    res.status(400).json({
      error: err instanceof Error ? err.message : 'failed to insert session',
      code: 'bad_request',
    });
    return;
  }

  // Spin up the live Baileys socket in the in-process pool.
  try {
    await state.pool.getOrCreate(inserted.sessionId, {
      projectId,
      pairMethod,
      phoneE164,
      db: state.db,
      redis: state.redis,
      authStateKey: state.authStateKey,
      log: state.log,
    });
  } catch (err) {
    state.log.warn(
      { err, sessionId: inserted.sessionId },
      'pool.getOrCreate failed — leaving pending row',
    );
  }

  // Best-effort: wait up to 5s for the first QR / pair code. The browser
  // also subscribes via SSE for the streamed updates, so returning empty
  // here is fine — it just means the user sees the spinner a moment longer.
  const artifacts = await waitForFirstArtifact(
    state.pool,
    inserted.sessionId,
    5_000,
    pairMethod === 'code',
    phoneE164,
  );

  res.status(200).json({
    sessionId: inserted.sessionId,
    status: 'pending',
    qr: artifacts.qr,
    pairCode: artifacts.pairCode,
  });
}

async function listSessions(req: Request, res: Response): Promise<void> {
  const state = getState(req);
  const projectId = asString(req.query.projectId);
  if (!projectId) {
    res
      .status(400)
      .json({ error: 'projectId query param is required', code: 'bad_request' });
    return;
  }
  const rows = await findByProject(state.db, projectId);
  res.json({ sessions: rows });
}

async function getSession(req: Request, res: Response): Promise<void> {
  const state = getState(req);
  const id = asString(req.params.id);
  const row = await findById(state.db, id);
  if (!row) {
    res.status(404).json({ error: 'session not found', code: 'not_found' });
    return;
  }
  res.json(row satisfies SessionSummary);
}

async function patchSession(req: Request, res: Response): Promise<void> {
  const state = getState(req);
  const id = asString(req.params.id);
  const body = (req.body ?? {}) as Record<string, unknown>;

  const label =
    typeof body.label === 'string' ? body.label : undefined;
  const rateLimitProfile = parseRateProfile(body.rateLimitProfile);
  const warmupEnabled = typeof body.warmupEnabled === 'boolean' ? body.warmupEnabled : undefined;
  const dailyResetTimezone = typeof body.dailyResetTimezone === 'string' ? body.dailyResetTimezone : undefined;
  const overrides = typeof body.overrides === 'object' && body.overrides !== null ? body.overrides as Record<string, number> : undefined;

  if (label === undefined && rateLimitProfile === undefined && warmupEnabled === undefined && dailyResetTimezone === undefined && overrides === undefined) {
    res.status(400).json({
      error: 'no patchable fields supplied',
      code: 'bad_request',
    });
    return;
  }

  await updateMetadata(state.db, id, { label, rateLimitProfile, warmupEnabled, dailyResetTimezone, overrides });
  res.json({ sessionId: id, updated: true });
}

/**
 * GET /v1/sessions/:id/status
 *
 * Returns a lightweight status snapshot for a single session.
 * Checks the live pool first (for `qr`, `pairCode`, `lastConnectedAt`,
 * `lastError`) and falls back to the persisted `sabwa_sessions` row for
 * sessions that are not currently held in the pool (e.g. after a restart).
 *
 * Shape mirrors `SabwaSessionStatusInfo` in `sabwa.actions.ts`.
 */
async function getSessionStatus(req: Request, res: Response): Promise<void> {
  const state = getState(req);
  const id = asString(req.params.id);
  if (!id) {
    res.status(400).json({ error: 'session id is required', code: 'bad_request' });
    return;
  }

  // Try the live pool first — it has the freshest ephemeral state (QR, pair code).
  const live = state.pool.get(id);
  if (live) {
    const snap = live.getStatus();
    res.json({
      session: {
        sessionId: id,
        status: snap.status,
        lastConnectedAt: snap.lastConnectedAt?.toISOString(),
        lastError: snap.lastError,
      },
    });
    return;
  }

  // Pool miss — look up the persisted row.
  const row = await findById(state.db, id);
  if (!row) {
    res.status(404).json({ error: 'session not found', code: 'not_found' });
    return;
  }
  res.json({
    session: {
      sessionId: row.sessionId,
      status: row.status,
      phoneE164: row.phoneE164,
      pushName: row.pushName,
      profilePicUrl: row.profilePicUrl,
      lastConnectedAt: row.lastConnectedAt,
    },
  });
}

async function getRateLimitProfile(req: Request, res: Response): Promise<void> {
  const state = getState(req);
  const id = asString(req.params.id);
  const row = await findById(state.db, id);
  if (!row) {
    res.status(404).json({ error: 'session not found', code: 'not_found' });
    return;
  }
  
  // Note: findById uses toSummary which doesn't include the new rate limit fields,
  // we need to fetch the raw doc to return them.
  const { ObjectId } = await import('mongodb');
  let oid;
  try { oid = new ObjectId(id); } catch { res.status(404).json({ error: 'session not found', code: 'not_found' }); return; }
  const doc = await state.db.collection('sabwa_sessions').findOne({ _id: oid });
  if (!doc) {
    res.status(404).json({ error: 'session not found', code: 'not_found' });
    return;
  }

  const createdAt = doc.createdAt;
  const sessionAgeDays = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  res.json({
    settings: {
      profile: doc.rateLimitProfile || 'normal',
      warmupEnabled: doc.warmupEnabled ?? false,
      dailyResetTimezone: doc.dailyResetTimezone ?? 'UTC',
      overrides: doc.overrides ?? {},
      sessionAgeDays,
    }
  });
}

async function deleteSessionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const state = getState(req);
  const id = asString(req.params.id);

  // Logout the live socket (best-effort), then evict from the pool, then
  // wipe the row + auth_state. The pool eviction must happen before the
  // delete so the post-eviction reconnect path can't race against the
  // wipe and re-insert an empty `creds.update`.
  const live = state.pool.remove(id);
  if (live) {
    try {
      await live.logout();
    } catch (err) {
      state.log.warn(
        { err, sessionId: id },
        'live session logout failed — continuing with row delete',
      );
    }
  }
  // `logout()` already deletes the Mongo row, but call again in case the
  // session wasn't in the pool (e.g. server restarted after pairing).
  await deleteSession(state.db, id);
  res.json({ sessionId: id, deleted: true });
}

// ----- Router -----

/** Build the `/v1/sessions` sub-router. */
export function buildSessionsRouter(_state: AppState): Router {
  const r = Router();
  r.post('/', (req, res, next) => {
    createSession(req, res).catch(next);
  });
  r.get('/', (req, res, next) => {
    listSessions(req, res).catch(next);
  });
  // Static sub-paths must be registered before the dynamic /:id handler
  // so Express doesn't swallow 'status' / 'rate-limits' as the :id segment.
  r.get('/:id/status', (req, res, next) => {
    getSessionStatus(req, res).catch(next);
  });
  r.get('/:id/rate-limits', (req, res, next) => {
    getRateLimitProfile(req, res).catch(next);
  });
  r.get('/:id', (req, res, next) => {
    getSession(req, res).catch(next);
  });
  r.patch('/:id', (req, res, next) => {
    patchSession(req, res).catch(next);
  });
  r.delete('/:id', (req, res, next) => {
    deleteSessionHandler(req, res).catch(next);
  });
  return r;
}
