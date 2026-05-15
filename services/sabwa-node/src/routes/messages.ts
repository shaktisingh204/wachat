/**
 * `/v1/messages` — message persistence + outbound send.
 *
 * Routes:
 *   GET  /v1/messages?sessionId=&chatJid=&cursor=&limit=
 *                                          -> { messages: MessageRow[], nextCursor? }
 *   GET  /v1/chats/:jid/messages           (aliased by `buildChatMessagesRouter`)
 *   POST /v1/messages                      send
 *   POST /v1/messages/mark-read            mark a chat read (legacy alias)
 *
 * Send semantics:
 *   1. Look up the live `BaileysSession` in `state.pool`.
 *   2. Translate the wire payload into Baileys' `AnyMessageContent`.
 *   3. Pass through the anti-ban `gate(...)` before any socket dispatch.
 *   4. Persist via `MessagesRepo.upsertByMessageId(...)` and bump the chat
 *      row (`ChatsRepo.upsert` with a fresh `lastMessage`) so the inbox
 *      shows the outbound message instantly.
 */

import { Router, type Request, type Response } from 'express';
import type { AnyMessageContent } from '@whiskeysockets/baileys';

import {
  DEFAULT_PROFILE,
  gate,
  isRateProfile,
  sleep,
  type GateSessionMeta,
} from '../antiban/index.js';
import { ChatsRepo } from '../db/chats.js';
import { MessagesRepo } from '../db/messages.js';
import type { SabwaMessageType } from '../db/types-shim.js';
import type { AppState, BaileysSession as PoolBaileysSession } from '../state.js';
import { stateOf } from './_helpers.js';

const VALID_TYPES = new Set<SabwaMessageType>([
  'text',
  'image',
  'video',
  'audio',
  'voice',
  'document',
  'sticker',
  'location',
  'contact',
  'poll',
]);

interface SendPayload {
  type: SabwaMessageType;
  body?: string;
  mediaUrl?: string;
  mediaMime?: string;
  caption?: string;
  mentionAll?: boolean;
}

function badRequest(res: Response, msg: string): void {
  res.status(400).json({ error: msg, code: 'bad_request' });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Translate the SabWa wire payload into Baileys' `AnyMessageContent` shape.
 * Returns `null` when the payload is structurally invalid.
 */
function toBaileysContent(p: SendPayload): AnyMessageContent | null {
  switch (p.type) {
    case 'text':
      if (!p.body) return null;
      return { text: p.body };
    case 'image':
      if (!p.mediaUrl) return null;
      return { image: { url: p.mediaUrl }, caption: p.caption };
    case 'video':
      if (!p.mediaUrl) return null;
      return { video: { url: p.mediaUrl }, caption: p.caption };
    case 'audio':
    case 'voice':
      if (!p.mediaUrl) return null;
      return {
        audio: { url: p.mediaUrl },
        ptt: p.type === 'voice',
        mimetype: p.mediaMime ?? 'audio/ogg; codecs=opus',
      };
    case 'document':
      if (!p.mediaUrl) return null;
      return {
        document: { url: p.mediaUrl },
        mimetype: p.mediaMime ?? 'application/octet-stream',
        caption: p.caption,
      };
    case 'sticker':
      if (!p.mediaUrl) return null;
      return { sticker: { url: p.mediaUrl } };
    default:
      // location / contact / poll need richer payloads not yet on the wire.
      return null;
  }
}

/**
 * Find a session in the pool and assert it can send. Tolerates the two
 * `BaileysSession` flavours floating around the codebase: the rich one in
 * `wa/session.ts` (which is what the pool actually stores) and the legacy
 * state-bag one in `state.ts`.
 */
function getSendableSession(
  state: AppState,
  sessionId: string,
):
  | { ok: true; session: import('../wa/session.js').BaileysSession }
  | { ok: false; code: 'not_found' | 'not_connected' } {
  const session = state.pool.get(sessionId);
  if (!session) return { ok: false, code: 'not_found' };
  if (session.status !== 'connected') return { ok: false, code: 'not_connected' };
  return { ok: true, session };
}

export function buildMessagesRouter(state: AppState): Router {
  const router = Router();

  // ── GET /v1/messages?sessionId=&chatJid=&cursor= ─────────────────────────
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId = asString(req.query.sessionId);
    const chatJid = asString(req.query.chatJid) ?? asString(req.query.jid);
    if (!sessionId) return badRequest(res, 'sessionId is required');
    if (!chatJid) return badRequest(res, 'chatJid is required');

    const limitNum = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
    try {
      const repo = new MessagesRepo(stateOf(req).db);
      const result = await repo.list(
        sessionId,
        chatJid,
        asString(req.query.cursor),
        Number.isFinite(limitNum) ? limitNum : undefined,
      );
      res.json({
        messages: result.messages,
        ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
      });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, chatJid }, 'messages.list failed');
      res.status(500).json({ error: 'failed to list messages', code: 'internal' });
    }
  });

  // ── POST /v1/messages ────────────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as {
      sessionId?: string;
      chatJid?: string;
      payload?: Partial<SendPayload>;
      profile?: unknown;
      projectId?: string;
    };
    const sessionId = asString(body.sessionId);
    const chatJid = asString(body.chatJid);
    if (!sessionId) return badRequest(res, 'sessionId is required');
    if (!chatJid) return badRequest(res, 'chatJid is required');
    if (!body.payload || typeof body.payload.type !== 'string') {
      return badRequest(res, 'payload.type is required');
    }
    const type = body.payload.type as SabwaMessageType;
    if (!VALID_TYPES.has(type)) return badRequest(res, `invalid type: ${type}`);

    const payload: SendPayload = {
      type,
      body: asString(body.payload.body),
      mediaUrl: asString(body.payload.mediaUrl),
      mediaMime: asString(body.payload.mediaMime),
      caption: asString(body.payload.caption),
      mentionAll: body.payload.mentionAll === true,
    };

    const content = toBaileysContent(payload);
    if (!content) return badRequest(res, 'payload is missing required fields for its type');

    const found = getSendableSession(stateOf(req), sessionId);
    if (!found.ok) {
      res.status(found.code === 'not_found' ? 404 : 503).json({
        error: found.code === 'not_found' ? 'session not found' : 'session not connected',
        code: found.code,
      });
      return;
    }

    // Anti-ban gate before any socket dispatch.
    const profile = isRateProfile(body.profile) ? body.profile : DEFAULT_PROFILE;
    const meta: GateSessionMeta = {
      sessionId,
      profile,
      warmup: { warmupEnabled: false, warmupStartedAt: null },
    };
    const decision = await gate(state.redis, meta, {
      body: payload.body ?? payload.caption,
    });
    if (!decision.ok) {
      const status = decision.reason === 'paused' ? 503 : 429;
      res.status(status).json({
        error: 'anti-ban gate refused send',
        code: decision.reason,
      });
      return;
    }
    await sleep(decision.sleepMs);

    try {
      const sent = await found.session.sendMessage(chatJid, content);
      const messageId = sent?.key?.id ?? '';
      if (!messageId) {
        res.status(502).json({ error: 'socket did not return a messageId', code: 'send_failed' });
        return;
      }
      const ts = Date.now();

      // Persist the outbound row + bump the chat preview.
      const projectId = found.session as unknown as { projectId?: string };
      const projectIdStr =
        asString(body.projectId) ?? asString(projectId.projectId) ?? '000000000000000000000000';
      const messagesRepo = new MessagesRepo(stateOf(req).db);
      const chatsRepo = new ChatsRepo(stateOf(req).db);

      await messagesRepo.upsertByMessageId({
        projectId: projectIdStr,
        sessionId,
        chatJid,
        messageId,
        fromJid: chatJid,
        fromMe: true,
        type: payload.type,
        body: payload.body,
        mediaUrl: payload.mediaUrl,
        mediaMime: payload.mediaMime,
        caption: payload.caption,
        status: 'sent',
        ts,
      });
      await chatsRepo.upsert({
        projectId: projectIdStr,
        sessionId,
        jid: chatJid,
        lastMessage: {
          id: messageId,
          body: payload.body ?? payload.caption ?? `[${payload.type}]`,
          ts: new Date(ts),
          fromMe: true,
        },
      });

      res.json({ messageId, ts });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, chatJid }, 'messages.send failed');
      res.status(500).json({
        error: err instanceof Error ? err.message : 'failed to send',
        code: 'send_failed',
      });
    }
  });

  // ── POST /v1/messages/mark-read ─────────────────────────────────────────
  router.post('/mark-read', async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as { sessionId?: string; chatJid?: string };
    const sessionId = asString(body.sessionId);
    const chatJid = asString(body.chatJid);
    if (!sessionId) return badRequest(res, 'sessionId is required');
    if (!chatJid) return badRequest(res, 'chatJid is required');
    try {
      await new ChatsRepo(stateOf(req).db).markRead(sessionId, chatJid);
      res.json({ ok: true });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, chatJid }, 'messages.mark-read failed');
      res.status(500).json({ error: 'failed to mark read', code: 'internal' });
    }
  });

  return router;
}

/**
 * Sibling router mounted at `/v1/chats/:jid/messages` so the GET path matches
 * what `sabwa.actions.ts::getChatMessages` calls in some code paths. The body
 * is identical to `GET /v1/messages` — we just shape the URL differently.
 */
export function buildChatMessagesRouter(_state: AppState): Router {
  // Express requires `mergeParams: true` for the parent `:jid` to be visible
  // inside this child router.
  const router = Router({ mergeParams: true });
  router.get('/messages', async (req: Request, res: Response): Promise<void> => {
    const sessionId = asString(req.query.sessionId);
    const jid = (req.params as { jid?: string }).jid;
    if (!sessionId) return badRequest(res, 'sessionId is required');
    if (!jid) return badRequest(res, 'chatJid is required');
    const limitNum = req.query.limit ? Number.parseInt(String(req.query.limit), 10) : undefined;
    try {
      const result = await new MessagesRepo(stateOf(req).db).list(
        sessionId,
        jid,
        asString(req.query.cursor),
        Number.isFinite(limitNum) ? limitNum : undefined,
      );
      res.json({
        messages: result.messages,
        ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}),
      });
    } catch (err) {
      stateOf(req).log.error({ err, sessionId, jid }, 'chat.messages.list failed');
      res.status(500).json({ error: 'failed to list messages', code: 'internal' });
    }
  });
  return router;
}

// Silence "unused" warning for the helper type import.
export type { PoolBaileysSession };
