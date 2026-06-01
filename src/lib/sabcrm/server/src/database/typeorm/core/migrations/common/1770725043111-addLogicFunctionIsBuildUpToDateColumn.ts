// PORT-NOTE: Postgres DDL migration — adds "isBuildUpToDate" boolean column
// (NOT NULL DEFAULT true) to "core"."logicFunction" and drops the DEFAULT values
// from three other columns (sourceHandlerPath, builtHandlerPath, handlerName).
// In MongoDB (sabcrm_logicfunction) defaults are enforced at the application
// layer; removing a Postgres DEFAULT has no Mongo equivalent.
//
// Original Twenty migration: AddLogicFunctionIsBuildUpToDateColumn1770725043111
//   UP:
//     ADD "isBuildUpToDate" boolean NOT NULL DEFAULT true
//     ALTER COLUMN "sourceHandlerPath" DROP DEFAULT
//     ALTER COLUMN "builtHandlerPath"  DROP DEFAULT
//     ALTER COLUMN "handlerName"       DROP DEFAULT
//   DOWN:
//     ALTER COLUMN "handlerName"       SET DEFAULT 'main'
//     ALTER COLUMN "builtHandlerPath"  SET DEFAULT 'src/index.mjs'
//     ALTER COLUMN "sourceHandlerPath" SET DEFAULT 'src/index.ts'
//     DROP COLUMN "isBuildUpToDate"
//
// Mongo backfill (optional, run once):
//   db.sabcrm_logicfunction.updateMany(
//     { isBuildUpToDate: { $exists: false } },
//     { $set: { isBuildUpToDate: true } }
//   )
//
// Note: sourceHandlerPath, builtHandlerPath, and handlerName no longer have
// server-side defaults — callers must supply them explicitly.
//
// The TypeScript document type for LogicFunction should include:
//   isBuildUpToDate: boolean  (default true)

export const migrationNote = {
  id: '1770725043111',
  name: 'AddLogicFunctionIsBuildUpToDateColumn',
  mongoAction: 'field-add',
  collections: ['sabcrm_logicfunction'],
  fieldsAdded: [
    { name: 'isBuildUpToDate', type: 'boolean', default: true },
  ],
  defaultsDropped: ['sourceHandlerPath', 'builtHandlerPath', 'handlerName'],
  backfill: `db.sabcrm_logicfunction.updateMany(
    { isBuildUpToDate: { $exists: false } },
    { $set: { isBuildUpToDate: true } }
  )`,
} as const;
