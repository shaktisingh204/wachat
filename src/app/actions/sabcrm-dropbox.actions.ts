'use server';

/**
 * SabCRM — BCC-dropbox server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/email-dropbox.server`. The `gate` /
 * `fail` helpers are copied verbatim from `sabcrm-scoring.actions.ts`
 * (session → project membership → RBAC `canServer('sabcrm', …)` → plan),
 * including the cross-tenant defense against a client-supplied `projectId`.
 *
 * `getDropboxAddressTw` gates `view` — it mints the per-project token on first
 * read and returns the copyable address + toggles. `setDropboxConfigTw` gates
 * `edit` (there is no `manage` PermissionAction — see `src/lib/rbac`).
 *
 * The actual inbound CAPTURE and the send-time self-BCC happen in
 * `email-dropbox.server.ts` (`captureDropboxEmail` / `dropboxBccForProject`),
 * NOT here — a `'use server'` export is a public endpoint and those paths
 * impersonate tenants / run in sessionless webhook contexts.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  ensureDropbox,
  setDropboxConfig,
  type DropboxStatus,
} from '@/lib/sabcrm/email-dropbox.server';

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

export type { DropboxStatus } from '@/lib/sabcrm/email-dropbox.server';

/**
 * Return (and mint on first use) the project's BCC-dropbox address + toggles.
 * Gated on `view`.
 */
export async function getDropboxAddressTw(
  projectId?: string,
): Promise<ActionResult<DropboxStatus>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await ensureDropbox(g.ctx.projectId) };
  } catch (e) {
    return fail(e, 'Failed to load the BCC-dropbox.');
  }
}

/**
 * Toggle the dropbox on/off and the auto-BCC self-logging. Gated on `edit`.
 */
export async function setDropboxConfigTw(
  patch: { enabled?: boolean; autoBcc?: boolean },
  projectId?: string,
): Promise<ActionResult<DropboxStatus>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return { ok: true, data: await setDropboxConfig(g.ctx.projectId, patch ?? {}) };
  } catch (e) {
    return fail(e, 'Failed to update the BCC-dropbox.');
  }
}
