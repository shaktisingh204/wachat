// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeViewUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.view) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_348e25d584c7e51417f4e097941" on view.applicationId
//   - DROP INDEX "IDX_552aa6908966e980099b3e5ebf"
//   - ALTER view.universalIdentifier SET NOT NULL
//   - ALTER view.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_552aa6908966e980099b3e5ebf" ON view (workspaceId, universalIdentifier)
//   - ADD FK view.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_view

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the view uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureViewIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_view");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_view_workspaceId_universalIdentifier" }
  );
}
