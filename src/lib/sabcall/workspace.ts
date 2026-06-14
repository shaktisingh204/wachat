import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession } from '@/lib/server-cache';
import type { Project } from '@/lib/definitions';

/**
 * SabCall active-project resolution.
 *
 * SabCall is a top-level, project-gated suite app (mirrors SabSMS). All of
 * its data — DIDs, calls/CDRs, IVRs, queues, voicemail, agent presence — is
 * scoped server-side by `workspaceId`, so the selected project must be
 * readable on the server. We use a dedicated httpOnly cookie as the single
 * source of truth (NOT the shared client `activeProjectId`) so switching the
 * SabCall project never clobbers the active CRM / WaChat / SabSMS project.
 *
 * The project `_id` string IS the `workspaceId` every SabCall collection and
 * the future Rust `sabcall-*` engine scopes by (sent as the JWT `tid` claim).
 */
export const SABCALL_PROJECT_COOKIE = 'sabcall_project';

/**
 * Validate + load the SabCall project named by the cookie for the current
 * session. Returns `null` when there is no cookie, the project is gone, it is
 * not a `kind:'call'` project, or the user neither owns nor is a member of it.
 * Direct Mongo (not the Rust `getProjectById`) so it stays consistent with how
 * SabCall projects are created + how every SabCall collection is queried.
 */
const loadActiveSabcallProject = cache(
  async (): Promise<WithId<Project> | null> => {
    const session = await getCachedSession();
    const userIdRaw = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!userIdRaw || !ObjectId.isValid(String(userIdRaw))) return null;

    const cookieStore = await cookies();
    const projectId = cookieStore.get(SABCALL_PROJECT_COOKIE)?.value;
    if (!projectId || !ObjectId.isValid(projectId)) return null;

    const userId = new ObjectId(String(userIdRaw));
    const { db } = await connectToDatabase();
    // Untyped collection: the `agents.userId` dot-path filter isn't expressible
    // in the strict `Filter<Project>` type (matches the rbac-server pattern).
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      kind: 'call',
      $or: [{ userId }, { 'agents.userId': userId }],
    });
    return (project as WithId<Project> | null) ?? null;
  },
);

/**
 * The active SabCall project document (validated + membership-checked), or
 * `null`. Used by the layout gate + shell header.
 */
export async function getActiveSabcallProject(): Promise<WithId<Project> | null> {
  return loadActiveSabcallProject();
}

/**
 * The active SabCall `workspaceId` (= the selected project `_id` string), or
 * `null` when no valid SabCall project is selected. This replaces the old
 * `String(session.user._id)` derivation across the module so all data is
 * scoped per project.
 */
export async function getSabcallWorkspaceId(): Promise<string | null> {
  const project = await loadActiveSabcallProject();
  return project ? String(project._id) : null;
}
