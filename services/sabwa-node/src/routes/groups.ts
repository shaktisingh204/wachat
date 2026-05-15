/**
 * `/v1/groups` — group lifecycle, participants, admins and invite links.
 *
 * Mirrors the Rust engine's contract (`services/sabwa-engine/src/routes/groups.rs`)
 * but invokes the live Baileys socket directly instead of queueing through
 * Redis (the sabwa-node engine owns the socket pool in-process).
 *
 *   GET    /v1/groups?sessionId=<id>&category=<id>      list cached groups
 *   GET    /v1/groups/:jid?sessionId=<id>               single group + metadata
 *   POST   /v1/groups                                   create group
 *   PATCH  /v1/groups/:jid                              subject / description / icon
 *   POST   /v1/groups/:jid/participants                 add/remove/promote/demote
 *   GET    /v1/groups/:jid/invite-code?sessionId=<id>   fetch / generate invite
 *   POST   /v1/groups/:jid/leave                        leave a group
 */

import { Router, type Request, type Response } from 'express';

import {
  get as getGroup,
  getInviteCode as getCachedInvite,
  GroupsRepo,
  list as listGroups,
  parseOidLoose,
  type SabwaParticipant,
} from '../db/groups.js';
import { recordAudit } from '../db/audit.js';
import type { BaileysSession } from '../wa/session.js';
import { actorContext, badRequest, notFound, stateOf } from './_helpers.js';



function requireLiveSocket(
  req: Request,
  res: Response,
  sessionId: string,
): BaileysSession | null {
  const session = stateOf(req).pool.get(sessionId);
  if (!session) {
    res.status(503).json({
      error: 'session is not connected',
      code: 'session_offline',
    });
    return null;
  }
  if (session.status !== 'connected') {
    res.status(503).json({
      error: `session is ${session.status}`,
      code: 'session_offline',
    });
    return null;
  }
  return session;
}

/** Build the `/v1/groups` router. */
export function buildGroupsRouter(): Router {
  const router = Router();

  // ── GET /v1/groups ─────────────────────────────────────────────────────
  router.get('/', async (req: Request, res: Response): Promise<void> => {
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (!sessionId) {
      badRequest(res, 'sessionId is required');
      return;
    }
    const category =
      typeof req.query.category === 'string' && req.query.category.trim().length > 0
        ? req.query.category.trim()
        : null;
    try {
      const groups = await listGroups(stateOf(req).db, sessionId, category);
      res.json({ groups });
    } catch (err) {
      stateOf(req).log.error({ err }, 'groups: list failed');
      res.status(500).json({ error: 'failed to list groups', code: 'internal' });
    }
  });

  // ── GET /v1/groups/:jid ─────────────────────────────────────────────────
  router.get('/:jid', async (req: Request, res: Response): Promise<void> => {
    const jid = req.params.jid;
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (!jid) {
      badRequest(res, 'jid is required');
      return;
    }
    if (!sessionId) {
      badRequest(res, 'sessionId is required');
      return;
    }
    try {
      const group = await getGroup(stateOf(req).db, sessionId, jid);
      if (!group) {
        notFound(res, 'group');
        return;
      }
      res.json({ group });
    } catch (err) {
      stateOf(req).log.error({ err, jid }, 'groups: get failed');
      res.status(500).json({ error: 'failed to get group', code: 'internal' });
    }
  });

  // ── POST /v1/groups — create ────────────────────────────────────────────
  router.post('/', async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const participantsIn = Array.isArray(body.participants) ? body.participants : [];
    const participants = participantsIn.filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    if (!sessionId) return badRequest(res, 'sessionId is required');
    if (!subject) return badRequest(res, 'subject is required');
    if (participants.length === 0) {
      return badRequest(res, 'participants must be a non-empty string[]');
    }

    const session = requireLiveSocket(req, res, sessionId);
    if (!session) return;
    const sock = session.sock;
    if (!sock) {
      res.status(503).json({ error: 'baileys socket missing', code: 'session_offline' });
      return;
    }

    try {
      const meta = await sock.groupCreate(subject, participants);
      const state = stateOf(req);
      const repo = new GroupsRepo(state.db);
      const projectId =
        typeof body.projectId === 'string' && body.projectId.length > 0
          ? body.projectId
          : session.projectId ?? '';
      if (projectId && meta?.id) {
        try {
          const createdAt =
            typeof meta.creation === 'number'
              ? new Date(meta.creation * 1000)
              : new Date();
          const participantDocs: SabwaParticipant[] = (meta.participants ?? []).map(
            (p) => ({
              jid: p.id,
              isAdmin: !!(p.isAdmin || p.admin === 'admin' || p.admin === 'superadmin'),
              isSuperAdmin: !!(p.isSuperAdmin || p.admin === 'superadmin'),
              joinedAt: createdAt,
            }),
          );
          await repo.upsert({
            projectId: parseOidLoose(projectId),
            sessionId: parseOidLoose(sessionId),
            jid: meta.id,
            subject: meta.subject ?? subject,
            description: meta.desc ?? undefined,
            creator: meta.owner ?? undefined,
            createdAt,
            participants: participantDocs,
            announcement: meta.announce ?? false,
            restrict: meta.restrict ?? false,
          });
        } catch (err) {
          state.log.warn({ err, jid: meta.id }, 'groups.create: cache write failed');
        }
      }

      const ctx = actorContext(req);
      if (projectId) {
        await recordAudit(state, {
          projectId,
          sessionId,
          userId: ctx.userId,
          actorEmail: ctx.actorEmail,
          actorIp: ctx.actorIp,
          userAgent: ctx.userAgent,
          action: 'group.create',
          targetKind: 'group',
          targetId: meta?.id,
          metadata: { subject, participantCount: participants.length },
        });
      }

      res.json({ jid: meta?.id ?? null, meta });
    } catch (err) {
      stateOf(req).log.error({ err }, 'groups.create failed');
      res.status(500).json({ error: 'group create failed', code: 'internal' });
    }
  });

  // ── PATCH /v1/groups/:jid — subject / description / icon ────────────────
  router.patch('/:jid', async (req: Request, res: Response): Promise<void> => {
    const jid = req.params.jid;
    if (!jid) return badRequest(res, 'jid is required');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) return badRequest(res, 'sessionId is required');

    const session = requireLiveSocket(req, res, sessionId);
    if (!session) return;
    const sock = session.sock;
    if (!sock) {
      res.status(503).json({ error: 'baileys socket missing', code: 'session_offline' });
      return;
    }

    const state = stateOf(req);
    const repo = new GroupsRepo(state.db);
    const sid = parseOidLoose(sessionId);

    const applied: string[] = [];

    try {
      if (typeof body.subject === 'string' && body.subject.length > 0) {
        await sock.groupUpdateSubject(jid, body.subject);
        await repo.patchSubject(sid, jid, body.subject);
        applied.push('subject');
      }
      if (typeof body.description === 'string') {
        await sock.groupUpdateDescription(jid, body.description);
        await repo.patchDescription(sid, jid, body.description);
        applied.push('description');
      }
      // Icon: Baileys exposes `updateProfilePicture(jid, content)` and
      // accepts either a `Buffer` or a `{ url }` payload.
      if (typeof body.iconData === 'string') {
        const buf = Buffer.from(body.iconData, 'base64');
        await sock.updateProfilePicture(jid, buf);
        applied.push('icon');
      } else if (typeof body.iconUrl === 'string') {
        await sock.updateProfilePicture(jid, { url: body.iconUrl });
        applied.push('icon');
      }
      if (typeof body.category === 'string' || body.category === null) {
        await repo.setCategory(sid, jid, body.category as string | null);
        applied.push('category');
      }

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
          action: 'group.update',
          targetKind: 'group',
          targetId: jid,
          metadata: { applied },
        });
      }

      res.json({ jid, applied });
    } catch (err) {
      stateOf(req).log.error({ err, jid }, 'groups.update failed');
      res.status(500).json({ error: 'group update failed', code: 'internal' });
    }
  });

  // ── POST /v1/groups/:jid/participants ───────────────────────────────────
  router.post('/:jid/participants', async (req: Request, res: Response): Promise<void> => {
    const jid = req.params.jid;
    if (!jid) return badRequest(res, 'jid is required');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) return badRequest(res, 'sessionId is required');

    const ops: { op: 'add' | 'remove' | 'promote' | 'demote'; jids: string[] }[] = [];
    for (const op of ['add', 'remove', 'promote', 'demote'] as const) {
      const raw = body[op];
      if (!Array.isArray(raw)) continue;
      const jids = (raw as unknown[]).filter(
        (v): v is string => typeof v === 'string' && v.length > 0,
      );
      if (jids.length > 0) ops.push({ op, jids });
    }
    if (ops.length === 0) {
      return badRequest(res, 'one of add/remove/promote/demote must be non-empty');
    }

    const session = requireLiveSocket(req, res, sessionId);
    if (!session) return;
    const sock = session.sock;
    if (!sock) {
      res.status(503).json({ error: 'baileys socket missing', code: 'session_offline' });
      return;
    }

    const state = stateOf(req);
    const repo = new GroupsRepo(state.db);
    const sid = parseOidLoose(sessionId);
    const results: { op: string; result: unknown }[] = [];

    try {
      for (const { op, jids } of ops) {
        const result = await sock.groupParticipantsUpdate(jid, jids, op);
        results.push({ op, result });
        await repo.applyParticipantOp(sid, jid, op, jids);
      }

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
          action: 'group.participants_update',
          targetKind: 'group',
          targetId: jid,
          metadata: { ops: ops.map((o) => ({ op: o.op, count: o.jids.length })) },
        });
      }

      res.json({ jid, results });
    } catch (err) {
      stateOf(req).log.error({ err, jid }, 'groups.participants failed');
      res.status(500).json({ error: 'participants update failed', code: 'internal' });
    }
  });

  // ── GET /v1/groups/:jid/invite-code ────────────────────────────────────
  router.get('/:jid/invite-code', async (req: Request, res: Response): Promise<void> => {
    const jid = req.params.jid;
    if (!jid) return badRequest(res, 'jid is required');
    const sessionId =
      typeof req.query.sessionId === 'string' ? req.query.sessionId.trim() : '';
    if (!sessionId) return badRequest(res, 'sessionId is required');

    const session = stateOf(req).pool.get(sessionId);
    const sock = session?.sock;
    // Fall back to the cached value when the socket is not live.
    if (!session || session.status !== 'connected' || !sock) {
      try {
        const cached = await getCachedInvite(stateOf(req).db, sessionId, jid);
        if (cached) {
          res.json({
            jid,
            code: cached,
            inviteUrl: `https://chat.whatsapp.com/${cached}`,
            cached: true,
          });
          return;
        }
        res.status(503).json({
          error: 'session offline and no cached invite code',
          code: 'session_offline',
        });
        return;
      } catch (err) {
        stateOf(req).log.error({ err, jid }, 'groups.invite-code: cache lookup failed');
        res.status(500).json({ error: 'invite-code fetch failed', code: 'internal' });
        return;
      }
    }

    try {
      const code = await sock.groupInviteCode(jid);
      if (code) {
        try {
          const repo = new GroupsRepo(stateOf(req).db);
          await repo.setInviteCode(parseOidLoose(sessionId), jid, code);
        } catch {
          // best-effort cache write
        }
      }
      res.json({
        jid,
        code: code ?? null,
        inviteUrl: code ? `https://chat.whatsapp.com/${code}` : null,
        cached: false,
      });
    } catch (err) {
      stateOf(req).log.error({ err, jid }, 'groups.invite-code failed');
      res.status(500).json({ error: 'invite-code fetch failed', code: 'internal' });
    }
  });

  // ── POST /v1/groups/:jid/leave ─────────────────────────────────────────
  router.post('/:jid/leave', async (req: Request, res: Response): Promise<void> => {
    const jid = req.params.jid;
    if (!jid) return badRequest(res, 'jid is required');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    if (!sessionId) return badRequest(res, 'sessionId is required');

    const session = requireLiveSocket(req, res, sessionId);
    if (!session) return;
    const sock = session.sock;
    if (!sock) {
      res.status(503).json({ error: 'baileys socket missing', code: 'session_offline' });
      return;
    }

    try {
      await sock.groupLeave(jid);
      const ctx = actorContext(req);
      const state = stateOf(req);
      const projectId = typeof body.projectId === 'string' ? body.projectId : '';
      if (projectId) {
        await recordAudit(state, {
          projectId,
          sessionId,
          userId: ctx.userId,
          actorEmail: ctx.actorEmail,
          actorIp: ctx.actorIp,
          userAgent: ctx.userAgent,
          action: 'group.leave',
          targetKind: 'group',
          targetId: jid,
          metadata: {},
        });
      }
      res.json({ jid, left: true });
    } catch (err) {
      stateOf(req).log.error({ err, jid }, 'groups.leave failed');
      res.status(500).json({ error: 'group leave failed', code: 'internal' });
    }
  });

  return router;
}
