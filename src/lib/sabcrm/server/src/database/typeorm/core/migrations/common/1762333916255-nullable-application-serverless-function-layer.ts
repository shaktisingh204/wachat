// PORT-NOTE: pg-migration->mongo-index/seed
// Original: NullableApplicationServerlessFunctionLayer1762333916255
//
// This migration drops the NOT NULL constraint on the
// "serverlessFunctionLayerId" column of the Postgres "application" table,
// making it nullable.
//
// Mongo equivalent: In MongoDB all fields are nullable by default.
// The sabcrm_application collection field "serverlessFunctionLayerId" was
// already optional — no schema change or index is needed.
//
// Application-level validation should be updated to treat
// serverlessFunctionLayerId as optional (string | undefined | null).

export const migrationId = '1762333916255-nullable-application-serverless-function-layer';

/** Describes the intent: serverlessFunctionLayerId is now optional. */
export type ApplicationServerlessFunctionLayerChange = {
  collection: 'sabcrm_application';
  field: 'serverlessFunctionLayerId';
  nullable: true;
};
