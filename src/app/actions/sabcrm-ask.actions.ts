'use server';

/**
 * SabCRM — "ask-your-CRM" + semantic search server actions.
 *
 * `askCrmTw` answers a question grounded in the project's records (semantic
 * retrieval with keyword fallback). `semanticSearchTw` is retrieval-only.
 * `reindexSemanticTw` seeds/refreshes the embedding index (opt-in: this is what
 * turns semantic search ON for a project). Embedding calls are metered under
 * `ai_requests`. Gate/fail copied from `sabcrm-scoring.actions.ts`.
 */

import { randomUUID } from 'crypto';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { canUse } from '@/lib/billing/entitlements';
import { recordUsage } from '@/lib/billing/usage-meter';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  groundedCrmAnswer,
  type GroundedSource,
} from '@/lib/sabcrm/crm-rag.server';
import {
  semanticSearch,
  reindexAllProjectEmbeddings,
} from '@/lib/sabcrm/embeddings.server';

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

/** Record one `ai_requests` unit; metering must never block a good result. */
async function meterAi(userId: string, op: string, units = 1): Promise<void> {
  try {
    await recordUsage({
      tenantId: userId,
      feature: 'ai_requests',
      units,
      idempotencyKey: `sabcrm-${op}:${randomUUID()}`,
      meta: { feature: 'sabcrm', op },
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Ask a natural-language question about the CRM. Returns the grounded answer +
 * the records it was grounded on. Gated on `view`; metered under `ai_requests`.
 */
export async function askCrmTw(
  query: string,
  projectId?: string,
): Promise<ActionResult<{ answer: string; sources: GroundedSource[] }>> {
  if (!query?.trim()) return { ok: false, error: 'A question is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  if (!(await canUse(g.ctx.userId, 'ai_requests'))) {
    return { ok: false, error: 'AI quota exceeded.' };
  }
  try {
    const res = await groundedCrmAnswer(g.ctx.projectId, g.ctx.userId, query);
    if (!res.ok) return { ok: false, error: res.error };
    await meterAi(g.ctx.userId, 'crmAsk');
    return { ok: true, data: { answer: res.answer, sources: res.sources } };
  } catch (e) {
    return fail(e, 'Failed to answer the question.');
  }
}

/** Semantic record search (retrieval only). Gated `view`; metered. */
export async function semanticSearchTw(
  query: string,
  projectId?: string,
): Promise<ActionResult<GroundedSource[]>> {
  if (!query?.trim()) return { ok: false, error: 'A query is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  if (!(await canUse(g.ctx.userId, 'ai_requests'))) {
    return { ok: false, error: 'AI quota exceeded.' };
  }
  try {
    const hits = await semanticSearch(g.ctx.projectId, g.ctx.userId, query);
    if (hits === null) {
      return { ok: false, error: 'Semantic search is not available (no embeddings / AI key).' };
    }
    await meterAi(g.ctx.userId, 'semanticSearch');
    return {
      ok: true,
      data: hits.map((h) => ({ object: h.object, id: h.id, label: h.label })),
    };
  } catch (e) {
    return fail(e, 'Failed to search.');
  }
}

/**
 * Seed / refresh the project's embedding index — this is what ENABLES semantic
 * search for a project (indexing is otherwise opt-in). Gated on `edit`;
 * metered by the number of records embedded.
 */
export async function reindexSemanticTw(
  projectId?: string,
): Promise<ActionResult<{ scanned: number; updated: number }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  if (!(await canUse(g.ctx.userId, 'ai_requests'))) {
    return { ok: false, error: 'AI quota exceeded.' };
  }
  try {
    const sweeps = await reindexAllProjectEmbeddings(g.ctx.projectId, 500, {
      force: true,
    });
    const scanned = sweeps.reduce((n, s) => n + s.scanned, 0);
    const updated = sweeps.reduce((n, s) => n + s.updated, 0);
    if (updated > 0) await meterAi(g.ctx.userId, 'semanticReindex', updated);
    return { ok: true, data: { scanned, updated } };
  } catch (e) {
    return fail(e, 'Failed to reindex.');
  }
}
