'use server';

/**
 * SabCRM — notifications server actions.
 *
 * Thin, gated wrappers over the Rust notifications engine
 * ({@link sabcrmNotificationsApi} in `@/lib/rust-client/sabcrm-notifications`).
 * These power the SabCRM notification bell / inbox: list + unread count
 * (reads, gated `view`) and mark-read / mark-all-read / delete (writes, gated
 * `edit`).
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
import { sabcrmNotificationsApi } from '@/lib/rust-client/sabcrm-notifications';
import type { SabcrmRustNotification } from '@/lib/rust-client/sabcrm-notifications';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { SabcrmNotificationListOpts } from './sabcrm-notifications.actions.types';

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
// Notifications — via the Rust engine
// ---------------------------------------------------------------------------

/** Lists the caller's notifications through the Rust engine (newest first). */
export async function listNotificationsTw(
  opts?: SabcrmNotificationListOpts,
  projectId?: string,
): Promise<ActionResult<SabcrmRustNotification[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmNotificationsApi.list(g.ctx.projectId, opts);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list notifications.');
  }
}

/** Returns the caller's unread notification count. */
export async function notificationsCountTw(
  projectId?: string,
): Promise<ActionResult<{ unread: number }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmNotificationsApi.count(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to count notifications.');
  }
}

/** Marks one of the caller's notifications read or unread. */
export async function markNotificationReadTw(
  id: string,
  read: boolean,
  projectId?: string,
): Promise<ActionResult<SabcrmRustNotification>> {
  if (!id) return { ok: false, error: 'Notification id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmNotificationsApi.markRead(g.ctx.projectId, id, read);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update notification.');
  }
}

/** Marks all the caller's notifications as read. */
export async function markAllNotificationsReadTw(
  projectId?: string,
): Promise<ActionResult<{ ok: boolean; updated: number }>> {
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmNotificationsApi.markAllRead(g.ctx.projectId);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to mark all notifications read.');
  }
}

/** Deletes one of the caller's notifications by id. */
export async function deleteNotificationTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Notification id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmNotificationsApi.remove(g.ctx.projectId, id);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete notification.');
  }
}

/**
 * Returns the relative SSE path the notification bell can hand to an
 * `EventSource` (via a token-forwarding proxy route) to receive live
 * `notification` / `count` events for the caller. Gated `view` and resolved
 * against the authorized project, so the path is only ever issued to a member.
 * Does NOT call the Rust engine — it only builds the URL string.
 */
export async function notificationsStreamPathTw(
  projectId?: string,
): Promise<ActionResult<{ path: string }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const path = sabcrmNotificationsApi.streamPath(g.ctx.projectId);
    return { ok: true, data: { path } };
  } catch (e) {
    return fail(e, 'Failed to resolve notification stream path.');
  }
}
