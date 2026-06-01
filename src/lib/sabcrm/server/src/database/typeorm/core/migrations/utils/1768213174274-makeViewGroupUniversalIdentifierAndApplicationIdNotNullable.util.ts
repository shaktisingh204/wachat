// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeViewGroupUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.viewGroup) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_5aff384532c78fa8a42ceeae282" on viewGroup.applicationId
//   - DROP INDEX "IDX_a44e3b03f0eca32d0504d5ef73"
//   - ALTER viewGroup.universalIdentifier SET NOT NULL
//   - ALTER viewGroup.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_a44e3b03f0eca32d0504d5ef73" ON viewGroup (workspaceId, universalIdentifier)
//   - ADD FK viewGroup.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_viewgroup

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the viewGroup uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureViewGroupIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_viewgroup");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_viewGroup_workspaceId_universalIdentifier" }
  );
}
