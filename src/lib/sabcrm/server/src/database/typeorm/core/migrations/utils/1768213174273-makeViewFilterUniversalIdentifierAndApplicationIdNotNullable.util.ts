// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeViewFilterUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.viewFilter) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_d5651cf33fa56a47cd262a3fb2c" on viewFilter.applicationId
//   - DROP INDEX "IDX_cd4588bfc9ad73345b3953a039"
//   - ALTER viewFilter.universalIdentifier SET NOT NULL
//   - ALTER viewFilter.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_cd4588bfc9ad73345b3953a039" ON viewFilter (workspaceId, universalIdentifier)
//   - ADD FK viewFilter.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_viewfilter

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the viewFilter uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureViewFilterIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_viewfilter");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_viewFilter_workspaceId_universalIdentifier" }
  );
}
