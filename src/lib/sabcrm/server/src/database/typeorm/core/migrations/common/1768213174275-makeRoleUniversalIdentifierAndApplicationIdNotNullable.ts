// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MakeRoleUniversalIdentifierAndApplicationIdNotNullable1768213174275
//
// What this migration did in Postgres (core schema):
//   UP:
//     - Backfilled NULL universalIdentifier and applicationId on core."role" rows (via util helper).
//     - Made universalIdentifier and applicationId NOT NULL on core."role".
//     - Created a UNIQUE INDEX on (workspaceId, universalIdentifier) for role.
//     - Added FK from role.applicationId -> application.id ON DELETE CASCADE.
//   DOWN: Reverts the above (drops FK, drops unique index, makes columns nullable again).
//
// Mongo equivalent:
//   The sabcrm_role collection should enforce these fields as non-optional in the document type.
//   The unique compound index (workspaceId, universalIdentifier) is created at collection-init time
//   in the schema module for sabcrm_role.

export const MIGRATION_NAME =
  'MakeRoleUniversalIdentifierAndApplicationIdNotNullable1768213174275';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_role',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: false },
  },
] as const;
