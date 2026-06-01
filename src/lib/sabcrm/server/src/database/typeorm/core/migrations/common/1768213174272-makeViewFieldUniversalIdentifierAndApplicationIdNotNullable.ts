// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MakeViewFieldUniversalIdentifierAndApplicationIdNotNullable1768213174272
//
// What this migration did in Postgres (core schema):
//   UP:
//     - Backfilled NULL universalIdentifier and applicationId on core."viewField" rows (via util helper).
//     - Made universalIdentifier and applicationId NOT NULL on core."viewField".
//     - Created a UNIQUE INDEX on (workspaceId, universalIdentifier) for viewField.
//     - Added FK from viewField.applicationId -> application.id ON DELETE CASCADE.
//   DOWN: Reverts the above (drops FK, drops unique index, makes columns nullable again).
//
// Mongo equivalent:
//   The sabcrm_viewField collection should enforce these fields via the document type (non-optional).
//   The unique compound index (workspaceId, universalIdentifier) is created at collection-init time
//   in the schema module for sabcrm_viewField.
//   No runtime migration runner is needed — Mongo collections are schema-less and this is handled
//   by the application-layer schema definition + index creation at startup.
//
// If you need to backfill existing documents run a one-off script:
//   db.sabcrm_viewField.updateMany(
//     { $or: [{ universalIdentifier: null }, { applicationId: null }] },
//     [{ $set: { universalIdentifier: { $ifNull: ["$universalIdentifier", "$$REMOVE"] }, ... } }]
//   );

export const MIGRATION_NAME =
  'MakeViewFieldUniversalIdentifierAndApplicationIdNotNullable1768213174272';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_viewField',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: false },
  },
] as const;
