/**
 * `/v1/chats` — chat list + per-chat metadata mutations.
 *
 * Routes (mirroring what `sabwa.actions.ts` calls on the Next.js side):
 *   GET    /v1/chats?sessionId=&type=&filter=&unread=&archived=&labelId=&cursor=&limit=
 *                                          -> { chats: ChatRow[], nextCursor? }
 *   GET    /v1/chats/:jid?sessionId=       -> { chat: ChatRow | null }
 *   POST   /v1/chats/:jid/read?sessionId=  -> { ok: true }
 *   POST   /v1/chats/:jid/pin              -> { ok: true }
 *   POST   /v1/chats/:jid/mute             -> { ok: true }
 *   POST   /v1/chats/:jid/archive          -> { ok: true }
 *   POST   /v1/chats/:jid/labels           -> { ok: true }
 *   PATCH  /v1/chats/:jid                  -> { ok: true }  (multi-field bag)
 *   DELETE /v1/chats/:jid?sessionId=&clearMessages=
 *                                          -> 204
 *
 * The response shapes mirror `SabwaChat` from `src/lib/sabwa/types.ts`
 * (see `db/chats.ts::ChatRow` for the wire variant).
 */

import { Router, type Request, type Response } from 'express';

import { ChatsRepo } from '../db/chats.js';
import type { AppState } from '../state.js';
import { stateOf } from './_helpers.js';

const VALID_TYPES = new Set(['individual', 'group', 'broadcast', 'status']);

function badRequest(res: Response, msg: string): void {
  res.status(400).json({ error: msg, code: 'bad_request' });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asBool(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  return undefined;
}

export function buildChatsRouter(_state: AppState): Router {
  const router = Router();

  // ── GET /v1/chats ────────────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId = asString(req.query.sessionId);
    if (!sessionId) return badRequest(res, 'sessionId is required');

    const rawType = asString(req.query.type);
    if (rawType && !VALID_TYPES.has(rawType)) {
      return badRequest(res, `invalid type: ${rawType}`);
    }

    const limitNum = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;

    try {
      const repo = new ChatsRepo(stateOf(req).db);
      const { chats, nextCursor } = await repo.list(sessionId, {
        type: rawType as 'individual' | 'group' | 'broadcast' | 'status' | undefined,
        query: asString(req.query.filter),
        unreadOnly: asBool(req.query.unread),
        archivedOnly: asBool(req.query.archived),
        labelId: asString(req.query.labelId),
        cursor: asString(req.query.cursor),
        limit: Number.isFinite(limitNum) ? limitNum : undefined,
      });
      res.json({ chats, ...(nextCursor ? { nextCursor } : {}) });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId }, 'chats.list failed');
      res.status(500).json({ error: 'failed to list chats', code: 'internal' });
    }
  });

  // ── POST /v1/chats/:jid/read ────────────────────────────────────────────
  router.post('/:jid/read', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    const sessionId = asString(req.query.sessionId) ?? asString((req.body ?? {}).sessionId);
    if (!jid) return badRequest(res, 'chatJid is required');
    if (!sessionId) return badRequest(res, 'sessionId is required');

    try {
      const state = stateOf(req);
      const repo = new ChatsRepo(state.db);
      await repo.markRead(sessionId, jid);

      // Best-effort: ask the live socket to send read receipts.
      const session = state.pool.get(sessionId);
      if (session && 'markRead' in session && typeof (session as { markRead?: unknown }).markRead === 'function') {
        try {
          await (session as { markRead: (j: string) => Promise<void> }).markRead(jid);
        } catch (err) {
          state.log.warn({ err, sessionId, jid }, 'chats.read: socket markRead failed');
        }
      }
      res.json({ ok: true });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, jid }, 'chats.read failed');
      res.status(500).json({ error: 'failed to mark read', code: 'internal' });
    }
  });

  // ── POST /v1/chats/:jid/pin ─────────────────────────────────────────────
  router.post('/:jid/pin', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    const body = (req.body ?? {}) as { sessionId?: string; pinned?: boolean };
    const sessionId = asString(body.sessionId) ?? asString(req.query.sessionId);
    if (!jid) return badRequest(res, 'chatJid is required');
    if (!sessionId) return badRequest(res, 'sessionId is required');
    const pinned = typeof body.pinned === 'boolean' ? body.pinned : true;
    try {
      await new ChatsRepo(stateOf(req).db).setPinned(sessionId, jid, pinned);
      res.json({ ok: true });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, jid }, 'chats.pin failed');
      res.status(500).json({ error: 'failed to pin chat', code: 'internal' });
    }
  });

  // ── POST /v1/chats/:jid/mute ────────────────────────────────────────────
  router.post('/:jid/mute', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    const body = (req.body ?? {}) as {
      sessionId?: string;
      muted?: boolean;
      muteForSec?: number | null;
    };
    const sessionId = asString(body.sessionId) ?? asString(req.query.sessionId);
    if (!jid) return badRequest(res, 'chatJid is required');
    if (!sessionId) return badRequest(res, 'sessionId is required');
    const muted = typeof body.muted === 'boolean' ? body.muted : true;
    const forSec = typeof body.muteForSec === 'number' ? body.muteForSec : null;
    try {
      await new ChatsRepo(stateOf(req).db).setMuted(sessionId, jid, muted, forSec);
      res.json({ ok: true });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, jid }, 'chats.mute failed');
      res.status(500).json({ error: 'failed to mute chat', code: 'internal' });
    }
  });

  // ── POST /v1/chats/:jid/archive ─────────────────────────────────────────
  router.post('/:jid/archive', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    const body = (req.body ?? {}) as { sessionId?: string; archived?: boolean };
    const sessionId = asString(body.sessionId) ?? asString(req.query.sessionId);
    if (!jid) return badRequest(res, 'chatJid is required');
    if (!sessionId) return badRequest(res, 'sessionId is required');
    const archived = typeof body.archived === 'boolean' ? body.archived : true;
    try {
      await new ChatsRepo(stateOf(req).db).setArchived(sessionId, jid, archived);
      res.json({ ok: true });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, jid }, 'chats.archive failed');
      res.status(500).json({ error: 'failed to archive chat', code: 'internal' });
    }
  });

  // ── POST /v1/chats/:jid/labels ──────────────────────────────────────────
  router.post('/:jid/labels', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    const body = (req.body ?? {}) as { sessionId?: string; labels?: unknown };
    const sessionId = asString(body.sessionId) ?? asString(req.query.sessionId);
    if (!jid) return badRequest(res, 'chatJid is required');
    if (!sessionId) return badRequest(res, 'sessionId is required');
    if (!Array.isArray(body.labels)) return badRequest(res, 'labels must be an array');
    const labelIds = body.labels.filter((l): l is string => typeof l === 'string');
    try {
      await new ChatsRepo(stateOf(req).db).setLabels(sessionId, jid, labelIds);
      res.json({ ok: true });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, jid }, 'chats.labels failed');
      res.status(500).json({ error: 'failed to set labels', code: 'internal' });
    }
  });

  // ── PATCH /v1/chats/:jid ────────────────────────────────────────────────
  // Multi-field bag used by `updateChatState` in `sabwa.actions.ts`.
  router.patch('/:jid', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    const body = (req.body ?? {}) as {
      sessionId?: string;
      pinned?: boolean;
      muted?: boolean;
      muteForSec?: number | null;
      archived?: boolean;
      read?: boolean;
      labels?: unknown;
    };
    const sessionId = asString(body.sessionId);
    if (!jid) return badRequest(res, 'chatJid is required');
    if (!sessionId) return badRequest(res, 'sessionId is required');
    try {
      const repo = new ChatsRepo(stateOf(req).db);
      if (typeof body.pinned === 'boolean') await repo.setPinned(sessionId, jid, body.pinned);
      if (typeof body.muted === 'boolean') {
        await repo.setMuted(
          sessionId,
          jid,
          body.muted,
          typeof body.muteForSec === 'number' ? body.muteForSec : null,
        );
      }
      if (typeof body.archived === 'boolean') await repo.setArchived(sessionId, jid, body.archived);
      if (body.read === true) await repo.markRead(sessionId, jid);
      if (Array.isArray(body.labels)) {
        const labelIds = body.labels.filter((l): l is string => typeof l === 'string');
        await repo.setLabels(sessionId, jid, labelIds);
      }
      res.json({ ok: true });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, jid }, 'chats.patch failed');
      res.status(500).json({ error: 'failed to patch chat', code: 'internal' });
    }
  });

  return router;
}
