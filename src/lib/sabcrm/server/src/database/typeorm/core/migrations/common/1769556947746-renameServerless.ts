// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration RenameServerless1769556947746
//
// What this migration did in Postgres (core schema):
//   UP:
//     - RENAME TABLE core."serverlessFunctionLayer" TO core."logicFunctionLayer"
//     - RENAME TABLE core."serverlessFunction"      TO core."logicFunction"
//     - RENAME COLUMN logicFunction."serverlessFunctionLayerId" TO "logicFunctionLayerId"
//     - RENAME COLUMN application."serverlessFunctionLayerId"   TO "logicFunctionLayerId"
//     - RENAME COLUMN application."defaultServerlessFunctionRoleId" TO "defaultLogicFunctionRoleId"
//     - RENAME INDEX IDX_SERVERLESS_FUNCTION_ID_DELETED_AT -> IDX_LOGIC_FUNCTION_ID_DELETED_AT
//     - RENAME INDEX IDX_SERVERLESS_FUNCTION_LAYER_ID      -> IDX_LOGIC_FUNCTION_LAYER_ID
//   DOWN: Reverts all renames.
//
// Mongo equivalent:
//   - Rename collection: sabcrm_serverlessFunction  -> sabcrm_logicFunction
//   - Rename collection: sabcrm_serverlessFunctionLayer -> sabcrm_logicFunctionLayer
//   - Rename field in sabcrm_logicFunction: serverlessFunctionLayerId -> logicFunctionLayerId
//   - Rename field in sabcrm_application:   serverlessFunctionLayerId -> logicFunctionLayerId
//   - Rename field in sabcrm_application:   defaultServerlessFunctionRoleId -> defaultLogicFunctionRoleId
//   - Rebuild indexes on sabcrm_logicFunction and sabcrm_logicFunctionLayer with new names.
//
//   One-off rename queries (run once):
//     db.sabcrm_serverlessFunction.aggregate([{ $out: "sabcrm_logicFunction" }])
//     db.sabcrm_serverlessFunctionLayer.aggregate([{ $out: "sabcrm_logicFunctionLayer" }])
//     db.sabcrm_logicFunction.updateMany({},
//       [{ $set: { logicFunctionLayerId: "$serverlessFunctionLayerId" } },
//        { $unset: ["serverlessFunctionLayerId"] }])
//     db.sabcrm_application.updateMany({},
//       [{ $set: {
//           logicFunctionLayerId: "$serverlessFunctionLayerId",
//           defaultLogicFunctionRoleId: "$defaultServerlessFunctionRoleId"
//         } },
//        { $unset: ["serverlessFunctionLayerId", "defaultServerlessFunctionRoleId"] }])

export const MIGRATION_NAME = 'RenameServerless1769556947746';

export const COLLECTION_RENAMES = {
  'sabcrm_serverlessFunction': 'sabcrm_logicFunction',
  'sabcrm_serverlessFunctionLayer': 'sabcrm_logicFunctionLayer',
} as const;

export const FIELD_RENAMES = {
  'sabcrm_logicFunction': {
    serverlessFunctionLayerId: 'logicFunctionLayerId',
  },
  'sabcrm_application': {
    serverlessFunctionLayerId: 'logicFunctionLayerId',
    defaultServerlessFunctionRoleId: 'defaultLogicFunctionRoleId',
  },
} as const;
