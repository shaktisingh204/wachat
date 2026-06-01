// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MakeAgentUniversalIdentifierAndApplicationIdNotNullable1768213174274
//
// What this migration did in Postgres (core schema):
//   UP:
//     - Backfilled NULL universalIdentifier and applicationId on core."agent" rows (via util helper).
//     - Made universalIdentifier and applicationId NOT NULL on core."agent".
//     - Created a UNIQUE INDEX on (workspaceId, universalIdentifier) for agent.
//     - Added FK from agent.applicationId -> application.id ON DELETE CASCADE.
//   DOWN: Reverts the above (drops FK, drops unique index, makes columns nullable again).
//
// Mongo equivalent:
//   The sabcrm_agent collection should enforce these fields as non-optional in the document type.
//   The unique compound index (workspaceId, universalIdentifier) is created at collection-init time
//   in the schema module for sabcrm_agent.

export const MIGRATION_NAME =
  'MakeAgentUniversalIdentifierAndApplicationIdNotNullable1768213174274';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_agent',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: false },
  },
] as const;
