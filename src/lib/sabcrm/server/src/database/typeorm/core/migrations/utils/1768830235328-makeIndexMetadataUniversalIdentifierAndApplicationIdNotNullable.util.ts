// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeIndexMetadataUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.indexMetadata) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_056363e1599f5b9a0e33323d9da" on indexMetadata.applicationId
//   - DROP INDEX "IDX_b27c681286ac581f81498c5d4b"
//   - ALTER indexMetadata.universalIdentifier SET NOT NULL
//   - ALTER indexMetadata.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_b27c681286ac581f81498c5d4b" ON indexMetadata (workspaceId, universalIdentifier)
//   - ADD FK indexMetadata.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_indexmetadata

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the indexMetadata uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureIndexMetadataIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_indexmetadata");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_indexMetadata_workspaceId_universalIdentifier" }
  );
}
