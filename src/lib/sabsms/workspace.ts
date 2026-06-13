import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession } from '@/lib/server-cache';
import type { Project } from '@/lib/definitions';

/**
 * SabSMS active-project resolution.
 *
 * Unlike the rest of the app — where the "active project" lives only in
 * the browser's localStorage (see `src/context/project-context.tsx`) and
 * therefore can't be read by server components — SabSMS scopes ALL of its
 * data (campaigns, contacts, numbers, templates, stats, …) server-side by
 * `workspaceId`. So the selected project has to be readable on the server.
 *
 * We use a dedicated httpOnly cookie as the single source of truth. It is
 * SabSMS-specific (NOT the shared `activeProjectId`) so switching the SMS
 * project never clobbers the active CRM / WaChat project and vice-versa.
 *
 * The project `_id` string IS the `workspaceId` every SabSMS collection and
 * the Rust engine key on — the engine treats it as an opaque tenant key,
 * so pointing it at a project id (instead of the user id we used before
 * projects existed) isolates data with no engine/schema change.
 */
export const SABSMS_PROJECT_COOKIE = 'sabsms_project';

/**
 * Validate + load the SMS project named by the cookie for the current
 * session. Returns `null` when there is no cookie, the project is gone,
 * it is not a `kind:'sms'` project, or the user neither owns nor is a
 * member of it. Direct Mongo (not the Rust `getProjectById`) so it stays
 * consistent with how SabSMS projects are created + how every SabSMS
 * collection is queried.
 */
const loadActiveSabsmsProject = cache(
  async (): Promise<WithId<Project> | null> => {
    const session = await getCachedSession();
    const userIdRaw = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!userIdRaw || !ObjectId.isValid(String(userIdRaw))) return null;

    const cookieStore = await cookies();
    const projectId = cookieStore.get(SABSMS_PROJECT_COOKIE)?.value;
    if (!projectId || !ObjectId.isValid(projectId)) return null;

    const userId = new ObjectId(String(userIdRaw));
    const { db } = await connectToDatabase();
    // Untyped collection: the `agents.userId` dot-path filter isn't expressible
    // in the strict `Filter<Project>` type (matches the rbac-server pattern).
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      kind: 'sms',
      $or: [{ userId }, { 'agents.userId': userId }],
    });
    return (project as WithId<Project> | null) ?? null;
  },
);

/**
 * The active SabSMS project document (validated + membership-checked), or
 * `null`. Used by the layout gate + shell header.
 */
export async function getActiveSabsmsProject(): Promise<WithId<Project> | null> {
  return loadActiveSabsmsProject();
}

/**
 * The active SabSMS `workspaceId` (= the selected project `_id` string), or
 * `null` when no valid SMS project is selected. This replaces the old
 * `String(session.user._id)` derivation across the module so all data is
 * scoped per project.
 */
export async function getSabsmsWorkspaceId(): Promise<string | null> {
  const project = await loadActiveSabsmsProject();
  return project ? String(project._id) : null;
}
