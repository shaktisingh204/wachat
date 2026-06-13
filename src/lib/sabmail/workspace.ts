import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession } from '@/lib/server-cache';
import type { Project } from '@/lib/definitions';

/**
 * SabMail active-project resolution — mirrors `src/lib/sabsms/workspace.ts`.
 *
 * SabMail scopes ALL of its data (accounts, messages, threads, contacts,
 * campaigns, domains, …) server-side by `workspaceId`, so the selected
 * project must be readable on the server. A dedicated httpOnly cookie is the
 * single source of truth — SabMail-specific (NOT the shared `activeProjectId`
 * and NOT `sabsms_project`) so switching the mail project never clobbers the
 * active CRM / SMS / WaChat project and vice-versa.
 *
 * The project `_id` string IS the `workspaceId` every SabMail collection and
 * the future Rust engine key on — an opaque tenant key, isolating data with
 * no schema change.
 */
export const SABMAIL_PROJECT_COOKIE = 'sabmail_project';

const loadActiveSabmailProject = cache(
  async (): Promise<WithId<Project> | null> => {
    const session = await getCachedSession();
    const userIdRaw = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!userIdRaw || !ObjectId.isValid(String(userIdRaw))) return null;

    const cookieStore = await cookies();
    const projectId = cookieStore.get(SABMAIL_PROJECT_COOKIE)?.value;
    if (!projectId || !ObjectId.isValid(projectId)) return null;

    const userId = new ObjectId(String(userIdRaw));
    const { db } = await connectToDatabase();
    // Untyped collection: the `agents.userId` dot-path filter isn't expressible
    // in the strict `Filter<Project>` type (matches the rbac-server pattern).
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      kind: 'mail',
      $or: [{ userId }, { 'agents.userId': userId }],
    });
    return (project as WithId<Project> | null) ?? null;
  },
);

/**
 * The active SabMail project document (validated + membership-checked), or
 * `null`. Used by the layout gate + shell header.
 */
export async function getActiveSabmailProject(): Promise<WithId<Project> | null> {
  return loadActiveSabmailProject();
}

/**
 * The active SabMail `workspaceId` (= the selected project `_id` string), or
 * `null` when no valid mail project is selected.
 */
export async function getSabmailWorkspaceId(): Promise<string | null> {
  const project = await loadActiveSabmailProject();
  return project ? String(project._id) : null;
}
