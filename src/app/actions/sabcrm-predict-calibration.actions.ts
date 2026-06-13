'use server';

/**
 * SabCRM — calibrated, explainable, per-segment win-scoring actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/predictive-calibration.server`, which
 * EXTENDS the base predictive scorer (`./predictive-scoring.server.ts`) with
 * Platt calibration, per-segment logistic models, and a per-feature
 * explanation. The `gate` / `fail` helpers are copied verbatim from
 * `sabcrm-predict.actions.ts` (session → project membership → RBAC
 * `canServer('sabcrm', …)` → plan), including the cross-tenant defense against a
 * client-supplied `projectId`.
 *
 * No LLM call is made here — calibration, segmentation and explainability are
 * pure in-house ML (logistic regression + Platt/isotonic + logistic SHAP), so
 * there is nothing to meter against `ai_requests`. (The base RBAC + plan gate
 * still applies on every call.)
 *
 * `trainCalibratedModelTw` (gated `edit`) trains the bundle, provisions the
 * `winProbability` (NUMBER) display field on the object via the Rust metadata
 * path (`addFieldTw` — the two-store gotcha), and re-scores the existing book.
 * `getWinExplanationTw` (gated `view`) returns the top win/loss drivers for one
 * record.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  trainCalibratedModel,
  scoreCalibratedForObject,
  getWinExplanation,
  type CalibrationTrainReport,
  type WinExplanation,
} from '@/lib/sabcrm/predictive-calibration.server';
import { addFieldTw } from './sabcrm-objects.actions';

const MODULE_KEY = 'sabcrm';
interface SessionUser { _id: string; }
interface GateContext { userId: string; projectId: string; }
type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

/** session → project membership → RBAC → plan (mirrors sabcrm-predict.actions.ts). */
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
  if (!myProjectIds.has(requested)) return { ok: false, error: 'Permission denied.' };
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
 * Train (or retrain) the calibrated per-segment win model for an object,
 * provision the `winProbability` display field, and re-score existing records.
 * Gated `edit` (model training is data-model management, same as `addFieldTw`).
 *
 * @param objectSlug   the object to train on (e.g. the deal object)
 * @param segmentField categorical field to segment by, or null for global-only
 */
export async function trainCalibratedModelTw(
  objectSlug: string,
  segmentField?: string | null,
  projectId?: string,
): Promise<ActionResult<CalibrationTrainReport & { updated: number }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await trainCalibratedModel(g.ctx.projectId, objectSlug, segmentField);
    if (!res.trained) {
      return { ok: false, error: res.reason ?? 'Not enough labelled history to train.' };
    }
    const field: FieldMetadata = {
      key: 'winProbability',
      label: 'Win probability',
      type: 'NUMBER',
      icon: 'TrendingUp',
      inTable: true,
      description: 'Calibrated predicted win % (in-house per-segment model).',
    };
    // Best-effort provisioning (swallow "already exists" from a prior train).
    await addFieldTw(objectSlug, field, g.ctx.projectId).catch(() => undefined);
    const swept = await scoreCalibratedForObject(g.ctx.projectId, objectSlug);
    return { ok: true, data: { ...res, updated: swept.updated } };
  } catch (e) {
    return fail(e, 'Failed to train the calibrated model.');
  }
}

/**
 * Top win/loss drivers behind one record's calibrated win-probability.
 * Gated `view`. Computes on demand when no explanation is cached yet.
 */
export async function getWinExplanationTw(
  objectSlug: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<WinExplanation>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  if (!recordId) return { ok: false, error: 'A record is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const exp = await getWinExplanation(g.ctx.projectId, objectSlug, recordId);
    if (!exp) {
      return { ok: false, error: 'No prediction available. Train a model first.' };
    }
    return { ok: true, data: exp };
  } catch (e) {
    return fail(e, 'Failed to load the win explanation.');
  }
}
