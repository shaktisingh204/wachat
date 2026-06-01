// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeRoleUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.role) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_7f3b96f15aaf5a27549288d264b" on role.applicationId
//   - DROP INDEX "IDX_3b7ff27925c0959777682c1adc"
//   - ALTER role.universalIdentifier SET NOT NULL
//   - ALTER role.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_3b7ff27925c0959777682c1adc" ON role (workspaceId, universalIdentifier)
//   - ADD FK role.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_role

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the role uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureRoleIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_role");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_role_workspaceId_universalIdentifier" }
  );
}
