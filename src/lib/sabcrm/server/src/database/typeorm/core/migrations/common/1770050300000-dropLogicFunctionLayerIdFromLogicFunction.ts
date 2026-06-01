// PORT-NOTE: Postgres DDL migration — drops the "logicFunctionLayerId" FK column
// and its associated index from "core"."logicFunction".
// In MongoDB this corresponds to removing the `logicFunctionLayerId` field from
// sabcrm_logicfunction documents.
//
// Original Twenty migration: DropLogicFunctionLayerIdFromLogicFunction1770050300000
//   UP:
//     DROP CONSTRAINT IF EXISTS "FK_87e3f7b8f23cd90709e127f60c5"
//     DROP CONSTRAINT IF EXISTS "FK_4b9625a4babf7f4fa942fd26514"
//     DROP INDEX   IF EXISTS "core"."IDX_LOGIC_FUNCTION_LAYER_ID"
//     ALTER TABLE "core"."logicFunction" DROP COLUMN IF EXISTS "logicFunctionLayerId"
//   DOWN:
//     ADD "logicFunctionLayerId" uuid
//     CREATE INDEX "IDX_LOGIC_FUNCTION_LAYER_ID" ON logicFunction(logicFunctionLayerId)
//     ADD CONSTRAINT FK_4b9625a4... FOREIGN KEY (logicFunctionLayerId) REFERENCES logicFunctionLayer(id)
//
// Mongo data cleanup (optional, run once):
//   db.sabcrm_logicfunction.updateMany({}, { $unset: { logicFunctionLayerId: "" } })
//
// Also drop the index if it was previously created:
//   db.sabcrm_logicfunction.dropIndex("IDX_LOGIC_FUNCTION_LAYER_ID")

export const migrationNote = {
  id: '1770050300000',
  name: 'DropLogicFunctionLayerIdFromLogicFunction',
  mongoAction: 'field-removal + drop-index',
  collections: ['sabcrm_logicfunction'],
  fieldsRemoved: ['logicFunctionLayerId'],
  indexesDropped: ['IDX_LOGIC_FUNCTION_LAYER_ID'],
  dataCleanup:
    'db.sabcrm_logicfunction.updateMany({}, { $unset: { logicFunctionLayerId: "" } })',
} as const;
