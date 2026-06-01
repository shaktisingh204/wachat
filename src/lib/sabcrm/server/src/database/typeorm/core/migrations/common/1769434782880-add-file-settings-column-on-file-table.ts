// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddFileSettingsColumnOnFileTable1769434782880
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."file" ADD "settings" jsonb  (nullable)
//   DOWN:
//     - ALTER TABLE core."file" DROP COLUMN "settings"
//
// Mongo equivalent:
//   The sabcrm_file document type should include an optional settings field:
//     settings?: Record<string, unknown>
//   No index is needed. Existing documents without this field will have settings = undefined.

export const MIGRATION_NAME = 'AddFileSettingsColumnOnFileTable1769434782880';

/** Type of the optional settings field added to sabcrm_file documents. */
export type SabCrmFileSettings = Record<string, unknown>;
