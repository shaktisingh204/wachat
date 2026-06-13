'use server';

/**
 * SabCRM — activity auto-capture server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/auto-capture.server`. The `gate` /
 * `fail` helpers mirror `sabcrm-scoring.actions.ts` verbatim (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 *  - {@link getAutoCaptureConfigTw} / {@link runCalendarCaptureTw} gate `view`.
 *  - {@link saveAutoCaptureConfigTw} gates `edit` (config management — there is
 *    no `manage` PermissionAction, so config writes use `edit`).
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  getAutoCaptureConfig,
  saveAutoCaptureConfig,
  captureCalendarEvents,
  type AutoCaptureConfig,
  type AutoCaptureConfigInput,
  type CaptureCalendarResult,
} from '@/lib/sabcrm/auto-capture.server';

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

/** Read the project's auto-capture config + last-run. Gated on `view`. */
export async function getAutoCaptureConfigTw(
  projectId?: string,
): Promise<ActionResult<AutoCaptureConfig>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await getAutoCaptureConfig(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load auto-capture settings.');
  }
}

/** Upsert the toggle config (enable + per-channel switches). Gated on `edit`. */
export async function saveAutoCaptureConfigTw(
  input: AutoCaptureConfigInput,
  projectId?: string,
): Promise<ActionResult<AutoCaptureConfig>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await saveAutoCaptureConfig(g.ctx.projectId, input ?? {}) };
  } catch (e) {
    return fail(e, 'Failed to save auto-capture settings.');
  }
}

/**
 * Manually run the Google Calendar capture for the active project, attributing
 * the calendar connection to the signed-in user. Gated on `view` (it logs new
 * activities but is a user-initiated pull of the caller's own calendar, like a
 * read/sync action — the persistent on/off switch is the `edit`-gated config).
 */
export async function runCalendarCaptureTw(
  projectId?: string,
): Promise<ActionResult<CaptureCalendarResult>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await captureCalendarEvents(g.ctx.projectId, g.ctx.userId),
    };
  } catch (e) {
    return fail(e, 'Failed to capture calendar events.');
  }
}
