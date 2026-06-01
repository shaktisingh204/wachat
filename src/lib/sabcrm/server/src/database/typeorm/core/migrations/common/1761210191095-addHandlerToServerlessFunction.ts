// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddHandlerToServerlessFunction1761210191095
//
// This migration adds two columns to the Postgres "serverlessFunction" table:
//   - "handlerPath" character varying NOT NULL DEFAULT 'src/index.ts'
//   - "handlerName"  character varying NOT NULL DEFAULT 'main'
//
// Mongo equivalent: The sabcrm_serverlessfunction collection documents already
// carry these fields as plain object properties. No Mongo index or seed is
// required — new documents should include handlerPath and handlerName in their
// schema defaults (see the serverlessFunction Mongo schema module).
//
// If you need to back-fill existing documents, run a one-off update:
//   db.sabcrm_serverlessfunction.updateMany(
//     { handlerPath: { $exists: false } },
//     { $set: { handlerPath: 'src/index.ts', handlerName: 'main' } }
//   );

export const migrationId = '1761210191095-addHandlerToServerlessFunction';

export const mongoBackfill = {
  collection: 'sabcrm_serverlessfunction',
  filter: { handlerPath: { $exists: false } },
  update: { $set: { handlerPath: 'src/index.ts', handlerName: 'main' } },
} as const;
