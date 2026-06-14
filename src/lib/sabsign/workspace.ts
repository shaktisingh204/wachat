import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession } from '@/lib/server-cache';
import type { Project } from '@/lib/definitions';

/**
 * SabSign active-project resolution.
 *
 * SabSign scopes ALL of its data (envelopes, templates, audit events) by the
 * selected project's `_id`, which becomes the Rust JWT `tid` (tenant) claim
 * via {@link runWithRustTenant}. The selected project must therefore be
 * readable on the server, so we keep it in a dedicated httpOnly cookie —
 * SabSign-specific (NOT the shared `activeProjectId`) so switching the
 * signing project never clobbers the active CRM / WaChat / SMS project.
 *
 * A SabSign "project" is a `kind:'sign'` row in the shared `projects`
 * collection (same model SabSMS uses — see `createSabsignProject`).
 *
 * When no SabSign project is selected, {@link getSabsignWorkspaceId} returns
 * `null`; callers then fall back to the default per-user Rust scoping
 * (`tid = userId`), which keeps the module usable before the project gate is
 * adopted.
 */
export const SABSIGN_PROJECT_COOKIE = 'sabsign_project';

const loadActiveSabsignProject = cache(
  async (): Promise<WithId<Project> | null> => {
    const session = await getCachedSession();
    const userIdRaw = (session?.user as { _id?: unknown } | undefined)?._id;
    if (!userIdRaw || !ObjectId.isValid(String(userIdRaw))) return null;

    const cookieStore = await cookies();
    const projectId = cookieStore.get(SABSIGN_PROJECT_COOKIE)?.value;
    if (!projectId || !ObjectId.isValid(projectId)) return null;

    const userId = new ObjectId(String(userIdRaw));
    const { db } = await connectToDatabase();
    // Untyped collection: the `agents.userId` dot-path filter isn't expressible
    // in the strict `Filter<Project>` type (matches the rbac-server pattern).
    const project = await db.collection('projects').findOne({
      _id: new ObjectId(projectId),
      kind: 'sign',
      $or: [{ userId }, { 'agents.userId': userId }],
    });
    return (project as WithId<Project> | null) ?? null;
  },
);

/** The active SabSign project document (validated + membership-checked), or `null`. */
export async function getActiveSabsignProject(): Promise<WithId<Project> | null> {
  return loadActiveSabsignProject();
}

/**
 * The active SabSign `workspaceId` (= the selected project `_id` string), or
 * `null` when no valid signing project is selected.
 */
export async function getSabsignWorkspaceId(): Promise<string | null> {
  const project = await loadActiveSabsignProject();
  return project ? String(project._id) : null;
}
