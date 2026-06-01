import 'server-only';

import { type Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

// PORT-NOTE: Ported from TypeORM DataSourceEntity (Postgres).
// @deprecated — This entity is kept only for historical completeness.
// The original comment says: all code should use workspace.databaseSchema instead.
// In SabNode, workspace configuration lives in the workspaces Mongo collection.
//
// Mongo collection name: sabcrm_data_source
// Postgres index IDX_DATA_SOURCE_WORKSPACE_ID_CREATED_AT → compound Mongo index on [workspaceId, createdAt]

export type DataSourceType = 'postgres' | 'mongo' | string;

export type DataSourceDocument = {
  /** Application-level UUID (mirrors the Postgres id column) */
  id: string;
  label: string | null;
  url: string | null;
  schema: string | null;
  /** Default: 'postgres' in the original; accept any string in Mongo. */
  type: DataSourceType;
  isRemote: boolean;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
};

const COLLECTION_NAME = 'sabcrm_data_source';

export async function getDataSourceCollection(): Promise<
  Collection<DataSourceDocument>
> {
  const { db } = await connectToDatabase();
  return db.collection<DataSourceDocument>(COLLECTION_NAME);
}

export async function ensureDataSourceIndexes(): Promise<void> {
  const col = await getDataSourceCollection();
  await col.createIndex(
    { workspaceId: 1, createdAt: 1 },
    { name: 'IDX_DATA_SOURCE_WORKSPACE_ID_CREATED_AT' },
  );
  await col.createIndex({ id: 1 }, { unique: true });
}
