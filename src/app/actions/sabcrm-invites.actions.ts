'use server';

/**
 * SabCRM — workspace-member invitation server actions.
 *
 * Thin, gated wrappers over the Rust invites engine
 * ({@link sabcrmInvitesApi} in `@/lib/rust-client/sabcrm-invites`). These
 * power the members/invitations panel: list, create, revoke and delete a
 * pending invite for the active project.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-views.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmInvitesApi } from '@/lib/rust-client/sabcrm-invites';
import type { SabcrmRustInvite } from '@/lib/rust-client/sabcrm-invites';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { ListInvitesTwOpts } from './sabcrm-invites.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-views.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

// ---------------------------------------------------------------------------
// Invites — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the workspace invitations for the active project (view-gated). */
export async function listInvitesTw(
  opts?: ListInvitesTwOpts,
): Promise<ActionResult<SabcrmRustInvite[]>> {
  const g = await gate('view', opts?.projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmInvitesApi.list(g.ctx.projectId, opts?.status);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list invites.');
  }
}

/** Creates a pending invite for an email (edit-gated). */
export async function createInviteTw(
  email: string,
  roleId?: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustInvite>> {
  if (!email?.trim()) return { ok: false, error: 'An email is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const invite = await sabcrmInvitesApi.create(
      g.ctx.projectId,
      email.trim(),
      roleId,
    );
    return { ok: true, data: invite };
  } catch (e) {
    return fail(e, 'Failed to create invite.');
  }
}

/** Revokes a pending invite by id (edit-gated). */
export async function revokeInviteTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustInvite>> {
  if (!id) return { ok: false, error: 'Invite id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmInvitesApi.revoke(g.ctx.projectId, id);
    return { ok: true, data: res.invite };
  } catch (e) {
    return fail(e, 'Failed to revoke invite.');
  }
}

/** Hard-deletes an invite by id (delete-gated). */
export async function deleteInviteTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Invite id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmInvitesApi.remove(g.ctx.projectId, id);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete invite.');
  }
}
