// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddSsoBypassFlag1761651107128
//
// This migration adds three boolean columns to the Postgres "workspace" table:
//   - "isGoogleAuthBypassEnabled"    boolean NOT NULL DEFAULT false
//   - "isPasswordAuthBypassEnabled"  boolean NOT NULL DEFAULT false
//   - "isMicrosoftAuthBypassEnabled" boolean NOT NULL DEFAULT false
//
// Mongo equivalent: The sabcrm_workspace collection stores these as plain
// boolean fields. Back-fill any existing documents that lack these fields:
//
//   db.sabcrm_workspace.updateMany(
//     { isGoogleAuthBypassEnabled: { $exists: false } },
//     {
//       $set: {
//         isGoogleAuthBypassEnabled: false,
//         isPasswordAuthBypassEnabled: false,
//         isMicrosoftAuthBypassEnabled: false,
//       }
//     }
//   );

export const migrationId = '1761651107128-addSsoBypassFlag';

export const mongoBackfill = {
  collection: 'sabcrm_workspace',
  filter: { isGoogleAuthBypassEnabled: { $exists: false } },
  update: {
    $set: {
      isGoogleAuthBypassEnabled: false,
      isPasswordAuthBypassEnabled: false,
      isMicrosoftAuthBypassEnabled: false,
    },
  },
} as const;
