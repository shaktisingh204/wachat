'use server';

/**
 * SabCRM — signed webhook delivery-log server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/webhook-delivery.server`. The
 * `gate` / `fail` helpers are copied verbatim from `sabcrm-scoring.actions.ts`
 * (session → project membership → RBAC `canServer('sabcrm', …)` → plan),
 * including the cross-tenant defense against a client-supplied `projectId`.
 *
 * Gating: reads (`listWebhookDeliveriesTw`) require `view`; mutations
 * (`retryWebhookDeliveryTw`, `rotateWebhookSecretTw`) require `edit` — the same
 * data-model-management level the rest of the webhook surface uses.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listDeliveries,
  retryDelivery,
  rotateSubscriptionSecret,
  type WebhookDeliveryRow,
  type WebhookDeliveryStatus,
  type DeliveryAttemptOutcome,
} from '@/lib/sabcrm/webhook-delivery.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions.ts). */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  if (!(await canServer(MODULE_KEY, action, requested))) {
    return { ok: false, error: 'Permission denied.' };
  }
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Filters accepted by {@link listWebhookDeliveriesTw}. */
export interface ListWebhookDeliveriesInput {
  webhookId?: string;
  status?: WebhookDeliveryStatus;
  limit?: number;
}

/**
 * List recent webhook deliveries for the active project (newest first),
 * optionally filtered by subscription / status. Gated on `view`.
 */
export async function listWebhookDeliveriesTw(
  input?: ListWebhookDeliveriesInput,
  projectId?: string,
): Promise<ActionResult<WebhookDeliveryRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const rows = await listDeliveries(g.ctx.projectId, {
      webhookId: input?.webhookId,
      status: input?.status,
      limit: input?.limit,
    });
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to load webhook deliveries.');
  }
}

/** Manually re-attempt a single delivery now. Gated on `edit`. */
export async function retryWebhookDeliveryTw(
  deliveryRowId: string,
  projectId?: string,
): Promise<ActionResult<DeliveryAttemptOutcome>> {
  if (!deliveryRowId) return { ok: false, error: 'A delivery id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const outcome = await retryDelivery(g.ctx.projectId, deliveryRowId);
    if (!outcome) return { ok: false, error: 'Delivery not found.' };
    return { ok: true, data: outcome };
  } catch (e) {
    return fail(e, 'Failed to retry delivery.');
  }
}

/**
 * Rotate a subscription's signing secret, returning the new clear-text secret
 * exactly once so the operator can re-key the receiver. Gated on `edit`.
 */
export async function rotateWebhookSecretTw(
  webhookId: string,
  projectId?: string,
): Promise<ActionResult<{ secret: string }>> {
  if (!webhookId) return { ok: false, error: 'A webhook id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const result = await rotateSubscriptionSecret(g.ctx.projectId, webhookId);
    if (!result) return { ok: false, error: 'Webhook subscription not found.' };
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to rotate webhook secret.');
  }
}
