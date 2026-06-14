'use server';

/**
 * SabCRM — shared inbox server actions (the `/sabcrm/inbox` surface).
 *
 * Two gated wrappers:
 *   - `getCrmInboxTw` ('view') — aggregates recent SabMail messages mapped to
 *     CRM records via the read-only `buildCrmInbox` aggregator;
 *   - `quickReplyTw` ('edit') — an inline reply that DELEGATES to the existing
 *     `sendSabcrmEmail` action so it inherits the exact send path (platform
 *     transport delivery + best-effort SabMail recording + a non-fatal `EMAIL`
 *     activity on the record). The recipient is RE-RESOLVED from the record
 *     server-side inside `sendSabcrmEmail` — the client-supplied `to` is
 *     informational only and is never trusted for delivery.
 *
 * The `gate` / `fail` helpers are copied verbatim from
 * `sabcrm-scoring.actions.ts` (session → `getCachedProjects` membership →
 * `canServer('sabcrm', …)` → plan), including the cross-tenant defense against
 * a client-supplied `projectId`. Reads gate on `view`, the reply on `edit`.
 *
 * Everything degrades gracefully: with no SabMail account / the engine down,
 * `getCrmInboxTw` returns `{ rows: [], connected: false }` and the reply
 * surfaces the same inline error `sendSabcrmEmail` already returns today.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import { buildCrmInbox, type CrmInboxResult } from '@/lib/sabcrm/crm-inbox.server';
import { sendSabcrmEmail } from './sabcrm-email.actions';
import type { SabcrmEmailSendResult } from './sabcrm-email.actions.types';

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

/**
 * The shared CRM inbox: recent SabMail messages mapped to CRM records. Gated on
 * `view`. The aggregator is exception-free — a SabMail/engine outage degrades
 * to `{ rows: [], connected: false }` rather than failing the action.
 */
export async function getCrmInboxTw(
  projectId?: string,
  limit?: number,
): Promise<ActionResult<CrmInboxResult>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await buildCrmInbox(g.ctx.userId, g.ctx.projectId, { limit });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load the inbox.');
  }
}

/**
 * Inline quick reply from the shared inbox. Gated on `edit`. Delegates to
 * {@link sendSabcrmEmail}, which re-resolves the recipient from the record
 * (the `to` argument is informational — the UI shows who the reply goes to —
 * and is never used for delivery). Returns the same `{ activity, messageId }`
 * payload `sendSabcrmEmail` does.
 */
export async function quickReplyTw(
  object: string,
  recordId: string,
  to: string,
  subject: string,
  body: string,
  projectId?: string,
): Promise<ActionResult<SabcrmEmailSendResult>> {
  if (!object || !recordId) {
    return { ok: false, error: 'A matched record is required to reply.' };
  }
  if (!subject?.trim()) return { ok: false, error: 'A subject is required.' };
  if (!body?.trim()) return { ok: false, error: 'The reply body is empty.' };

  // `to` is accepted for the caller's intent/UI but delivery re-resolves the
  // address from the record inside `sendSabcrmEmail`.
  void to;

  // Gate on `edit` here so an unauthorised caller fails fast with our message;
  // `sendSabcrmEmail` runs the same gate again (defense in depth).
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  return sendSabcrmEmail(g.ctx.projectId, object, recordId, {
    subject: subject.trim(),
    body: body.trim(),
  });
}
