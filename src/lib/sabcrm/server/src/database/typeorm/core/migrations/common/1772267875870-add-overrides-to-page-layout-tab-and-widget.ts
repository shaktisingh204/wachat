// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddOverridesToPageLayoutTabAndWidget1772267875870
//
// Postgres DDL intent:
//   - Added nullable jsonb column `overrides` to `core.pageLayoutTab`
//   - Added nullable jsonb column `overrides` to `core.pageLayoutWidget`
//
// MongoDB equivalent:
//   - `sabcrm_pageLayoutTab` documents gain:   overrides?: Record<string, unknown> | null
//   - `sabcrm_pageLayoutWidget` documents gain: overrides?: Record<string, unknown> | null
//   - jsonb fields map directly to BSON sub-documents; no migration script required.
//   - No indexes are required for this change.

import "server-only";

export const MIGRATION_NAME =
  "AddOverridesToPageLayoutTabAndWidget1772267875870";

/**
 * No structural migration needed in MongoDB.
 * The `overrides` field is nullable JSON — absent on existing documents is equivalent to null.
 */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op
}
