'use server';

/**
 * SabCRM — roles & permissions server actions.
 *
 * Thin, gated wrappers over the Rust roles engine
 * ({@link sabcrmRolesApi} in `@/lib/rust-client/sabcrm-roles`). These power the
 * roles/permissions admin surface: named permission sets (free-form permission
 * keys) plus per-role member assignment.
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
 * Roles management is an admin surface: reads gate on `view`, while every
 * mutation gates on the strongest available manage action (`edit` for
 * update/member-assignment, `create`/`delete` for those respectively) — the
 * same mapping the sibling view-switcher actions use.
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown value
 * is normalised into `{ ok: false, error }` so the UI degrades gracefully.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRolesApi } from '@/lib/rust-client/sabcrm-roles';
import type { SabcrmRustRole } from '@/lib/rust-client/sabcrm-roles';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  CreateRoleTwInput,
  UpdateRoleTwPatch,
} from './sabcrm-roles.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the roles UI re-fetches. */
const TW_BASE_PATH = '/sabcrm/settings/roles';

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
// Roles CRUD — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists every role for the active project through the Rust engine. */
export async function listRolesTw(
  projectId?: string,
): Promise<ActionResult<SabcrmRustRole[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRolesApi.list(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list roles.');
  }
}

/** Fetches a single role by id. */
export async function getRoleTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRole>> {
  if (!id) return { ok: false, error: 'Role id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmRolesApi.get(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load role.');
  }
}

/** Creates a role. */
export async function createRoleTw(
  input: CreateRoleTwInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRole>> {
  if (!input?.name?.trim()) return { ok: false, error: 'A name is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const role = await sabcrmRolesApi.create(g.ctx.projectId, input);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: role };
  } catch (e) {
    return fail(e, 'Failed to create role.');
  }
}

/** Partial-updates a role (name, description, permissions, …). */
export async function updateRoleTw(
  id: string,
  patch: UpdateRoleTwPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRole>> {
  if (!id) return { ok: false, error: 'Role id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const role = await sabcrmRolesApi.update(g.ctx.projectId, id, patch);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: role };
  } catch (e) {
    return fail(e, 'Failed to update role.');
  }
}

/** Deletes a role by id. */
export async function deleteRoleTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Role id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmRolesApi.remove(g.ctx.projectId, id);
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete role.');
  }
}

/** Assigns or unassigns a single member id on a role. */
export async function setRoleMemberTw(
  id: string,
  memberId: string,
  assigned: boolean,
  projectId?: string,
): Promise<ActionResult<SabcrmRustRole>> {
  if (!id) return { ok: false, error: 'Role id is required.' };
  if (!memberId?.trim()) return { ok: false, error: 'A member id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const role = await sabcrmRolesApi.setMember(
      g.ctx.projectId,
      id,
      memberId,
      assigned,
    );
    revalidatePath(TW_BASE_PATH);
    return { ok: true, data: role };
  } catch (e) {
    return fail(e, 'Failed to update role member.');
  }
}
