// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddSearchFieldMetadataEntity1757806282417
// Postgres:
//   - CREATE TABLE "core"."searchFieldMetadata" with columns
//     objectMetadataId, fieldMetadataId, workspaceId and a UNIQUE constraint
//     on (objectMetadataId, fieldMetadataId).
//   - FK to objectMetadata and fieldMetadata (CASCADE delete).
//
// In MongoDB: create sabcrm_searchfieldmetadata with the equivalent indexes.

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db.collection('sabcrm_searchfieldmetadata').createIndexes([
    {
      key: { objectMetadataId: 1, fieldMetadataId: 1 },
      unique: true,
      name: 'IDX_SEARCH_FIELD_METADATA_OBJECT_FIELD_UNIQUE',
    },
    {
      key: { objectMetadataId: 1 },
      name: 'IDX_SEARCH_FIELD_METADATA_OBJECT_METADATA_ID',
    },
    {
      key: { workspaceId: 1 },
      name: 'IDX_SEARCH_FIELD_METADATA_WORKSPACE_ID',
    },
  ]);
};

export const down = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db.collection('sabcrm_searchfieldmetadata').dropIndexes();
};

export const migrationName = 'AddSearchFieldMetadataEntity1757806282417';
