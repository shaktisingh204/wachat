'use server';

/**
 * SabCRM — "ask-your-CRM" server action.
 *
 * A natural-language question answered grounded in the project's records
 * (in-house keyword retrieval + the shared LLM — no vector store). Gate/fail
 * copied from `sabcrm-scoring.actions.ts`; owner-scoped retrieval via the gate
 * context's userId.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  groundedCrmAnswer,
  type GroundedSource,
} from '@/lib/sabcrm/crm-rag.server';

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}
interface GateContext {
  userId: string;
  projectId: string;
}
type GateResult = { ok: true; ctx: GateContext } | { ok: false; error: string };

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
 * Ask a natural-language question about the CRM. Returns the grounded answer +
 * the records it was grounded on. Gated on `view`.
 */
export async function askCrmTw(
  query: string,
  projectId?: string,
): Promise<ActionResult<{ answer: string; sources: GroundedSource[] }>> {
  if (!query?.trim()) return { ok: false, error: 'A question is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await groundedCrmAnswer(g.ctx.projectId, g.ctx.userId, query);
    if (!res.ok) return { ok: false, error: res.error };
    return { ok: true, data: { answer: res.answer, sources: res.sources } };
  } catch (e) {
    return fail(e, 'Failed to answer the question.');
  }
}
