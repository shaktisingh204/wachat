// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddCommandMenuItemEntity1768503887441
//
// What this migration did in Postgres (core schema):
//   UP:
//     - CREATE TYPE core."commandMenuItem_availabilitytype_enum" AS ENUM('GLOBAL','SINGLE_RECORD','BULK_RECORDS')
//     - CREATE TABLE core."commandMenuItem" with columns:
//         workspaceId uuid NOT NULL
//         universalIdentifier uuid NOT NULL
//         applicationId uuid NOT NULL
//         id uuid PK DEFAULT uuid_generate_v4()
//         workflowVersionId uuid NOT NULL
//         label varchar NOT NULL
//         icon varchar (nullable)
//         isPinned boolean NOT NULL DEFAULT false
//         availabilityType enum NOT NULL DEFAULT 'GLOBAL'
//         availabilityObjectMetadataId uuid (nullable)
//         createdAt timestamptz NOT NULL DEFAULT now()
//         updatedAt timestamptz NOT NULL DEFAULT now()
//     - UNIQUE INDEX on (workspaceId, universalIdentifier)
//     - INDEX on (workflowVersionId, workspaceId)
//     - FKs: workspaceId->workspace, applicationId->application, availabilityObjectMetadataId->objectMetadata (all CASCADE)
//   DOWN: Drops FKs, indexes, table, and enum type.
//
// Mongo equivalent:
//   A new collection sabcrm_commandMenuItem is needed with the document type below.
//   The enum is represented as a TypeScript union type.
//   Indexes to create at startup are listed in MONGO_INDEXES.

export const MIGRATION_NAME = 'AddCommandMenuItemEntity1768503887441';

export type CommandMenuItemAvailabilityType =
  | 'GLOBAL'
  | 'SINGLE_RECORD'
  | 'BULK_RECORDS';

export type SabCrmCommandMenuItemDocument = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  applicationId: string;
  workflowVersionId: string;
  label: string;
  icon?: string;
  isPinned: boolean;
  availabilityType: CommandMenuItemAvailabilityType;
  availabilityObjectMetadataId?: string;
  createdAt: Date;
  updatedAt: Date;
};

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_commandMenuItem',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true },
  },
  {
    collection: 'sabcrm_commandMenuItem',
    index: { workflowVersionId: 1, workspaceId: 1 },
    options: {},
  },
] as const;
