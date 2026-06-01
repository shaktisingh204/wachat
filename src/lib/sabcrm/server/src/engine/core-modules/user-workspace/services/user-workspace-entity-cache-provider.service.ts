import "server-only";

// PORT-NOTE: NestJS @CoreEntityCache decorator and CoreEntityCacheProvider base
// class replaced with a plain async function. The caching layer (Redis) is not
// reproduced here — callers may wrap the result in their own cache. TypeORM
// repository replaced with Mongo collection.

import { getUserWorkspaceCollection } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.entity";
import { fromUserWorkspaceEntityToFlat } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/utils/from-user-workspace-entity-to-flat.util";
import { type FlatUserWorkspace } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/types/flat-user-workspace.type";

export async function computeUserWorkspaceForCache(
  entityId: string,
): Promise<FlatUserWorkspace | null> {
  const col = await getUserWorkspaceCollection();
  const entity = await col.findOne({ _id: entityId } as Parameters<typeof col.findOne>[0]);

  if (entity === null) {
    return null;
  }

  return fromUserWorkspaceEntityToFlat(entity);
}
