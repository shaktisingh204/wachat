/**
 * `/v1/auto-replies` — CRUD for session-scoped auto-reply rules.
 *
 * Endpoints (parity with the Rust engine and `engine-client.ts`):
 *   GET    /v1/auto-replies?sessionId=<id>      → { autoReplies: [...] }
 *   POST   /v1/auto-replies                     → { autoReply }
 *   PATCH  /v1/auto-replies/:id                 → { autoReply }
 *   DELETE /v1/auto-replies/:id                 → { ok: true }
 *   POST   /v1/auto-replies/reorder             → { ok: true }
 *
 * Every mutation writes an entry to `sabwa_audit_log` via `recordAudit`.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppState } from '../state.js';
import { recordAudit } from '../db/audit.js';
import {
  createAutoReply,
  deleteAutoReply,
  findAutoReply,
  listAutoReplies,
  normaliseActions,
  normaliseTriggers,
  patchAutoReply,
  reorderAutoReplies,
  type AutoReplyAction,
  type AutoReplyTrigger,
} from '../db/auto-replies.js';
import { actorContext, asString, badRequest, notFound, stateOf } from './_helpers.js';

// ── Zod schemas ────────────────────────────────────────────────────────────

const TRIGGER_KINDS = [
  'keyword',
  'contains',
  'contains_all',
  'contains_any',
  'regex',
  'time_window',
  'time_of_day',
  'contact_label',
  'outside_business_hours',
  'first_message_from_new_contact',
] as const;

const ACTION_KINDS = [
  'send_template',
  'send_message',
  'forward_to_flow',
  'set_away_message',
  'add_label',
  'set_label',
] as const;

const triggerSchema = z.object({
  kind: z.enum(TRIGGER_KINDS),
  value: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  flags: z.string().optional(),
  caseSensitive: z.boolean().optional(),
});

const actionSchema = z.object({
  kind: z.enum(ACTION_KINDS),
  templateId: z.string().optional(),
  flowId: z.string().optional(),
  labelId: z.string().optional(),
  message: z.string().optional(),
});

const createSchema = z
  .object({
    sessionId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    name: z.string().min(1).max(200),
    enabled: z.boolean().optional().default(true),
    triggers: z.array(triggerSchema).optional(),
    trigger: triggerSchema.optional(),
    actions: z.array(actionSchema).optional(),
    action: actionSchema.optional(),
  })
  .refine(
    (v) => (v.triggers && v.triggers.length > 0) || v.trigger,
    { message: 'at least one trigger is required', path: ['triggers'] },
  )
  .refine(
    (v) => (v.actions && v.actions.length > 0) || v.action,
    { message: 'at least one action is required', path: ['actions'] },
  );

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  triggers: z.array(triggerSchema).optional(),
  trigger: triggerSchema.optional(),
  actions: z.array(actionSchema).optional(),
  action: actionSchema.optional(),
  order: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  sessionId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)),
});

// ── Handlers ───────────────────────────────────────────────────────────────

async function handleList(req: Request, res: Response): Promise<void> {
  const sessionId = asString(req.query.sessionId);
  if (!sessionId) {
    badRequest(res, 'sessionId query parameter is required');
    return;
  }
  const autoReplies = await listAutoReplies(stateOf(req), sessionId);
  res.json({ autoReplies });
}

async function handleCreate(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'invalid body', parsed.error.issues);
    return;
  }
  const state = stateOf(req);
  const triggers: AutoReplyTrigger[] = normaliseTriggers(
    parsed.data.triggers,
    parsed.data.trigger,
  );
  const actions: AutoReplyAction[] = normaliseActions(
    parsed.data.actions,
    parsed.data.action,
  );
  // We need a projectId — accept it on the body, or fall back to a header
  // (lookups via sessionId would require a sessions module which a sibling
  // agent owns).
  const projectId =
    parsed.data.projectId ?? req.header('x-sabwa-project-id') ?? '';
  if (!projectId) {
    badRequest(res, 'projectId is required (body.projectId or X-Sabwa-Project-Id header)');
    return;
  }
  const created = await createAutoReply(state, {
    projectId,
    sessionId: parsed.data.sessionId,
    name: parsed.data.name,
    enabled: parsed.data.enabled,
    triggers,
    actions,
  });
  if (!created) {
    badRequest(res, 'invalid projectId or sessionId');
    return;
  }
  await recordAudit(state, {
    projectId,
    sessionId: parsed.data.sessionId,
    action: 'auto_reply.create',
    targetKind: 'auto_reply',
    targetId: created.id,
    metadata: { name: created.name },
    ...actorContext(req),
  });
  res.status(201).json({ autoReply: created });
}

async function handlePatch(req: Request, res: Response): Promise<void> {
  const id = asString(req.params.id);
  if (!id) {
    badRequest(res, 'id is required');
    return;
  }
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'invalid body', parsed.error.issues);
    return;
  }
  const state = stateOf(req);
  const patch: {
    name?: string;
    enabled?: boolean;
    triggers?: AutoReplyTrigger[];
    actions?: AutoReplyAction[];
    order?: number;
  } = {};
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
  if (parsed.data.order !== undefined) patch.order = parsed.data.order;
  const triggers = normaliseTriggers(parsed.data.triggers, parsed.data.trigger);
  if (triggers.length > 0) patch.triggers = triggers;
  const actions = normaliseActions(parsed.data.actions, parsed.data.action);
  if (actions.length > 0) patch.actions = actions;

  const updated = await patchAutoReply(state, id, patch);
  if (!updated) {
    notFound(res, 'auto-reply');
    return;
  }
  await recordAudit(state, {
    projectId: updated.projectId,
    sessionId: updated.sessionId,
    action: 'auto_reply.update',
    targetKind: 'auto_reply',
    targetId: updated.id,
    metadata: { patched: Object.keys(patch) },
    ...actorContext(req),
  });
  res.json({ autoReply: updated });
}

async function handleDelete(req: Request, res: Response): Promise<void> {
  const id = asString(req.params.id);
  if (!id) {
    badRequest(res, 'id is required');
    return;
  }
  const state = stateOf(req);
  const existing = await findAutoReply(state, id);
  if (!existing) {
    notFound(res, 'auto-reply');
    return;
  }
  const ok = await deleteAutoReply(state, id);
  if (!ok) {
    notFound(res, 'auto-reply');
    return;
  }
  await recordAudit(state, {
    projectId: existing.projectId,
    sessionId: existing.sessionId,
    action: 'auto_reply.delete',
    targetKind: 'auto_reply',
    targetId: id,
    metadata: { name: existing.name },
    ...actorContext(req),
  });
  res.json({ ok: true });
}

async function handleReorder(req: Request, res: Response): Promise<void> {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'invalid body', parsed.error.issues);
    return;
  }
  const state = stateOf(req);
  const ok = await reorderAutoReplies(
    state,
    parsed.data.sessionId,
    parsed.data.orderedIds,
  );
  if (!ok) {
    badRequest(res, 'invalid sessionId');
    return;
  }
  const projectId = req.header('x-sabwa-project-id') ?? '';
  if (projectId) {
    await recordAudit(state, {
      projectId,
      sessionId: parsed.data.sessionId,
      action: 'auto_reply.reorder',
      targetKind: 'auto_reply',
      metadata: { count: parsed.data.orderedIds.length },
      ...actorContext(req),
    });
  }
  res.json({ ok: true });
}

// ── Router ─────────────────────────────────────────────────────────────────

export function buildAutoRepliesRouter(_state: AppState): Router {
  const r = Router();
  r.get('/', (req, res, next) => void handleList(req, res).catch(next));
  r.post('/', (req, res, next) => void handleCreate(req, res).catch(next));
  r.post('/reorder', (req, res, next) => void handleReorder(req, res).catch(next));
  r.patch('/:id', (req, res, next) => void handlePatch(req, res).catch(next));
  r.delete('/:id', (req, res, next) => void handleDelete(req, res).catch(next));
  return r;
}
