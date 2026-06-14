import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession } from '@/lib/server-cache';
import type { Project } from '@/lib/definitions';

/**
 * SabHRM active-project resolution.
 *
 * SabHRM scopes ALL of its data (employees, attendance, leave, payroll,
 * performance, …) server-side by `workspaceId`, so the selected project must
 * be readable on the server. A dedicated httpOnly cookie is the single source
 * of truth — SabHRM-specific (NOT the shared `activeProjectId`) so switching
 * the HR organization never clobbers the active CRM / SMS / WaChat project.
 *
 * The project `_id` string IS the `workspaceId` every SabHRM collection keys
 * on — an opaque tenant key isolating each organization with no schema change.
 */
export const SABHRM_PROJECT_COOKIE = 'sabhrm_project';

const loadActiveSabHrmProject = cache(
  async (): Promise<WithId<Project> | null> => {
    const session = await getCachedSession();
    const userIdRaw = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!userIdRaw || !ObjectId.isValid(String(userIdRaw))) return null;

    const cookieStore = await cookies();
    const projectId = cookieStore.get(SABHRM_PROJECT_COOKIE)?.value;
    if (!projectId || !ObjectId.isValid(projectId)) return null;

    const userId = new ObjectId(String(userIdRaw));
    const { db } = await connectToDatabase();
    // Untyped collection: the `agents.userId` dot-path filter isn't expressible
    // in the strict `Filter<Project>` type (matches the rbac-server pattern).
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      kind: 'hrm',
      $or: [{ userId }, { 'agents.userId': userId }],
    });
    return (project as WithId<Project> | null) ?? null;
  },
);

/** The active SabHRM project document (validated + membership-checked), or null. */
export async function getActiveSabHrmProject(): Promise<WithId<Project> | null> {
  return loadActiveSabHrmProject();
}

/** The active SabHRM `workspaceId` (= selected project `_id` string), or null. */
export async function getSabHrmWorkspaceId(): Promise<string | null> {
  const project = await loadActiveSabHrmProject();
  return project ? String(project._id) : null;
}
