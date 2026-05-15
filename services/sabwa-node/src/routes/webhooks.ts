/**
 * `/v1/webhooks` — CRUD + test-fire for project-scoped HTTP webhooks.
 *
 *   GET    /v1/webhooks?projectId=<id>     → { webhooks: [...] }
 *   POST   /v1/webhooks                    → { webhook }
 *   PATCH  /v1/webhooks/:id                → { webhook }
 *   DELETE /v1/webhooks/:id                → { ok: true }
 *   POST   /v1/webhooks/:id/test           → { ok, status, durationMs, error? }
 *
 * Test delivery sends an `X-Sabwa-Event: webhook.test` POST with an
 * `X-Sabwa-Signature: sha256=<hex>` header derived from the stored HMAC
 * secret, mirroring the production delivery format from the Rust engine.
 */

import { createHmac } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AppState } from '../state.js';
import { recordAudit } from '../db/audit.js';
import {
  createWebhook,
  deleteWebhook,
  findWebhook,
  listWebhooks,
  patchWebhook,
  recordDelivery,
} from '../db/webhooks.js';
import { actorContext, asString, badRequest, notFound, stateOf } from './_helpers.js';

const WEBHOOK_EVENTS = z.union([
  z.enum([
    'message.received',
    'message.status',
    'chat.updated',
    'group.joined',
    'group.left',
    'session.connected',
    'session.disconnected',
    'scheduled.fired',
  ]),
  z.string().min(1),
]);

const createSchema = z.object({
  projectId: z.string().min(1),
  sessionId: z.string().optional(),
  url: z.string().url(),
  events: z.array(WEBHOOK_EVENTS).min(1),
  hmacSecret: z.string().min(8),
  enabled: z.boolean().optional(),
});

const patchSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(WEBHOOK_EVENTS).min(1).optional(),
  hmacSecret: z.string().min(8).optional(),
  enabled: z.boolean().optional(),
});

const TEST_TIMEOUT_MS = 10_000;

async function handleList(req: Request, res: Response): Promise<void> {
  const projectId = asString(req.query.projectId);
  if (!projectId) {
    badRequest(res, 'projectId query parameter is required');
    return;
  }
  const webhooks = await listWebhooks(stateOf(req), projectId);
  res.json({ webhooks });
}

async function handleCreate(req: Request, res: Response): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'invalid body', parsed.error.issues);
    return;
  }
  const state = stateOf(req);
  const created = await createWebhook(state, parsed.data);
  if (!created) {
    badRequest(res, 'invalid projectId');
    return;
  }
  await recordAudit(state, {
    projectId: parsed.data.projectId,
    action: 'webhook.create',
    targetKind: 'webhook',
    targetId: created.id,
    metadata: { url: created.url, events: created.events },
    ...actorContext(req),
  });
  res.status(201).json({ webhook: created });
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
  const updated = await patchWebhook(state, id, parsed.data);
  if (!updated) {
    notFound(res, 'webhook');
    return;
  }
  await recordAudit(state, {
    projectId: updated.projectId,
    action: 'webhook.update',
    targetKind: 'webhook',
    targetId: updated.id,
    metadata: { patched: Object.keys(parsed.data) },
    ...actorContext(req),
  });
  res.json({ webhook: updated });
}

async function handleDelete(req: Request, res: Response): Promise<void> {
  const id = asString(req.params.id);
  if (!id) {
    badRequest(res, 'id is required');
    return;
  }
  const state = stateOf(req);
  const existing = await findWebhook(state, id);
  if (!existing) {
    notFound(res, 'webhook');
    return;
  }
  const ok = await deleteWebhook(state, id);
  if (!ok) {
    notFound(res, 'webhook');
    return;
  }
  await recordAudit(state, {
    projectId: existing.projectId,
    action: 'webhook.delete',
    targetKind: 'webhook',
    targetId: id,
    metadata: { url: existing.url },
    ...actorContext(req),
  });
  res.json({ ok: true });
}

async function handleTest(req: Request, res: Response): Promise<void> {
  const id = asString(req.params.id);
  if (!id) {
    badRequest(res, 'id is required');
    return;
  }
  const state = stateOf(req);
  const wh = await findWebhook(state, id);
  if (!wh) {
    notFound(res, 'webhook');
    return;
  }

  const payload = {
    event: 'webhook.test',
    webhookId: wh._id.toHexString(),
    projectId: wh.projectId.toHexString(),
    ts: new Date().toISOString(),
    message: 'sabwa-node webhook test ping',
  };
  const bodyText = JSON.stringify(payload);
  const signature = createHmac('sha256', wh.signingSecret).update(bodyText).digest('hex');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  const startedAt = Date.now();
  let status = 0;
  let ok = false;
  let error: string | undefined;
  try {
    const r = await fetch(wh.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sabwa-event': 'webhook.test',
        'x-sabwa-signature': `sha256=${signature}`,
      },
      body: bodyText,
      signal: controller.signal,
    });
    status = r.status;
    ok = r.ok;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  } finally {
    clearTimeout(timer);
  }
  const durationMs = Date.now() - startedAt;
  await recordDelivery(state, id, status, ok);
  await recordAudit(state, {
    projectId: wh.projectId,
    action: 'webhook.test',
    targetKind: 'webhook',
    targetId: id,
    metadata: { status, ok, durationMs, error },
    ...actorContext(req),
  });
  res.json({ ok, status, durationMs, error });
}

export function buildWebhooksRouter(_state: AppState): Router {
  const r = Router();
  r.get('/', (req, res, next) => void handleList(req, res).catch(next));
  r.post('/', (req, res, next) => void handleCreate(req, res).catch(next));
  r.patch('/:id', (req, res, next) => void handlePatch(req, res).catch(next));
  r.delete('/:id', (req, res, next) => void handleDelete(req, res).catch(next));
  r.post('/:id/test', (req, res, next) => void handleTest(req, res).catch(next));
  return r;
}
