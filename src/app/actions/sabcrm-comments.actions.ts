'use server';

/**
 * SabCRM — threaded comments + @mentions server actions.
 *
 * Thin gated wrappers over `@/lib/sabcrm/comments.server`. The `gate` / `fail`
 * helpers are copied verbatim from `sabcrm-scoring.actions.ts` (session →
 * project membership → RBAC `canServer('sabcrm', …)` → plan), including the
 * cross-tenant defense against a client-supplied `projectId`.
 *
 *   listCommentsTw   — read a record's thread (gated `view`).
 *   addCommentTw     — post a comment / reply, fans out mention notifications
 *                      (gated `edit` — collaboration is a write).
 *   deleteCommentTw  — delete own comment (+ cascade replies on a root)
 *                      (gated `edit`; authorship enforced in the runtime).
 *
 * Every `RustApiError` / thrown value is normalised into `{ ok: false, error }`
 * so the panel degrades gracefully when the engine / DB is unreachable.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  listComments,
  addComment,
  deleteComment,
  type AddCommentInput,
  type AddCommentResult,
  type CommentThread,
} from '@/lib/sabcrm/comments.server';

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
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** List a record's comment thread (nested) + member roster. Gated on `view`. */
export async function listCommentsTw(
  object: string,
  recordId: string,
  projectId?: string,
): Promise<ActionResult<CommentThread>> {
  if (!object || !recordId) {
    return { ok: false, error: 'A target record is required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await listComments(g.ctx.projectId, object, recordId),
    };
  } catch (e) {
    return fail(e, 'Failed to load comments.');
  }
}

/**
 * Post a comment (root or reply) on a record. Resolves + snapshots mentions and
 * fans out mention notifications to the inbox. Gated on `edit` (collaboration
 * is a write to the record's activity surface).
 */
export async function addCommentTw(
  input: AddCommentInput,
  projectId?: string,
): Promise<ActionResult<AddCommentResult>> {
  if (!input?.object || !input?.recordId) {
    return { ok: false, error: 'A target record is required.' };
  }
  if (!input.body?.trim()) {
    return { ok: false, error: 'A comment cannot be empty.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    return {
      ok: true,
      data: await addComment(g.ctx.projectId, g.ctx.userId, input),
    };
  } catch (e) {
    return fail(e, 'Failed to post comment.');
  }
}

/**
 * Delete the caller's own comment (cascading replies when it is a root).
 * Gated on `edit`; the runtime additionally enforces authorship, so deleting
 * someone else's comment is a no-op that reports "not found".
 */
export async function deleteCommentTw(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ id: string; removed: number }>> {
  if (!id) return { ok: false, error: 'A comment id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const removed = await deleteComment(g.ctx.projectId, g.ctx.userId, id);
    if (removed === 0) {
      return { ok: false, error: 'Comment not found or not yours to delete.' };
    }
    return { ok: true, data: { id, removed } };
  } catch (e) {
    return fail(e, 'Failed to delete comment.');
  }
}
