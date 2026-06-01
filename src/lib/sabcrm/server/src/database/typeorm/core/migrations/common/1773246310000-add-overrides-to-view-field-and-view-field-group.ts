// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddOverridesToViewFieldAndViewFieldGroup1773246310000
//
// Postgres DDL intent:
//   - Added nullable jsonb column `overrides` to `core.viewField`
//   - Added nullable jsonb column `overrides` to `core.viewFieldGroup`
//
// MongoDB equivalent:
//   - `sabcrm_viewField` documents gain:      overrides?: Record<string, unknown> | null
//   - `sabcrm_viewFieldGroup` documents gain:  overrides?: Record<string, unknown> | null
//   - jsonb maps directly to BSON sub-documents; no migration script required.
//   - No index changes are required.

import "server-only";

export const MIGRATION_NAME =
  "AddOverridesToViewFieldAndViewFieldGroup1773246310000";

/**
 * No-op: nullable JSON fields in MongoDB require no migration.
 */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op
}
