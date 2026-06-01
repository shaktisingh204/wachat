// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddBuiltHandlerPathToServerlessFunctions1769016869438
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."serverlessFunction" ADD "builtHandlerPath" varchar NOT NULL DEFAULT 'index.mjs'
//   DOWN:
//     - ALTER TABLE core."serverlessFunction" DROP COLUMN "builtHandlerPath"
//
// Mongo equivalent:
//   The sabcrm_serverlessFunction (later renamed to sabcrm_logicFunction) document type should include:
//     builtHandlerPath: string  (default: 'index.mjs')
//   No index is needed. Existing documents without this field should default to 'index.mjs'
//   in application logic.

export const MIGRATION_NAME =
  'AddBuiltHandlerPathToServerlessFunctions1769016869438';

/** Default value for builtHandlerPath on sabcrm_serverlessFunction / sabcrm_logicFunction. */
export const BUILT_HANDLER_PATH_DEFAULT = 'index.mjs';
