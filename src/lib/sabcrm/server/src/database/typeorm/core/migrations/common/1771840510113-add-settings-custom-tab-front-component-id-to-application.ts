// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddSettingsCustomTabFrontComponentIdToApplication1771840510113
//
// Postgres DDL intent:
//   - Added nullable uuid column `settingsCustomTabFrontComponentId` to `core.application`
//
// MongoDB equivalent:
//   - The `sabcrm_application` collection document type gains:
//       settingsCustomTabFrontComponentId?: string | null
//         (reference to sabcrm_frontComponent._id, stored as uuid string)
//   - No index is required (nullable, no uniqueness constraint in source).
//   - No seed is needed (nullable field, absent on existing docs == null semantics).

import "server-only";

export const MIGRATION_NAME =
  "AddSettingsCustomTabFrontComponentIdToApplication1771840510113";

/**
 * No structural migration needed in MongoDB.
 * The field `settingsCustomTabFrontComponentId` is nullable and can simply be
 * absent (treated as null) on existing `sabcrm_application` documents.
 */
export async function up(): Promise<void> {
  // No-op: nullable fields in MongoDB require no migration.
}

export async function down(): Promise<void> {
  // No-op
}
