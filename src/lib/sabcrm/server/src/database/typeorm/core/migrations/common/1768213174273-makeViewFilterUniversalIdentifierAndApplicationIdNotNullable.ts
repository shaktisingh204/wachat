// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MakeViewFilterUniversalIdentifierAndApplicationIdNotNullable1768213174273
//
// What this migration did in Postgres (core schema):
//   UP:
//     - Backfilled NULL universalIdentifier and applicationId on core."viewFilter" rows (via util helper).
//     - Made universalIdentifier and applicationId NOT NULL on core."viewFilter".
//     - Created a UNIQUE INDEX on (workspaceId, universalIdentifier) for viewFilter.
//     - Added FK from viewFilter.applicationId -> application.id ON DELETE CASCADE.
//   DOWN: Reverts the above (drops FK, drops unique index, makes columns nullable again).
//
// Mongo equivalent:
//   The sabcrm_viewFilter collection should enforce these fields as non-optional in the document type.
//   The unique compound index (workspaceId, universalIdentifier) is created at collection-init time
//   in the schema module for sabcrm_viewFilter.
//   No runtime migration runner is needed for Mongo.

export const MIGRATION_NAME =
  'MakeViewFilterUniversalIdentifierAndApplicationIdNotNullable1768213174273';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_viewFilter',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: false },
  },
] as const;
