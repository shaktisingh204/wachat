// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration MakeWebhookUnivesralIdentiferAndApplicationIdNotNull1769525557511
//
// What this migration did in Postgres (core schema):
//   UP (via util helper with savepoint):
//     - Backfilled NULL universalIdentifier and applicationId on core."webhook" rows.
//     - Made universalIdentifier and applicationId NOT NULL on core."webhook".
//     - Dropped the sparse/nullable unique index and recreated it as non-nullable.
//     - Added FK from webhook.applicationId -> application.id ON DELETE CASCADE.
//   DOWN: Reverts (drops FK, swaps back to sparse index, makes columns nullable again).
//
// Mongo equivalent:
//   After backfilling, the sabcrm_webhook document type should treat these as required:
//     universalIdentifier: string   (non-optional)
//     applicationId: string         (non-optional)
//   Rebuild the index as non-sparse (replace the sparse index from migration 1769517102605):
//     Drop { workspaceId:1, universalIdentifier:1 } sparse=true
//     Create { workspaceId:1, universalIdentifier:1 } sparse=false, unique=true

export const MIGRATION_NAME =
  'MakeWebhookUnivesralIdentiferAndApplicationIdNotNull1769525557511';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_webhook',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: false },
  },
] as const;
