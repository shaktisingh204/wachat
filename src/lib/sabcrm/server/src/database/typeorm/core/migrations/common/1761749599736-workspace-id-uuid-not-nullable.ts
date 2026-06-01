// PORT-NOTE: pg-migration->mongo-index/seed
// Original: WorkspaceIdUuidNotNullable1761749599736
//
// This Postgres migration:
//   1. Deletes orphaned rows from "indexMetadata" where workspaceId IS NULL.
//   2. Drops then recreates a compound unique index and a plain index on
//      (workspaceId, objectMetadataId) after converting the column type from
//      character varying to uuid NOT NULL.
//
// Mongo equivalents:
//
// 1. Remove orphaned documents (no workspaceId):
//    db.sabcrm_indexmetadata.deleteMany({ workspaceId: { $exists: false } });
//    db.sabcrm_indexmetadata.deleteMany({ workspaceId: null });
//
// 2. Ensure workspaceId is stored as a string UUID and is always present.
//    MongoDB has no native uuid column type — strings are used.
//
// 3. Re-create the equivalent indexes:

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1761749599736-workspace-id-uuid-not-nullable';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_indexmetadata');

  // Step 1: remove orphaned documents
  await col.deleteMany({ workspaceId: { $exists: false } });
  await col.deleteMany({ workspaceId: null });

  // Step 2: compound unique index on (name, workspaceId, objectMetadataId)
  await col.createIndex(
    { name: 1, workspaceId: 1, objectMetadataId: 1 },
    { unique: true, name: 'IDX_INDEX_METADATA_NAME_WORKSPACE_ID_OBJECT_METADATA_ID_UNIQUE' },
  );

  // Step 3: unique index on (workspaceId, universalIdentifier)
  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, name: 'IDX_b27c681286ac581f81498c5d4b' },
  );

  // Step 4: plain index on (workspaceId, objectMetadataId)
  await col.createIndex(
    { workspaceId: 1, objectMetadataId: 1 },
    { name: 'IDX_INDEX_METADATA_WORKSPACE_ID_OBJECT_METADATA_ID' },
  );
}
