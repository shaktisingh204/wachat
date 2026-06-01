// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration RenameHandlerPathToSourceHandlerPath1769091641000
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."serverlessFunction" RENAME COLUMN "handlerPath" TO "sourceHandlerPath"
//   DOWN:
//     - ALTER TABLE core."serverlessFunction" RENAME COLUMN "sourceHandlerPath" TO "handlerPath"
//
// Mongo equivalent:
//   The sabcrm_serverlessFunction (later sabcrm_logicFunction) document type should use the field
//   name "sourceHandlerPath" (not "handlerPath").
//   If existing documents exist with "handlerPath", run a one-off rename:
//     db.sabcrm_serverlessFunction.updateMany(
//       { handlerPath: { $exists: true } },
//       [{ $set: { sourceHandlerPath: "$handlerPath" } }, { $unset: ["handlerPath"] }]
//     );
//   No index changes required.

export const MIGRATION_NAME = 'RenameHandlerPathToSourceHandlerPath1769091641000';

/** Canonical field name after this migration. */
export const HANDLER_PATH_FIELD = 'sourceHandlerPath' as const;
