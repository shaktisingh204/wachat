// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: make-permission-flag-universal-identifier-and-application-id-not-null
// PostgreSQL DDL (ALTER TABLE core.permissionFlag) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - ALTER permissionFlag.universalIdentifier SET NOT NULL
//   - ALTER permissionFlag.applicationId SET NOT NULL
//   - DROP INDEX IF EXISTS "IDX_da8ffd3c24b4a819430a861067"
//   - CREATE UNIQUE INDEX "IDX_da8ffd3c24b4a819430a861067" ON permissionFlag (workspaceId, universalIdentifier)
//   - DROP FK IF EXISTS "FK_b26a9d39a88d0e72373c677c6c5"
//   - ADD FK permissionFlag.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_permissionflag

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the permissionFlag uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensurePermissionFlagIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_permissionflag");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_permissionFlag_workspaceId_universalIdentifier" }
  );
}
