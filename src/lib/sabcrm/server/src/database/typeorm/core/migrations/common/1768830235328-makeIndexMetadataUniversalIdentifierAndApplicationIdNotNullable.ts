// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MakeIndexMetadataUniversalIdentifierAndApplicationIdNotNullable1768830235328
//
// What this migration did in Postgres (core schema):
//   UP (via util helper with savepoint):
//     - Backfilled NULL universalIdentifier and applicationId on core."indexMetadata" rows.
//     - Made universalIdentifier and applicationId NOT NULL on core."indexMetadata".
//     - Created a UNIQUE INDEX on (workspaceId, universalIdentifier) for indexMetadata.
//     - Added FK from indexMetadata.applicationId -> application.id ON DELETE CASCADE.
//   DOWN: Reverts the above (drops FK, drops unique index, makes columns nullable again).
//
// Mongo equivalent:
//   The sabcrm_indexMetadata collection should enforce these fields as non-optional in the document type.
//   The unique compound index (workspaceId, universalIdentifier) is created at collection-init time.

export const MIGRATION_NAME =
  'MakeIndexMetadataUniversalIdentifierAndApplicationIdNotNullable1768830235328';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_indexMetadata',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: false },
  },
] as const;
