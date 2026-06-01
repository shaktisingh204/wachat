// PORT-NOTE: pg-migration->mongo-index/seed
// Original: UniqueFieldMetadataNameForWorkspaceObjectMetadata1756976545860
// Postgres: ALTER TABLE "core"."fieldMetadata"
//           ADD CONSTRAINT "IDX_FIELD_METADATA_NAME_OBJECT_METADATA_ID_WORKSPACE_ID_UNIQUE"
//           UNIQUE ("name", "objectMetadataId", "workspaceId")
//
// In MongoDB: create a compound unique index on (name, objectMetadataId, workspaceId).

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db.collection('sabcrm_fieldmetadata').createIndex(
    { name: 1, objectMetadataId: 1, workspaceId: 1 },
    {
      unique: true,
      name: 'IDX_FIELD_METADATA_NAME_OBJECT_METADATA_ID_WORKSPACE_ID_UNIQUE',
    },
  );
};

export const down = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db
    .collection('sabcrm_fieldmetadata')
    .dropIndex('IDX_FIELD_METADATA_NAME_OBJECT_METADATA_ID_WORKSPACE_ID_UNIQUE');
};

export const migrationName =
  'UniqueFieldMetadataNameForWorkspaceObjectMetadata1756976545860';
