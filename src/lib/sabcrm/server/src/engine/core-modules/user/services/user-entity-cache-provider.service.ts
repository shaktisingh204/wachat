import "server-only";

import { type FlatUser } from "@/lib/sabcrm/server/src/engine/core-modules/user/types/flat-user.type";
import { fromUserEntityToFlat } from "@/lib/sabcrm/server/src/engine/core-modules/user/utils/from-user-entity-to-flat.util";
import { getUserCollection } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.entity";

// PORT-NOTE: Original extended CoreEntityCacheProvider<FlatUser> with NestJS DI.
// Ported as a plain async function that fetches and caches a FlatUser by id.
// Callers that need cache invalidation should use SabNode's in-process cache layer.

const localCache = new Map<string, FlatUser>();

export async function computeUserForCache(
  entityId: string
): Promise<FlatUser | null> {
  const collection = await getUserCollection();
  const entity = await collection.findOne({ id: entityId, deletedAt: null });

  if (!entity) {
    return null;
  }

  return fromUserEntityToFlat(entity);
}

export async function getCachedUser(entityId: string): Promise<FlatUser | null> {
  if (localCache.has(entityId)) {
    return localCache.get(entityId) ?? null;
  }

  const flat = await computeUserForCache(entityId);

  if (flat) {
    localCache.set(entityId, flat);
  }

  return flat;
}

export function invalidateCachedUser(entityId: string): void {
  localCache.delete(entityId);
}
