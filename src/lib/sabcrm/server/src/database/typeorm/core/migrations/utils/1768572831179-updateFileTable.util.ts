// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: updateFileTable
// This migration restructures the core.file table in Postgres:
//   - DROP COLUMN name, fullPath, type
//   - ADD COLUMN applicationId (uuid, nullable)
//   - ADD COLUMN path (varchar NOT NULL)
//   - ADD COLUMN updatedAt (TIMESTAMPTZ NOT NULL DEFAULT now())
//   - ADD COLUMN deletedAt (TIMESTAMPTZ nullable)
//   - ADD COLUMN isStaticAsset (boolean NOT NULL DEFAULT false)
//   - ADD FK applicationId -> application(id) ON DELETE RESTRICT
//
// In MongoDB the schema is schemaless; the sabcrm_file collection should:
//   - No longer store `name`, `fullPath`, or `type` fields on new documents
//   - Store `path` (string, required), `applicationId` (string, optional ref),
//     `updatedAt` (Date), `deletedAt` (Date|null), `isStaticAsset` (boolean, default false)
//
// This utility documents the intended shape change and creates a partial index
// on non-deleted files for efficient queries.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures indexes on sabcrm_file reflecting the schema update (updateFileTable migration).
 * Indexes support efficient lookup of active (non-deleted) file records by path and applicationId.
 */
export async function ensureFileTableIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_file");

  // Partial index on non-deleted files
  await col.createIndex(
    { path: 1 },
    {
      sparse: true,
      partialFilterExpression: { deletedAt: null },
      name: "IDX_file_path_not_deleted",
    }
  );

  await col.createIndex(
    { applicationId: 1 },
    { sparse: true, name: "IDX_file_applicationId" }
  );
}
