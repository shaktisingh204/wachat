'use server';

/**
 * SabCRM — service-case (ticketing) server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/cases.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * Gating:
 *   - reads (`getCaseSlaTw`, `getCasePolicyTw`, `getCsatSummaryTw`) → `view`
 *   - config / provisioning (`enableCasesTw`, `saveCasePolicyTw`,
 *     `issueCsatLinkTw`, `recomputeCaseSlaTw`) → `edit`  (NO `manage`)
 *
 * `submitCsatPublic` is the PUBLIC, UNGATED-but-validated survey submit — it has
 * NO session/RBAC gate (the respondent is an anonymous customer) and instead
 * validates a honeypot + the 32-char token + the 1–5 score server-side, exactly
 * like the existing public form actions (`submitProjectRating`).
 */

import { headers } from 'next/headers';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  ensureCaseObject,
  recomputeSlaForCase,
  getCasePolicy,
  saveCasePolicy,
  issueCsatToken,
  recordCsat,
  aggregateProjectCsat,
  computeSla,
  caseLikeForId,
  type SlaPolicy,
  type SlaComputation,
  type CsatAggregate,
} from '@/lib/sabcrm/cases.server';

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

/* -------------------------------------------------------------------------- */
/* Gated actions                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Provision the `cases` object for the active project. Gated on `edit`
 * (data-model management). Idempotent — safe to call repeatedly.
 */
export async function enableCasesTw(
  projectId?: string,
): Promise<ActionResult<{ ready: boolean; created: boolean }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return await ensureCaseObject(g.ctx.projectId);
  } catch (e) {
    return fail(e, 'Failed to enable cases.');
  }
}

/** The current SLA picture for one case (computed live). Gated on `view`. */
export async function getCaseSlaTw(
  caseId: string,
  projectId?: string,
): Promise<ActionResult<SlaComputation>> {
  if (!caseId) return { ok: false, error: 'A case id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const { policy, warningRatio } = await getCasePolicy(g.ctx.projectId);
    const c = await caseLikeForId(g.ctx.projectId, caseId);
    if (!c) return { ok: false, error: 'Case not found.' };
    return { ok: true, data: computeSla(c, Date.now(), policy, warningRatio) };
  } catch (e) {
    return fail(e, 'Failed to compute SLA.');
  }
}

/** Recompute + persist a case's SLA scalars now. Gated on `edit`. */
export async function recomputeCaseSlaTw(
  caseId: string,
  projectId?: string,
): Promise<ActionResult<{ updated: boolean }>> {
  if (!caseId) return { ok: false, error: 'A case id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const updated = await recomputeSlaForCase(g.ctx.projectId, caseId);
    return { ok: true, data: { updated } };
  } catch (e) {
    return fail(e, 'Failed to recompute SLA.');
  }
}

/** Read the project's SLA policy (defaults filled). Gated on `view`. */
export async function getCasePolicyTw(
  projectId?: string,
): Promise<ActionResult<{ policy: SlaPolicy; warningRatio: number }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await getCasePolicy(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load SLA policy.');
  }
}

/** Save the project's SLA policy. Gated on `edit`. */
export async function saveCasePolicyTw(
  input: { policy?: Partial<SlaPolicy>; warningRatio?: number },
  projectId?: string,
): Promise<ActionResult<{ policy: SlaPolicy; warningRatio: number }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await saveCasePolicy(g.ctx.projectId, input ?? {}) };
  } catch (e) {
    return fail(e, 'Failed to save SLA policy.');
  }
}

/** Mint a public CSAT survey link for a case. Gated on `edit`. */
export async function issueCsatLinkTw(
  caseId: string,
  projectId?: string,
): Promise<ActionResult<{ token: string; path: string }>> {
  if (!caseId) return { ok: false, error: 'A case id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await issueCsatToken(g.ctx.projectId, caseId);
    if (!res) return { ok: false, error: 'Could not create a survey link.' };
    return { ok: true, data: res };
  } catch (e) {
    return fail(e, 'Failed to create survey link.');
  }
}

/** Aggregate CSAT for the project (count / average / satisfaction). Gated `view`. */
export async function getCsatSummaryTw(
  projectId?: string,
): Promise<ActionResult<CsatAggregate>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await aggregateProjectCsat(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load CSAT summary.');
  }
}

/* -------------------------------------------------------------------------- */
/* PUBLIC — ungated-but-validated CSAT submit                                  */
/* -------------------------------------------------------------------------- */

/** Public CSAT submit shape (no projectId — the token carries the tenant). */
export interface SubmitCsatInput {
  token: string;
  score: number;
  comment?: string;
  /** Honeypot — must stay empty; a filled value means a bot. */
  website?: string;
}

export type SubmitCsatResult =
  | { success: true }
  | { success: false; error: string };

/**
 * PUBLIC, UNGATED-but-validated CSAT survey submit. No session / RBAC: the
 * respondent is an anonymous customer following a hashed survey link. Defense:
 *   - honeypot (`website`) must be empty
 *   - the token must be the right 32-char hex shape (re-validated server-side)
 *   - the score must coerce to 1–5
 *   - the survey must exist and be unsubmitted (enforced in `recordCsat`)
 * Captures the respondent IP for light-touch auditing, mirroring
 * `submitProjectRating`.
 */
export async function submitCsatPublic(
  input: SubmitCsatInput,
): Promise<SubmitCsatResult> {
  // Honeypot: a real user never fills this hidden field.
  if (input?.website && input.website.trim() !== '') {
    return { success: false, error: 'Submission rejected.' };
  }
  let ip: string | null = null;
  try {
    const h = await headers();
    ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      null;
  } catch {
    ip = null;
  }
  const res = await recordCsat(input?.token, input?.score, input?.comment, ip);
  return res.ok ? { success: true } : { success: false, error: res.error };
}
