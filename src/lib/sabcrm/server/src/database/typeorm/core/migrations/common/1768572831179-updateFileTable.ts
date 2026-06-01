// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration UpdateFileTable1768572831179
//
// What this migration did in Postgres (core schema):
//   UP (via util helper with savepoint):
//     - DROP COLUMN name, fullPath, type from core."file"
//     - ADD COLUMN applicationId uuid (nullable)
//     - ADD COLUMN path varchar NOT NULL
//     - ADD COLUMN updatedAt timestamptz NOT NULL DEFAULT now()
//     - ADD COLUMN deletedAt timestamptz (nullable)
//     - ADD COLUMN isStaticAsset boolean NOT NULL DEFAULT false
//     - ADD FK: file.applicationId -> application.id ON DELETE CASCADE
//   DOWN:
//     - Reverts: drops new columns, adds back name/fullPath/type, drops FK.
//
// Mongo equivalent:
//   The sabcrm_file collection document type should be updated to reflect the new schema.
//   Old fields (name, fullPath, type) are removed; new fields are added.
//   No Mongo index is needed for these changes (applicationId FK is represented as a plain field).
//
// Updated sabcrm_file document shape:
//   { _id, workspaceId, applicationId?, path, updatedAt, deletedAt?, isStaticAsset, createdAt }

export const MIGRATION_NAME = 'UpdateFileTable1768572831179';

export type SabCrmFileDocumentV2 = {
  _id: string;
  workspaceId: string;
  applicationId?: string;
  path: string;
  updatedAt: Date;
  deletedAt?: Date;
  isStaticAsset: boolean;
  createdAt: Date;
};
