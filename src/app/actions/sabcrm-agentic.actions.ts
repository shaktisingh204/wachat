'use server';

/**
 * SabCRM — agentic helper server actions.
 *
 * Thin gated + metered wrappers over `@/lib/sabcrm/ai-agentic.server`:
 *
 *  - `nlBuildListTw`   — NL → validated filter spec → matching records via the
 *                        owner-scoped `listRecords` path. Gated on `view`
 *                        (it only reads records), metered on `ai_requests`.
 *  - `saveSegmentTw` / `listSegmentsTw` / `deleteSegmentTw` — persist a
 *                        re-runnable segment from a validated spec. Save/delete
 *                        gated on `edit` (creates project config); list on
 *                        `view`. No LLM call → not metered.
 *  - `qualifyLeadTw`   — AI lead-qualification verdict written to
 *                        `data.aiQualification`. Gated on `edit` (it mutates the
 *                        record envelope), metered on `ai_requests`.
 *
 * The `gate` / `fail` helpers mirror `sabcrm-scoring.actions.ts` verbatim
 * (session → project membership → RBAC `canServer('sabcrm', …)` → plan),
 * including the cross-tenant defence against a client-supplied `projectId`.
 * Metering follows `sabcrm-ai.actions.ts`: the acting USER is the metered
 * tenant, `canUse('ai_requests')` gates BEFORE the LLM call, and `recordUsage`
 * is idempotency-keyed AFTER success and never blocks a good result.
 */

import { createHash } from 'crypto';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  nlBuildList,
  qualifyLead,
  listSegments,
  saveSegment,
  deleteSegment,
  type NlListResult,
  type SavedSegment,
  type FilterSpec,
  type QualificationResult,
} from '@/lib/sabcrm/ai-agentic.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-scoring.actions). */
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

/* -------------------------------------------------------------------------- */
/* (a) NL list building                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Build a record list from a natural-language request. Gated on `view`
 * (read-only over records), metered on `ai_requests` (one LLM call). The
 * validated spec is returned alongside the records so the UI can show it and
 * offer "save as segment".
 */
export async function nlBuildListTw(
  objectSlug: string,
  nlQuery: string,
  projectId?: string,
): Promise<ActionResult<NlListResult>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  // AI entitlement BEFORE the LLM call (acting user is the metered tenant).
  const allowed = await canUse(g.ctx.userId, 'ai_requests');
  if (!allowed) return { ok: false, error: 'AI quota exceeded.' };

  try {
    const res = await nlBuildList(g.ctx.projectId, g.ctx.userId, objectSlug, nlQuery);
    if (!res.ok) return { ok: false, error: res.error };

    // Meter AFTER success — deterministic key so a retried identical request is
    // not double-billed. Never blocks the result.
    try {
      await recordUsage({
        tenantId: g.ctx.userId,
        feature: 'ai_requests',
        units: 1,
        idempotencyKey: createHash('sha256')
          .update(`sabcrm-nl-list:${g.ctx.projectId}:${objectSlug}:${nlQuery.trim()}`)
          .digest('hex'),
        meta: { feature: 'sabcrm', op: 'nlBuildList', object: objectSlug },
      });
    } catch (e) {
      console.error('[sabcrm-agentic] recordUsage failed for nlBuildListTw:', e);
    }

    return { ok: true, data: res.data };
  } catch (e) {
    return fail(e, 'Failed to build the list.');
  }
}

/* -------------------------------------------------------------------------- */
/* Saved segments                                                              */
/* -------------------------------------------------------------------------- */

/** List saved segments (optionally one object). Gated on `view`. No LLM call. */
export async function listSegmentsTw(
  objectSlug?: string,
  projectId?: string,
): Promise<ActionResult<SavedSegment[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listSegments(g.ctx.projectId, objectSlug) };
  } catch (e) {
    return fail(e, 'Failed to load segments.');
  }
}

/**
 * Save a validated spec as a named segment. Gated on `edit` (it creates project
 * config). The spec is re-validated server-side against the object's live
 * fields. No LLM call → not metered.
 */
export async function saveSegmentTw(
  input: { object: string; name: string; query?: string; spec: FilterSpec },
  projectId?: string,
): Promise<ActionResult<SavedSegment>> {
  if (!input?.object) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await saveSegment(g.ctx.projectId, input);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, data: res.segment };
  } catch (e) {
    return fail(e, 'Failed to save the segment.');
  }
}

/** Delete a saved segment by id. Gated on `edit`. */
export async function deleteSegmentTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A segment id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteSegment(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Segment not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete the segment.');
  }
}

/* -------------------------------------------------------------------------- */
/* (b) Lead qualification                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Qualify one lead/record with the LLM and write the verdict to
 * `data.aiQualification`. Gated on `edit` (it mutates the record envelope),
 * metered on `ai_requests`. Each call is billed (timestamped idempotency key) —
 * a re-qualification is a fresh request and a fresh charge.
 */
export async function qualifyLeadTw(
  objectSlug: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<QualificationResult & { computedAt: string }>> {
  if (!objectSlug || !recordId) {
    return { ok: false, error: 'Object and record are required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const allowed = await canUse(g.ctx.userId, 'ai_requests');
  if (!allowed) return { ok: false, error: 'AI quota exceeded.' };

  try {
    const res = await qualifyLead(g.ctx.projectId, g.ctx.userId, objectSlug, recordId);
    if (!res.ok) return { ok: false, error: res.error };

    try {
      await recordUsage({
        tenantId: g.ctx.userId,
        feature: 'ai_requests',
        units: 1,
        idempotencyKey: `sabcrm-qualify:${recordId}:${res.data.computedAt}`,
        meta: { feature: 'sabcrm', op: 'qualifyLead', object: objectSlug },
      });
    } catch (e) {
      console.error('[sabcrm-agentic] recordUsage failed for qualifyLeadTw:', e);
    }

    return { ok: true, data: res.data };
  } catch (e) {
    return fail(e, 'Failed to qualify the lead.');
  }
}
