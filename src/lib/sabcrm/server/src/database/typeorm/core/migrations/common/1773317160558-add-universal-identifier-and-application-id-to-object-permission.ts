// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddUniversalIdentifierAndApplicationIdToObjectPermission1773317160558
//
// Postgres DDL intent (on core.objectPermission):
//   - Added nullable uuid `universalIdentifier`
//   - Added nullable uuid `applicationId`
//
// MongoDB equivalent:
//   - The `sabcrm_objectPermission` collection document type gains:
//       universalIdentifier?: string | null
//       applicationId?:       string | null
//   - Both fields are nullable; no seed or index is required by this migration
//     (a subsequent migration 1773317160559 makes them NOT NULL and adds the index).

import "server-only";

export const MIGRATION_NAME =
  "AddUniversalIdentifierAndApplicationIdToObjectPermission1773317160558";

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
