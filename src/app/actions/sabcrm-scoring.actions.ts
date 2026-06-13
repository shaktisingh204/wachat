'use server';

/**
 * SabCRM — rule-based lead/deal scoring server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/scoring.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-ai.actions.ts` (session → project
 * membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * `saveScoringRulesTw` additionally (a) provisions the `score` (NUMBER) and
 * `scoreTier` (SELECT) display fields on the target object via the existing
 * `addFieldTw` metadata action (the Rust path — two-store gotcha), and
 * (b) re-scores the object's existing records so saving a rule set takes effect
 * immediately, not only on the next mutation. Both are best-effort and never
 * fail the save.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  listScoringRuleSets,
  upsertScoringRuleSet,
  deleteScoringRuleSet,
  recomputeScoresForObject,
  DEFAULT_SCORE_FIELD,
  DEFAULT_TIER_FIELD,
  type ScoringRuleSet,
  type ScoringRuleSetInput,
} from '@/lib/sabcrm/scoring.server';
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

/** session → project membership → RBAC → plan (mirrors sabcrm-ai.actions.ts). */
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

/** List every scoring rule set in the active project. Gated on `view`. */
export async function listScoringRulesTw(
  projectId?: string,
): Promise<ActionResult<ScoringRuleSet[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listScoringRuleSets(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load scoring rules.');
  }
}

/**
 * Best-effort provisioning of the score + tier display fields on the object.
 * `addFieldTw` is idempotent-ish: it errors when a field already exists, which
 * we swallow (the field is already there from a prior save).
 */
async function ensureScoreFields(
  ruleSet: ScoringRuleSet,
  projectId: string,
): Promise<void> {
  const scoreField = ruleSet.scoreField || DEFAULT_SCORE_FIELD;
  const tierField = ruleSet.tierField || DEFAULT_TIER_FIELD;
  const scoreDef: FieldMetadata = {
    key: scoreField,
    label: 'Score',
    type: 'NUMBER',
    icon: 'Gauge',
    inTable: true,
    description: 'Computed by SabCRM rule-based scoring.',
  };
  const tierDef: FieldMetadata = {
    key: tierField,
    label: 'Score tier',
    type: 'SELECT',
    icon: 'Target',
    inTable: true,
    description: 'Score band computed by SabCRM scoring.',
    options: (ruleSet.tiers ?? []).map((t) => ({
      value: t.label,
      label: t.label,
      color: t.color,
    })),
  };
  // Swallow "already exists" — provisioning only matters on first enable.
  await addFieldTw(ruleSet.objectSlug, scoreDef, projectId).catch(() => undefined);
  await addFieldTw(ruleSet.objectSlug, tierDef, projectId).catch(() => undefined);
}

/**
 * Create or update a scoring rule set. Gated on `edit` (data-model
 * management, same as `addFieldTw`). On an enabled set, provisions the display
 * fields and re-scores the existing records (both best-effort).
 */
export async function saveScoringRulesTw(
  input: ScoringRuleSetInput,
  projectId?: string,
): Promise<ActionResult<ScoringRuleSet>> {
  if (!input?.objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const saved = await upsertScoringRuleSet(g.ctx.projectId, input);
    if (saved.enabled) {
      await ensureScoreFields(saved, g.ctx.projectId);
      await recomputeScoresForObject(g.ctx.projectId, saved.objectSlug).catch(
        () => undefined,
      );
    }
    return { ok: true, data: saved };
  } catch (e) {
    return fail(e, 'Failed to save scoring rules.');
  }
}

/** Delete a scoring rule set by id. Gated on `edit`. */
export async function deleteScoringRulesTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A rule set id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteScoringRuleSet(g.ctx.projectId, id);
    if (!ok) return { ok: false, error: 'Rule set not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete scoring rules.');
  }
}

/** Manually re-score every record of an object. Gated on `edit`. */
export async function recomputeScoresTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ scanned: number; updated: number }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await recomputeScoresForObject(g.ctx.projectId, objectSlug),
    };
  } catch (e) {
    return fail(e, 'Failed to recompute scores.');
  }
}
