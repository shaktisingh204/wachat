'use server';

/**
 * SabCRM — persistent notification inbox server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/notifications.server` (the IN-HOUSE,
 * Mongo-backed inbox behind the SabCRM notification bell). The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 * Every action operates on the SESSION USER'S OWN inbox: the recipient is always
 * `g.ctx.userId`, never a client-supplied id. Because the inbox is the caller's
 * own, even the mutations (mark-read / mark-all-read) gate on `'view'` — a
 * member who can see SabCRM may always tidy their own bell — while still being
 * pinned to that one authenticated user, so no cross-user write is possible.
 *
 * Lives in a separate file from the Rust-backed `sabcrm-notifications.actions.ts`
 * (a different engine) — this one owns the `sabcrm_notifications` Mongo
 * collection and the `notify()` enqueue used by comments-mentions + cases.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  deleteNotification,
  type SabcrmInboxNotification,
} from '@/lib/sabcrm/notifications.server';
import type { ListNotificationsTwOpts } from './sabcrm-notification-inbox.actions.types';

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

/**
 * List the session user's notifications in the active project (newest first).
 * Gated on `view`. The recipient is always the authenticated user.
 */
export async function listNotificationsTw(
  opts?: ListNotificationsTwOpts,
  projectId?: string,
): Promise<ActionResult<SabcrmInboxNotification[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await listNotifications(g.ctx.projectId, g.ctx.userId, {
      unreadOnly: opts?.unreadOnly,
      limit: opts?.limit,
      skip: opts?.skip,
    });
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load notifications.');
  }
}

/** The session user's unread count in the active project. Gated on `view`. */
export async function unreadCountTw(
  projectId?: string,
): Promise<ActionResult<{ unread: number }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const unread = await unreadCount(g.ctx.projectId, g.ctx.userId);
    return { ok: true, data: { unread } };
  } catch (e) {
    return fail(e, 'Failed to count notifications.');
  }
}

/**
 * Mark one of the session user's notifications read (or unread). Gated on
 * `view` — it is the caller's OWN inbox and the write is pinned to
 * `g.ctx.userId`, so no cross-user mutation is possible.
 */
export async function markReadTw(
  id: string,
  read = true,
  projectId?: string,
): Promise<ActionResult<{ id: string; read: boolean }>> {
  if (!id) return { ok: false, error: 'A notification id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await markRead(g.ctx.projectId, g.ctx.userId, id, read);
    if (!ok) return { ok: false, error: 'Notification not found.' };
    return { ok: true, data: { id, read } };
  } catch (e) {
    return fail(e, 'Failed to update notification.');
  }
}

/** Mark all the session user's notifications read. Gated on `view`. */
export async function markAllReadTw(
  projectId?: string,
): Promise<ActionResult<{ updated: number }>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const updated = await markAllRead(g.ctx.projectId, g.ctx.userId);
    return { ok: true, data: { updated } };
  } catch (e) {
    return fail(e, 'Failed to mark all notifications read.');
  }
}

/** Delete one of the session user's notifications. Gated on `view`. */
export async function deleteNotificationTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string }>> {
  if (!id) return { ok: false, error: 'A notification id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const ok = await deleteNotification(g.ctx.projectId, g.ctx.userId, id);
    if (!ok) return { ok: false, error: 'Notification not found.' };
    return { ok: true, data: { id } };
  } catch (e) {
    return fail(e, 'Failed to delete notification.');
  }
}
