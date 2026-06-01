// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeViewFieldUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.viewField) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_b560ea62a958deff0c6059caa45" on viewField.applicationId
//   - DROP INDEX "IDX_b86af4ea24cae518dee8eae996"
//   - ALTER viewField.universalIdentifier SET NOT NULL
//   - ALTER viewField.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_b86af4ea24cae518dee8eae996" ON viewField (workspaceId, universalIdentifier)
//   - ADD FK viewField.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_viewfield

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the viewField uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureViewFieldIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_viewfield");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_viewField_workspaceId_universalIdentifier" }
  );
}
