import 'server-only';

import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedSession } from '@/lib/server-cache';
import { getActiveSabHrmProject } from './workspace';

/**
 * Shared SabHRM server gate.
 *
 * Every SabHRM server action runs this first. Access control = "you must own
 * or be a member of the active `kind:'hrm'` project" — that membership is
 * validated inside {@link getActiveSabHrmProject}. All data is then scoped by
 * the returned `workspaceId` (the project `_id` string).
 *
 * (Fine-grained per-action RBAC keys can be layered later; for now workspace
 * membership is the access boundary, consistent with how SabHRM projects are
 * created + how every SabHRM collection is queried.)
 */
export interface SabHrmContext {
  userId: string;
  workspaceId: string;
  db: Db;
}

export type GateResult =
  | { ok: true; ctx: SabHrmContext }
  | { ok: false; error: string };

export async function gate(): Promise<GateResult> {
  const session = await getCachedSession();
  const rawId = (session?.user as { _id?: unknown } | undefined)?._id;
  if (!rawId || !ObjectId.isValid(String(rawId))) {
    return { ok: false, error: 'Not authenticated.' };
  }
  const project = await getActiveSabHrmProject();
  if (!project) {
    return { ok: false, error: 'No SabHRM organization selected.' };
  }
  const { db } = await connectToDatabase();
  return {
    ok: true,
    ctx: { userId: String(rawId), workspaceId: String(project._id), db },
  };
}

/** Convenience: throw-free helper returning just the workspace filter base. */
export function scoped(workspaceId: string): { workspaceId: string } {
  return { workspaceId };
}
