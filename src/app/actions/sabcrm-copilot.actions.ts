'use server';

/**
 * SabCRM — agentic copilot server action.
 *
 * `runCopilotTw` is the single gated, metered entry point for the
 * plan→retrieve→call-tools→observe loop in `@/lib/sabcrm/copilot.server`.
 * Gate/fail are copied verbatim from `sabcrm-scoring.actions.ts`
 * (session → project membership → RBAC `canServer` → plan), including the
 * cross-tenant defence against a client-supplied `projectId`.
 *
 * The action gates on `view` (asking is a read); the copilot loop itself then
 * resolves the caller's `edit` permission to decide whether write tools are
 * allowed — so a viewer can ask questions but can never be tricked into
 * mutating data. Every LLM turn inside the loop is quota-gated + metered under
 * `ai_requests`; we additionally fail fast here if the caller is already out of
 * AI quota before any work begins.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { canUse } from '@/lib/billing/entitlements';
import type { ActionResult } from '@/lib/sabcrm/types';
import { runCopilot, type CopilotRunResult } from '@/lib/sabcrm/copilot.server';

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
 * Run the agentic copilot for a natural-language question. Gated on `view`;
 * every LLM turn inside is metered under `ai_requests`. Returns the final
 * answer plus the full reasoning + tool-call transcript so the UI can show how
 * the answer was reached.
 */
export async function runCopilotTw(
  question: string,
  projectId?: string,
  maxSteps?: number,
): Promise<ActionResult<CopilotRunResult>> {
  if (!question?.trim()) return { ok: false, error: 'A question is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  if (!(await canUse(g.ctx.userId, 'ai_requests'))) {
    return { ok: false, error: 'AI quota exceeded.' };
  }
  try {
    const result = await runCopilot(g.ctx.projectId, g.ctx.userId, question, { maxSteps });
    // The loop itself returns honest in-band errors (blocked / unconfigured /
    // quota); surface them as a failed action so the UI shows the message.
    if (!result.ok) return { ok: false, error: result.error || result.answer };
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'The copilot failed to run.');
  }
}
