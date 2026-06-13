'use server';

/**
 * SabCRM — GDPR / data-privacy server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/gdpr.server`. The `gate` / `fail`
 * helpers mirror `sabcrm-scoring.actions.ts` verbatim (session → project
 * membership → RBAC `canServer('sabcrm', …)` → plan), including the cross-tenant
 * defense against a client-supplied `projectId`.
 *
 * Gating:
 *  - `recordConsentTw` — config write → `edit`.
 *  - `listConsentsTw` / `buildDsarExportTw` — reads → `view`.
 *  - `eraseSubjectTw` — DESTRUCTIVE (Right-To-Be-Forgotten) → `delete`. The
 *    most privileged gate available (RBAC has no `manage`). The destructive
 *    nature is additionally surfaced to the UI which confirm-gates the call.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  recordConsent,
  listConsents,
  eraseSubject,
  buildDsarExport,
  listErasures,
  type ConsentRecord,
  type ConsentInput,
  type DsarBundle,
  type ErasureReport,
} from '@/lib/sabcrm/gdpr.server';

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
/* Consent                                                                     */
/* -------------------------------------------------------------------------- */

/** Record (grant or withdraw) consent for a subject + purpose. Gated `edit`. */
export async function recordConsentTw(
  input: ConsentInput,
  projectId?: string,
): Promise<ActionResult<ConsentRecord>> {
  if (!input?.subjectEmail?.trim()) {
    return { ok: false, error: 'A subject email is required.' };
  }
  if (!input?.purpose?.trim()) {
    return { ok: false, error: 'A purpose is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await recordConsent(g.ctx.projectId, input) };
  } catch (e) {
    return fail(e, 'Failed to record consent.');
  }
}

/** List every consent record for a subject. Gated `view`. */
export async function listConsentsTw(
  subjectEmail: string,
  projectId?: string,
): Promise<ActionResult<ConsentRecord[]>> {
  if (!subjectEmail?.trim()) {
    return { ok: false, error: 'A subject email is required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listConsents(g.ctx.projectId, subjectEmail) };
  } catch (e) {
    return fail(e, 'Failed to load consents.');
  }
}

/* -------------------------------------------------------------------------- */
/* DSAR export                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build the data-subject access request (DSAR) export bundle for a subject.
 * Read-only — gated `view`. The caller downloads the returned JSON.
 */
export async function buildDsarExportTw(
  subjectEmail: string,
  projectId?: string,
): Promise<ActionResult<DsarBundle>> {
  if (!subjectEmail?.trim()) {
    return { ok: false, error: 'A subject email is required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await buildDsarExport(g.ctx.projectId, subjectEmail) };
  } catch (e) {
    return fail(e, 'Failed to build DSAR export.');
  }
}

/* -------------------------------------------------------------------------- */
/* Erasure (Right-To-Be-Forgotten) — DESTRUCTIVE                               */
/* -------------------------------------------------------------------------- */

/**
 * Erase (anonymize) a data subject across the whole project. DESTRUCTIVE —
 * gated `delete` (the most privileged action available; RBAC has no `manage`).
 * The records are KEPT but their PII fields are nulled and an audit row is
 * written. The UI confirm-gates this call. The acting user is recorded in the
 * erasure audit log.
 */
export async function eraseSubjectTw(
  subjectEmail: string,
  projectId?: string,
): Promise<ActionResult<ErasureReport>> {
  if (!subjectEmail?.trim()) {
    return { ok: false, error: 'A subject email is required.' };
  }
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await eraseSubject(g.ctx.projectId, subjectEmail, g.ctx.userId),
    };
  } catch (e) {
    return fail(e, 'Failed to erase subject.');
  }
}

/** List prior erasure audit rows (optionally filtered by subject). Gated `view`. */
export async function listErasuresTw(
  subjectEmail?: string,
  projectId?: string,
): Promise<
  ActionResult<
    Array<{
      id: string;
      subjectEmail: string;
      actorUserId: string | null;
      erasedAt: string;
      recordsRedacted: number;
      activitiesRedacted: number;
    }>
  >
> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await listErasures(g.ctx.projectId, subjectEmail) };
  } catch (e) {
    return fail(e, 'Failed to load erasure log.');
  }
}
