'use server';

/**
 * SabCRM — marketing attribution server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/attribution.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * The attribution REPORT is a read surface, gated on `view`. The lifecycle
 * emit + touch recording (`emitCrmEventToSabsense` / `recordTouch`) are NOT
 * exposed as actions — they fire inline from the record-mutation actions
 * (`createSabcrmRecordTw` / `updateSabcrmRecordTw`), already gated there.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  buildAttributionReport,
  coerceModel,
  ensureTouchIndexes,
  type AttributionModel,
  type AttributionReport,
} from '@/lib/sabcrm/attribution.server';

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

/** Serialisable input for the report action (kept free of server-only types). */
export interface AttributionReportRequest {
  model?: AttributionModel | string;
  objectSlug?: string;
  dateRange?: { from?: string; to?: string };
}

/**
 * Build the marketing-attribution report (won revenue by source / campaign
 * under the chosen model). Gated on `view`. Degrades to a zeroed report on a
 * read failure — never throws.
 */
export async function getAttributionReportTw(
  req: AttributionReportRequest = {},
  projectId?: string,
): Promise<ActionResult<AttributionReport>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    // Cheap, best-effort index creation on the read path (idempotent).
    await ensureTouchIndexes();
    const report = await buildAttributionReport(g.ctx.projectId, {
      model: coerceModel(req?.model),
      objectSlug: req?.objectSlug,
      dateRange: req?.dateRange,
    });
    return { ok: true, data: report };
  } catch (e) {
    return fail(e, 'Failed to build attribution report.');
  }
}
