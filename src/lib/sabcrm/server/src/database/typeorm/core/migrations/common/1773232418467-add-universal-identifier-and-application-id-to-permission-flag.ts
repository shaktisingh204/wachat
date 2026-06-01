// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddUniversalIdentifierAndApplicationIdToPermissionFlag1773232418467
//
// Postgres DDL intent (on core.permissionFlag):
//   - Added nullable uuid `universalIdentifier`
//   - Added nullable uuid `applicationId`
//
// MongoDB equivalent:
//   - The `sabcrm_permissionFlag` collection document type gains:
//       universalIdentifier?: string | null
//       applicationId?:       string | null
//   - Both fields are nullable; no seed or index is required by this migration
//     (a subsequent migration 1773232418468 makes them NOT NULL and adds the index).

import "server-only";

export const MIGRATION_NAME =
  "AddUniversalIdentifierAndApplicationIdToPermissionFlag1773232418467";

/**
 * No-op: nullable fields in MongoDB require no migration.
 * The NOT NULL + index constraint is applied by the subsequent migration.
 */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op
}
