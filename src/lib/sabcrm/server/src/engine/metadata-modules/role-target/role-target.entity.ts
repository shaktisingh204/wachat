import "server-only";

// PORT-NOTE: Stub for twenty-server RoleTargetEntity (TypeORM/Postgres).
// Full port deferred to the role-target batch.
// Collection name: sabcrm_role_target
// This stub provides the collection accessor used by ai-agent-role.service.ts.

import type { Collection, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

export type RoleTargetDocument = {
  _id: ObjectId;
  id: string;
  workspaceId: string;
  roleId: string;
  agentId: string | null;
  userWorkspaceId: string | null;
  apiKeyId: string | null;
  [key: string]: unknown;
};

let _collection: Collection<RoleTargetDocument> | null = null;

export async function getRoleTargetCollection(): Promise<
  Collection<RoleTargetDocument>
> {
  if (_collection) return _collection;

  const { db } = await connectToDatabase();
  _collection = db.collection<RoleTargetDocument>("sabcrm_role_target");

  await _collection.createIndex({ workspaceId: 1 });
  await _collection.createIndex({ roleId: 1, workspaceId: 1 });
  await _collection.createIndex({ agentId: 1, workspaceId: 1 });

  return _collection;
}
