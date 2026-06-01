import "server-only";

// PORT-NOTE: Original is a NestJS @Injectable service with @CoreEntityCache decorator
// extending CoreEntityCacheProvider. Ported to a plain exported function that
// computes the flat workspace for a given entityId, backed by Mongo.
// Cache invalidation must be handled at the call site (e.g. Redis TTL or
// the SabCRM core entity cache abstraction).

import { connectToDatabase } from "@/lib/mongodb";
import type { FlatWorkspace } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/types/flat-workspace.type";
import { fromWorkspaceEntityToFlat } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/utils/from-workspace-entity-to-flat.util";

export async function computeWorkspaceForCache(
  entityId: string,
): Promise<FlatWorkspace | null> {
  const db = await connectToDatabase();
  const col = db.collection<Record<string, unknown>>("sabcrm_workspace");

  const entity = await col.findOne({ id: entityId });

  if (!entity) return null;

  return fromWorkspaceEntityToFlat(entity as Parameters<typeof fromWorkspaceEntityToFlat>[0]);
}
