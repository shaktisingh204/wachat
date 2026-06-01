// PORT-NOTE: Postgres DDL migration — second/corrective pass that drops
// "logicFunctionLayerId" from "core"."logicFunction" (identical intent to
// 1770050300000 but applied as a follow-up to catch any remaining rows).
// In MongoDB the sabcrm_logicfunction collection is schemaless; if the field
// was not removed by the previous migration stub, run the cleanup below.
//
// Original Twenty migration: DropLogicFunctionLayerIdFromLogicFunction1770193825210
//   UP:
//     DROP CONSTRAINT IF EXISTS "FK_87e3f7b8f23cd90709e127f60c5"
//     DROP CONSTRAINT IF EXISTS "FK_4b9625a4babf7f4fa942fd26514"
//     DROP INDEX   IF EXISTS "core"."IDX_LOGIC_FUNCTION_LAYER_ID"
//     ALTER TABLE "core"."logicFunction" DROP COLUMN IF EXISTS "logicFunctionLayerId"
//   DOWN:
//     ADD "logicFunctionLayerId" uuid
//     CREATE INDEX "IDX_LOGIC_FUNCTION_LAYER_ID" ...
//     ADD CONSTRAINT FK_4b9625a4... FOREIGN KEY (logicFunctionLayerId) REFERENCES logicFunctionLayer(id)
//
// Mongo data cleanup (idempotent — safe to run even if already done by 1770050300000):
//   db.sabcrm_logicfunction.updateMany({}, { $unset: { logicFunctionLayerId: "" } })

export const migrationNote = {
  id: '1770193825210',
  name: 'DropLogicFunctionLayerIdFromLogicFunction',
  mongoAction: 'field-removal (idempotent follow-up to 1770050300000)',
  collections: ['sabcrm_logicfunction'],
  fieldsRemoved: ['logicFunctionLayerId'],
  indexesDropped: ['IDX_LOGIC_FUNCTION_LAYER_ID'],
  dataCleanup:
    'db.sabcrm_logicfunction.updateMany({}, { $unset: { logicFunctionLayerId: "" } })',
} as const;
