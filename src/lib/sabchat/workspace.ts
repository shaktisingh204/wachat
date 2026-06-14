import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession } from '@/lib/server-cache';
import type { Project } from '@/lib/definitions';

/**
 * SabChat active-project resolution.
 *
 * SabChat scopes ALL of its data (conversations, contacts, inboxes, widget
 * config, …) server-side by `workspaceId`, where `workspaceId` is the
 * selected project `_id` string. The Rust `sabchat-*` engine treats it as an
 * opaque tenant key — it is sent as the JWT `tid` claim (see
 * `runWithRustTenant` in `src/lib/rust-client/fetcher.ts`) and every crate
 * filters by `tenantId == ObjectId(auth.tenant_id)`.
 *
 * The selected project therefore has to be readable on the server. We use a
 * dedicated httpOnly cookie as the single source of truth — SabChat-specific
 * (NOT the shared `activeProjectId`) so switching the chat project never
 * clobbers the active CRM / SMS / Mail project and vice-versa.
 */
export const SABCHAT_PROJECT_COOKIE = 'sabchat_project';

/**
 * Validate + load the chat project named by the cookie for the current
 * session. Returns `null` when there is no cookie, the project is gone, it is
 * not a `kind:'chat'` project, or the user neither owns nor is an agent of
 * it. Direct Mongo (not the Rust `getProjectById`) so it stays consistent
 * with how SabChat projects are created.
 */
const loadActiveSabchatProject = cache(
  async (): Promise<WithId<Project> | null> => {
    const session = await getCachedSession();
    const userIdRaw = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!userIdRaw || !ObjectId.isValid(String(userIdRaw))) return null;

    const cookieStore = await cookies();
    const projectId = cookieStore.get(SABCHAT_PROJECT_COOKIE)?.value;
    if (!projectId || !ObjectId.isValid(projectId)) return null;

    const userId = new ObjectId(String(userIdRaw));
    const { db } = await connectToDatabase();
    // Untyped collection: the `agents.userId` dot-path filter isn't
    // expressible in the strict `Filter<Project>` type (rbac-server pattern).
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      kind: 'chat',
      $or: [{ userId }, { 'agents.userId': userId }],
    });
    return (project as WithId<Project> | null) ?? null;
  },
);

/**
 * The active SabChat project document (validated + membership-checked), or
 * `null`. Used by the layout gate + shell header.
 */
export async function getActiveSabchatProject(): Promise<WithId<Project> | null> {
  return loadActiveSabchatProject();
}

/**
 * The active SabChat `workspaceId` (= the selected project `_id` string), or
 * `null` when no valid chat project is selected. This is the tenant key every
 * SabChat server action passes to `runWithRustTenant` before calling Rust.
 */
export async function getSabchatWorkspaceId(): Promise<string | null> {
  const project = await loadActiveSabchatProject();
  return project ? String(project._id) : null;
}
