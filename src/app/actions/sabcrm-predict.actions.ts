'use server';

/**
 * SabCRM — predictive win-scoring actions. Trains the in-house logistic model
 * from the object's won/lost history, provisions the `winProbability` field,
 * and re-scores. Gate/fail copied from sabcrm-scoring.actions.ts.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult, FieldMetadata } from '@/lib/sabcrm/types';
import {
  trainWinModel,
  scoreWinForObject,
} from '@/lib/sabcrm/predictive-scoring.server';
import { addFieldTw } from './sabcrm-objects.actions';

const MODULE_KEY = 'sabcrm';
interface SessionUser { _id: string; }
interface GateContext { userId: string; projectId: string; }
type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

async function gate(action: PermissionAction, explicitProjectId?: string): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested = explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) return { ok: false, error: 'Permission denied.' };
  if (!(await canServer(MODULE_KEY, action, requested))) return { ok: false, error: 'Permission denied.' };
  if (!sabcrmPlanFeature.defaultEnabled) return { ok: false, error: 'Your plan does not include SabCRM.' };
  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) return { ok: false, error: e.message || fallback };
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/**
 * Train (or retrain) the win-probability model for an object, provision the
 * `winProbability` display field, and re-score existing records. Gated `edit`.
 */
export async function trainWinModelTw(
  objectSlug: string,
  projectId?: string,
): Promise<ActionResult<{ trained: boolean; won: number; lost: number; n: number; updated: number }>> {
  if (!objectSlug) return { ok: false, error: 'An object is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await trainWinModel(g.ctx.projectId, objectSlug);
    if (!res.trained) {
      return {
        ok: false,
        error: `Not enough labelled history to train (need ≥20 deals with both won and lost; have ${res.won} won / ${res.lost} lost).`,
      };
    }
    const field: FieldMetadata = {
      key: 'winProbability',
      label: 'Win probability',
      type: 'NUMBER',
      icon: 'TrendingUp',
      inTable: true,
      description: 'Predicted win % (in-house model).',
    };
    await addFieldTw(objectSlug, field, g.ctx.projectId).catch(() => undefined);
    const swept = await scoreWinForObject(g.ctx.projectId, objectSlug);
    return { ok: true, data: { ...res, updated: swept.updated } };
  } catch (e) {
    return fail(e, 'Failed to train the model.');
  }
}
