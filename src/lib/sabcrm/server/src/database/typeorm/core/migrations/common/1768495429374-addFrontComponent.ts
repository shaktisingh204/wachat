// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddFrontComponent1768495429374
//
// What this migration did in Postgres (core schema):
//   UP:
//     - CREATE TABLE core."frontComponent" with columns:
//         workspaceId uuid NOT NULL
//         universalIdentifier uuid NOT NULL
//         applicationId uuid NOT NULL
//         id uuid PK DEFAULT uuid_generate_v4()
//         name varchar NOT NULL
//         createdAt timestamptz NOT NULL DEFAULT now()
//         updatedAt timestamptz NOT NULL DEFAULT now()
//     - CREATE UNIQUE INDEX (workspaceId, universalIdentifier) on frontComponent
//     - FK: frontComponent.workspaceId -> workspace.id ON DELETE CASCADE
//     - FK: frontComponent.applicationId -> application.id ON DELETE CASCADE
//   DOWN: Drops FKs, index, and table.
//
// Mongo equivalent:
//   A new collection sabcrm_frontComponent is needed with the document type below.
//   Indexes to create at startup are listed in MONGO_INDEXES.

export const MIGRATION_NAME = 'AddFrontComponent1768495429374';

export type SabCrmFrontComponentDocument = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  applicationId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_frontComponent',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true },
  },
] as const;
