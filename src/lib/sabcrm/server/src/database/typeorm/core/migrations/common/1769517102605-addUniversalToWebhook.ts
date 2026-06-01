// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddUniversalToWebhook1769517102605
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."webhook" ADD "universalIdentifier" uuid (nullable initially)
//     - ALTER TABLE core."webhook" ADD "applicationId" uuid (nullable initially)
//     - CREATE UNIQUE INDEX (workspaceId, universalIdentifier) on webhook
//     - FK: webhook.applicationId -> application.id ON DELETE CASCADE
//   DOWN: Drops FK, index, and the two columns.
//
// Mongo equivalent:
//   The sabcrm_webhook document type should include:
//     universalIdentifier?: string
//     applicationId?: string
//   The unique compound index (workspaceId, universalIdentifier) should be created as a sparse
//   index (since the field is initially nullable).
//   These fields are made NOT NULL in the subsequent migration 1769525557511.

export const MIGRATION_NAME = 'AddUniversalToWebhook1769517102605';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_webhook',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: true },
  },
] as const;
