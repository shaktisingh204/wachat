// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddNavigationMenuItemEntity1768807499350
//
// What this migration did in Postgres (core schema):
//   UP:
//     - CREATE TABLE core."navigationMenuItem" with columns:
//         workspaceId uuid NOT NULL
//         universalIdentifier uuid NOT NULL
//         applicationId uuid NOT NULL
//         id uuid PK DEFAULT uuid_generate_v4()
//         userWorkspaceId uuid (nullable)
//         targetRecordId uuid (nullable)
//         targetObjectMetadataId uuid (nullable)
//         viewId uuid (nullable)
//         name text (nullable)
//         folderId uuid (nullable, self-ref FK)
//         position integer NOT NULL
//         createdAt timestamptz NOT NULL DEFAULT now()
//         updatedAt timestamptz NOT NULL DEFAULT now()
//     - CHECK: (targetRecordId IS NULL AND targetObjectMetadataId IS NULL)
//              OR (targetRecordId IS NOT NULL AND targetObjectMetadataId IS NOT NULL)
//     - UNIQUE INDEX on (workspaceId, universalIdentifier)
//     - Indexes: (viewId, workspaceId), (folderId, workspaceId),
//                (targetRecordId, targetObjectMetadataId, workspaceId),
//                (userWorkspaceId, workspaceId)
//     - FKs: workspaceId->workspace, applicationId->application, userWorkspaceId->userWorkspace,
//            targetObjectMetadataId->objectMetadata, folderId->navigationMenuItem (self-ref, DEFERRABLE)
//   DOWN: Drops FKs, indexes, and table.
//
// Mongo equivalent:
//   A new collection sabcrm_navigationMenuItem is needed.
//   Self-referential folderId is a plain string field (no DB-level FK, enforced in app logic).
//   The CHECK constraint on targetRecordId/targetObjectMetadataId is enforced in app logic.

export const MIGRATION_NAME = 'AddNavigationMenuItemEntity1768807499350';

export type SabCrmNavigationMenuItemDocument = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  applicationId: string;
  userWorkspaceId?: string;
  targetRecordId?: string;
  targetObjectMetadataId?: string;
  viewId?: string;
  name?: string;
  folderId?: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
};

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_navigationMenuItem',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true },
  },
  {
    collection: 'sabcrm_navigationMenuItem',
    index: { viewId: 1, workspaceId: 1 },
    options: {},
  },
  {
    collection: 'sabcrm_navigationMenuItem',
    index: { folderId: 1, workspaceId: 1 },
    options: {},
  },
  {
    collection: 'sabcrm_navigationMenuItem',
    index: { targetRecordId: 1, targetObjectMetadataId: 1, workspaceId: 1 },
    options: {},
  },
  {
    collection: 'sabcrm_navigationMenuItem',
    index: { userWorkspaceId: 1, workspaceId: 1 },
    options: {},
  },
] as const;
