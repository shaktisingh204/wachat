// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddForwardedRequestHeadersInRouteTriggers1768399525609
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."routeTrigger" ADD "forwardedRequestHeaders" jsonb NOT NULL DEFAULT '[]'
//   DOWN:
//     - ALTER TABLE core."routeTrigger" DROP COLUMN "forwardedRequestHeaders"
//
// Mongo equivalent:
//   The sabcrm_routeTrigger collection document type should include:
//     forwardedRequestHeaders: unknown[]  (default: [])
//   This is a schema-level change — documents without this field default to [] in application logic.
//   No index is created for this column; no Mongo migration runner is needed.
//
// NOTE: The routeTrigger entity was later dropped in migration 1769532887284 when triggers were
// merged into serverlessFunction/logicFunction. If routing to that migration instead, this field
// should be preserved in the httpRouteTriggerSettings jsonb field on logicFunction.

export const MIGRATION_NAME =
  'AddForwardedRequestHeadersInRouteTriggers1768399525609';

/** Default value for forwardedRequestHeaders when not set on a sabcrm_routeTrigger document. */
export const FORWARDED_REQUEST_HEADERS_DEFAULT: unknown[] = [];
