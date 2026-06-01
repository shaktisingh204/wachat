// PORT-NOTE: Postgres DDL migration — changes the DEFAULT value of
// "builtHandlerPath" on "core"."logicFunction".
// In MongoDB defaults are enforced at the application layer (document schema /
// Zod validation), not at the database level.
//
// Original Twenty migration: UpdateLogicFunctionDefault1769710304101
//   UP:   ALTER TABLE "core"."logicFunction"
//           ALTER COLUMN "builtHandlerPath" SET DEFAULT 'src/index.mjs'
//   DOWN: ALTER TABLE "core"."logicFunction"
//           ALTER COLUMN "builtHandlerPath" SET DEFAULT 'index.mjs'
//
// Mongo equivalent:
//   No structural migration needed.
//   Ensure that the LogicFunction document type / creation logic uses
//   `builtHandlerPath: 'src/index.mjs'` as the default going forward.
//   Existing documents with the old default can optionally be backfilled:
//     db.sabcrm_logicfunction.updateMany(
//       { builtHandlerPath: "index.mjs" },
//       { $set: { builtHandlerPath: "src/index.mjs" } }
//     )

export const migrationNote = {
  id: '1769710304101',
  name: 'UpdateLogicFunctionDefault',
  mongoAction: 'default-change',
  collections: ['sabcrm_logicfunction'],
  field: 'builtHandlerPath',
  newDefault: 'src/index.mjs',
  oldDefault: 'index.mjs',
  optionalBackfill: `db.sabcrm_logicfunction.updateMany(
    { builtHandlerPath: "index.mjs" },
    { $set: { builtHandlerPath: "src/index.mjs" } }
  )`,
} as const;
