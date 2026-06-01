// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeFieldMetadataUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.fieldMetadata) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer via
// schema validation. Below we document the intent and export a no-op for type-mapping completeness.
//
// Original Postgres operations:
//   - DROP FK "FK_05453a954e458e3d91f2ff5043f" on fieldMetadata.applicationId
//   - DROP INDEX "IDX_f1c88fdfc3ad8910b17fc1fd73"
//   - ALTER fieldMetadata.universalIdentifier SET NOT NULL
//   - ALTER fieldMetadata.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_f1c88fdfc3ad8910b17fc1fd73" ON fieldMetadata (workspaceId, universalIdentifier)
//   - ADD FK fieldMetadata.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_fieldmetadata
//   - universalIdentifier and applicationId must be validated as required at write time

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the fieldMetadata uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 * Call this once during app bootstrap / migration initialization.
 */
export async function ensureFieldMetadataIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_fieldmetadata");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_fieldMetadata_workspaceId_universalIdentifier" }
  );
}
