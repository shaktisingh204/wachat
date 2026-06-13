'use server';

/**
 * SabCRM — conversation intelligence action. Analyzes a transcript via the LLM
 * into structured insights (+ a timeline-ready note body). Gated `view`,
 * metered under `ai_requests`. Gate/fail copied from sabcrm-scoring.actions.ts.
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
  analyzeTranscript,
  analysisToNote,
  type ConversationAnalysis,
} from '@/lib/sabcrm/conversation-intel.server';

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
 * Analyze a call/meeting transcript into structured insights + a note body
 * ready to paste onto the record timeline. Gated `view`; metered.
 */
export async function analyzeTranscriptTw(
  transcript: string,
  contextLabel?: string,
  projectId?: string,
): Promise<ActionResult<{ analysis: ConversationAnalysis; note: string }>> {
  if (!transcript?.trim()) return { ok: false, error: 'A transcript is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  if (!(await canUse(g.ctx.userId, 'ai_requests'))) {
    return { ok: false, error: 'AI quota exceeded.' };
  }
  try {
    const res = await analyzeTranscript(transcript, contextLabel);
    if (!res.ok) return { ok: false, error: res.error };
    try {
      await recordUsage({
        tenantId: g.ctx.userId,
        feature: 'ai_requests',
        units: 1,
        idempotencyKey: `sabcrm-convo:${randomUUID()}`,
        meta: { feature: 'sabcrm', op: 'conversationIntel' },
      });
    } catch {
      /* metering never blocks a good result */
    }
    return { ok: true, data: { analysis: res.analysis, note: analysisToNote(res.analysis) } };
  } catch (e) {
    return fail(e, 'Failed to analyze the transcript.');
  }
}
