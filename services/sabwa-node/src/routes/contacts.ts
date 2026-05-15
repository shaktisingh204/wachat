/**
 * `/v1/contacts` — contact directory mirroring the Baileys contacts store.
 *
 * Mirrors the Rust engine's contract (`services/sabwa-engine/src/routes/contacts.rs`):
 *   GET    /v1/contacts?sessionId=<id>          list
 *   GET    /v1/contacts/:jid?sessionId=<id>     single
 *   PATCH  /v1/contacts/:jid                    set tags / notes
 *   POST   /v1/contacts/:jid/block              queue Baileys block
 *   POST   /v1/contacts/:jid/unblock            queue Baileys unblock
 *
 * The block / unblock paths push a job onto the per-session outbound Redis
 * queue so the live Baileys socket (owned by the sessions agent) can execute
 * `sock.updateBlockStatus(jid, 'block' | 'unblock')` against WhatsApp.
 */

import { Router, type Request, type Response } from 'express';

import {
  get as getContact,
  list as listContacts,
  setBlocked as setBlockedDb,
  update as updateContact,
} from '../db/contacts.js';
import { actorContext, asString, badRequest, notFound, stateOf } from './_helpers.js';
import { recordAudit } from '../db/audit.js';

/**
 * Build the `/v1/contacts` router.
 *
 * @returns Express router (mounted by `routes/index.ts`).
 */
export function buildContactsRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId = asString(req.query.sessionId);
    if (!sessionId) {
      badRequest(res, 'sessionId is required');
      return;
    }
    const searchRaw = asString(req.query.search);
    const search = searchRaw.length > 0 ? searchRaw : null;
    const tagRaw = asString(req.query.tag);
    const tag = tagRaw.length > 0 ? tagRaw : null;
    try {
      const contacts = await listContacts(stateOf(req).db, sessionId, search, tag);
      res.json({ contacts });
    } catch (err) {
      stateOf(req).log.error({ err }, 'contacts: list failed');
      res.status(500).json({ error: 'failed to list contacts', code: 'internal' });
    }
  });

  router.get('/:jid', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    const sessionId = asString(req.query.sessionId);
    if (!jid) {
      badRequest(res, 'jid is required');
      return;
    }
    if (!sessionId) {
      badRequest(res, 'sessionId is required');
      return;
    }
    try {
      const contact = await getContact(stateOf(req).db, sessionId, jid);
      if (!contact) {
        notFound(res, 'contact');
        return;
      }
      res.json({ contact });
    } catch (err) {
      stateOf(req).log.error({ err, jid }, 'contacts: get failed');
      res.status(500).json({ error: 'failed to get contact', code: 'internal' });
    }
  });

  router.patch('/:jid', async (req: Request, res: Response): Promise<void> => {
    const jid = asString(req.params.jid);
    if (!jid) {
      badRequest(res, 'jid is required');
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId =
      typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) {
      badRequest(res, 'sessionId is required');
      return;
    }

    const patch: { tags?: string[]; notes?: string | null } = {};
    if (Array.isArray(body.tags)) {
      patch.tags = (body.tags as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      );
    }
    if (typeof body.notes === 'string') patch.notes = body.notes;

    try {
      await updateContact(stateOf(req).db, sessionId, jid, patch);

      const ctx = actorContext(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      if (projectId) {
        await recordAudit(stateOf(req), {
          projectId,
          sessionId,
          userId: ctx.userId,
          actorEmail: ctx.actorEmail,
          actorIp: ctx.actorIp,
          userAgent: ctx.userAgent,
          action: 'contact.update',
          targetKind: 'contact',
          targetId: jid,
          metadata: { tags: patch.tags, hasNotes: typeof patch.notes === 'string' },
        });
      }

      res.json({ jid, updated: true });
    } catch (err) {
      stateOf(req).log.error({ err, jid }, 'contacts: update failed');
      res.status(500).json({ error: 'failed to update contact', code: 'internal' });
    }
  });

  router.post('/:jid/block', async (req, res) => blockUnblock(req, res, true));
  router.post('/:jid/unblock', async (req, res) => blockUnblock(req, res, false));

  return router;
}

/**
 * Shared handler for `/:jid/block` and `/:jid/unblock`.
 *
 * Writes the new block flag to Mongo immediately (so reads are coherent) and
 * pushes a job onto the per-session outbound Redis queue so the live Baileys
 * socket can call `sock.updateBlockStatus(jid, 'block' | 'unblock')`.
 */
async function blockUnblock(req: Request, res: Response, block: boolean): Promise<void> {
  const jid = asString(req.params.jid);
  if (!jid) {
    badRequest(res, 'jid is required');
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!sessionId) {
    badRequest(res, 'sessionId is required');
    return;
  }

  try {
    const state = stateOf(req);
    await setBlockedDb(state.db, sessionId, jid, block);

    const payload = JSON.stringify({
      op: block ? 'contact_block' : 'contact_unblock',
      jid,
    });
    await state.redis.client.lPush(`sabwa:${sessionId}:outbound`, payload);

    const ctx = actorContext(req);
    const projectId = typeof body.projectId === 'string' ? body.projectId : '';
    if (projectId) {
      await recordAudit(state, {
        projectId,
        sessionId,
        userId: ctx.userId,
        actorEmail: ctx.actorEmail,
        actorIp: ctx.actorIp,
        userAgent: ctx.userAgent,
        action: block ? 'contact.block' : 'contact.unblock',
        targetKind: 'contact',
        targetId: jid,
        metadata: {},
      });
    }

    res.json({ jid, blocked: block, queued: true });
  } catch (err) {
    stateOf(req).log.error({ err, jid, block }, 'contacts: block/unblock failed');
    res.status(500).json({ error: 'failed to update block status', code: 'internal' });
  }
}
