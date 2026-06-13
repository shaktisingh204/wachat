'use server';

/**
 * SabCRM — email open/click tracking server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/email-tracking.server`. The `gate` /
 * `fail` helpers are copied verbatim from `sabcrm-scoring.actions.ts`
 * (session → project membership → RBAC `canServer('sabcrm', …)` → plan),
 * including the cross-tenant defense against a client-supplied `projectId`.
 *
 * Reads gate `view`; the "provision the display field" config action gates
 * `edit` (there is no `manage` PermissionAction — see `src/lib/rbac`). The
 * actual instrumentation of outbound mail happens in `email-core.ts`
 * (`createTrackedMessage`), NOT here — a `'use server'` export is a public
 * endpoint and tracking instrumentation rides the existing send path.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  listRecentTrackedMessages,
  trackingStats,
  trackSecret,
  EMAIL_LAST_EVENT_FIELD,
  type EmailTrackMessage,
} from '@/lib/sabcrm/email-tracking.server';
import { addFieldTw } from './sabcrm-objects.actions';

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

/** Whether token signing is configured (drives the settings "on/off" badge). */
export interface EmailTrackingStatus {
  /** True when an HMAC secret is configured — tracking will instrument sends. */
  configured: boolean;
  messages: number;
  opened: number;
  clicked: number;
}

/** Tracking status + lifetime stats for the active project. Gated on `view`. */
export async function getEmailTrackingStatusTw(
  projectId?: string,
): Promise<ActionResult<EmailTrackingStatus>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const stats = await trackingStats(g.ctx.projectId);
    return {
      ok: true,
      data: { configured: Boolean(trackSecret()), ...stats },
    };
  } catch (e) {
    return fail(e, 'Failed to load tracking status.');
  }
}

/** Recent tracked messages (newest event first) for the active project. View. */
export async function listTrackedMessagesTw(
  projectId?: string,
  limit = 50,
): Promise<ActionResult<EmailTrackMessage[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await listRecentTrackedMessages(g.ctx.projectId, limit),
    };
  } catch (e) {
    return fail(e, 'Failed to load tracked messages.');
  }
}

/**
 * Provision the `emailLastEvent` (TEXT) display field on an object so the most
 * recent open/click summary surfaces as a column / detail row. Gated on `edit`
 * (data-model management, same level as `addFieldTw`). Best-effort: a duplicate
 * field is swallowed (already provisioned on a prior call).
 */
export async function provisionEmailTrackingFieldTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ objectSlug: string }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const field: FieldMetadata = {
      key: EMAIL_LAST_EVENT_FIELD,
      label: 'Email engagement',
      type: 'TEXT',
      icon: 'MailOpen',
      inTable: false,
      description: 'Most recent open/click on tracked CRM email (SabCRM).',
    };
    await addFieldTw(objectSlug, field, g.ctx.projectId).catch(() => undefined);
    return { ok: true, data: { objectSlug } };
  } catch (e) {
    return fail(e, 'Failed to provision the tracking field.');
  }
}
