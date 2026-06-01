import "server-only";

// PORT-NOTE: Stub for twenty-server RoleEntity (TypeORM/Postgres).
// Full port deferred to the role/permissions batch.
// Collection name: sabcrm_role
// This stub provides the collection accessor used by ai-agent-role.service.ts.

import type { Collection, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

export type RoleDocument = {
  _id: ObjectId;
  id: string;
  workspaceId: string;
  label: string;
  canBeAssignedToAgents: boolean;
  canBeAssignedToUsers: boolean;
  canBeAssignedToApiKeys: boolean;
  [key: string]: unknown;
};

let _collection: Collection<RoleDocument> | null = null;

export async function getRoleCollection(): Promise<Collection<RoleDocument>> {
  if (_collection) return _collection;

  const { db } = await connectToDatabase();
  _collection = db.collection<RoleDocument>("sabcrm_role");

  await _collection.createIndex({ workspaceId: 1 });
  await _collection.createIndex({ id: 1, workspaceId: 1 }, { unique: true });

  return _collection;
}
