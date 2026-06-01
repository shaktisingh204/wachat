// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeObjectMetadataUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.objectMetadata) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_71a7af5a5c916f0b96f358f25f7" on objectMetadata.applicationId
//   - DROP INDEX "IDX_3a00d35710f4227ded320fd96d"
//   - ALTER objectMetadata.universalIdentifier SET NOT NULL
//   - ALTER objectMetadata.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_3a00d35710f4227ded320fd96d" ON objectMetadata (workspaceId, universalIdentifier)
//   - ADD FK objectMetadata.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_objectmetadata
//   - universalIdentifier and applicationId must be validated as required at write time

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the objectMetadata uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureObjectMetadataIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_objectmetadata");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_objectMetadata_workspaceId_universalIdentifier" }
  );
}
