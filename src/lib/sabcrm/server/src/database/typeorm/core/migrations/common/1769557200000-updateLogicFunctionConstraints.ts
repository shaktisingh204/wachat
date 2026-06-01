// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration UpdateLogicFunctionConstraints1769557200000
//
// What this migration did in Postgres (core schema):
//   UP:
//     - Dropped old constraints/indexes on logicFunctionLayer and logicFunction:
//         FK_ca0699c3c906e903d7381c6a771 (logicFunctionLayer.workspaceId->workspace)
//         FK_4b9625a4babf7f4fa942fd26514 (logicFunction.logicFunctionLayerId->logicFunctionLayer)
//         FK_62cbd26626ff76df897181c7994 (logicFunction.applicationId->application)
//         FK_ef5dde6a681970b9c1e10563498 (logicFunction.workspaceId->workspace)
//         IDX_5b43e65e322d516c9307bed97a (unique workspaceId, universalIdentifier)
//         CHK_4a5179975ee017934a91703247 (timeoutSeconds check)
//     - Created new unique index IDX_2f0fd3da807fb993701619d0ac on (workspaceId, universalIdentifier)
//     - Added CHECK constraint: timeoutSeconds >= 1 AND timeoutSeconds <= 900
//     - Added FKs back with new constraint names:
//         FK_0a2947ca6a9adefa41eb62b2322: logicFunctionLayer.workspaceId -> workspace ON DELETE CASCADE
//         FK_a6ff4745db9bbe5a9616cfdfd5b: logicFunction.workspaceId -> workspace ON DELETE CASCADE
//         FK_daed3cd4d8048fbe85646874615: logicFunction.applicationId -> application ON DELETE CASCADE
//         FK_87e3f7b8f23cd90709e127f60c5: logicFunction.logicFunctionLayerId -> logicFunctionLayer
//   DOWN: Reverts to old constraint names and drops new ones.
//
// Mongo equivalent:
//   No index changes beyond what is already captured in previous migration stubs.
//   The CHECK constraint (timeoutSeconds 1–900) must be enforced in application-layer validation
//   (e.g., via a Zod schema on the logicFunction document).
//   Rebuild the unique index on sabcrm_logicFunction if needed:
//     { workspaceId: 1, universalIdentifier: 1 }  unique=true

export const MIGRATION_NAME = 'UpdateLogicFunctionConstraints1769557200000';

export const LOGIC_FUNCTION_TIMEOUT_SECONDS_MIN = 1;
export const LOGIC_FUNCTION_TIMEOUT_SECONDS_MAX = 900;

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_logicFunction',
    index: { workspaceId: 1, universalIdentifier: 1 },
    options: { unique: true, sparse: false },
  },
] as const;
