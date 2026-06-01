// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MakeRemainingEntitiesUniversalIdentifierAndApplicationIdNotNullable1768916632478
//
// What this migration did in Postgres (core schema):
//   UP (via util helper with savepoint):
//     For each of these tables, backfilled NULL universalIdentifier/applicationId, made both NOT NULL,
//     created a UNIQUE INDEX on (workspaceId, universalIdentifier), and added FK applicationId->application:
//       - core."pageLayoutTab"
//       - core."pageLayout"
//       - core."pageLayoutWidget"
//       - core."skill"
//       - core."serverlessFunction"
//       - core."routeTrigger"
//       - core."databaseEventTrigger"
//       - core."cronTrigger"
//       - core."viewSort"
//       - core."viewFilterGroup"
//       - core."rowLevelPermissionPredicateGroup"
//       - core."rowLevelPermissionPredicate"
//       - core."roleTarget"
//   DOWN: Reverts all of the above for each entity.
//
// Mongo equivalent:
//   All listed collections should enforce universalIdentifier and applicationId as non-optional.
//   Unique compound indexes (workspaceId, universalIdentifier) are created at collection-init time.

export const MIGRATION_NAME =
  'MakeRemainingEntitiesUniversalIdentifierAndApplicationIdNotNullable1768916632478';

export const AFFECTED_COLLECTIONS = [
  'sabcrm_pageLayoutTab',
  'sabcrm_pageLayout',
  'sabcrm_pageLayoutWidget',
  'sabcrm_skill',
  'sabcrm_serverlessFunction',
  'sabcrm_routeTrigger',
  'sabcrm_databaseEventTrigger',
  'sabcrm_cronTrigger',
  'sabcrm_viewSort',
  'sabcrm_viewFilterGroup',
  'sabcrm_rowLevelPermissionPredicateGroup',
  'sabcrm_rowLevelPermissionPredicate',
  'sabcrm_roleTarget',
] as const;

export const MONGO_INDEXES = AFFECTED_COLLECTIONS.map((collection) => ({
  collection,
  index: { workspaceId: 1, universalIdentifier: 1 },
  options: { unique: true, sparse: false },
}));
