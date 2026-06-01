import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { type FlatWorkspaceMember } from "@/lib/sabcrm/server/src/engine/core-modules/user/types/flat-workspace-member.type";
import { type FlatWorkspaceMemberMaps } from "@/lib/sabcrm/server/src/engine/core-modules/user/types/flat-workspace-member-maps.type";

// PORT-NOTE: Original extended WorkspaceCacheProvider<FlatWorkspaceMemberMaps>
// with NestJS DI + @WorkspaceCache decorator. Ported as a plain async function
// that fetches all workspace members (including soft-deleted) for a workspace.

const localCache = new Map<string, FlatWorkspaceMemberMaps>();

export async function computeFlatWorkspaceMemberMapsForCache(
  workspaceId: string
): Promise<FlatWorkspaceMemberMaps> {
  const { db } = await connectToDatabase();

  // Workspace-member documents are stored per-workspace in a namespaced collection.
  const collectionName = `sabcrm_workspace_member_${workspaceId}`;
  const members = await db
    .collection<FlatWorkspaceMember>(collectionName)
    .find({})
    .toArray();

  const flatWorkspaceMemberMaps: FlatWorkspaceMemberMaps = {
    byId: {},
    idByUserId: {},
  };

  for (const member of members) {
    flatWorkspaceMemberMaps.byId[member.id] = member;
    flatWorkspaceMemberMaps.idByUserId[member.userId] = member.id;
  }

  return flatWorkspaceMemberMaps;
}

export async function getCachedFlatWorkspaceMemberMaps(
  workspaceId: string
): Promise<FlatWorkspaceMemberMaps> {
  if (localCache.has(workspaceId)) {
    return localCache.get(workspaceId)!;
  }

  const maps = await computeFlatWorkspaceMemberMapsForCache(workspaceId);
  localCache.set(workspaceId, maps);

  return maps;
}

export function invalidateFlatWorkspaceMemberMapsCache(
  workspaceId: string
): void {
  localCache.delete(workspaceId);
}
