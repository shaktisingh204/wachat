import "server-only";

// PORT-NOTE: FastInstanceCommand — pure Postgres DDL (ALTER TABLE core.viewSort).
// Adds `subFieldName` column (optional string) to the viewSort table so
// cross-version upgrades from pre-2.3 don't fail when workspace commands
// trigger WorkspaceFlatViewSortMapCacheService recomputation.
// Version: 2.3.0  Timestamp: 1747234200000

export interface AddSubFieldNameToViewSortMigration {
  version: "2.3.0";
  timestamp: 1747234200000;
  type: "fast";
  description: "Add optional subFieldName field to viewSort (idempotent, IF NOT EXISTS)";
}

/**
 * Mongo analogue:
 *
 * up:   ALTER TABLE "core"."viewSort" ADD COLUMN IF NOT EXISTS "subFieldName" character varying
 *       -> Field is schema-less in MongoDB; add `subFieldName?: string` to the ViewSort TS type.
 *          No index or constraint required.
 *
 * down: ALTER TABLE "core"."viewSort" DROP COLUMN IF EXISTS "subFieldName"
 *       -> $unset subFieldName from all sabcrm_viewSort documents if rolling back.
 */
export async function up(): Promise<void> {
  // PORT-NOTE: No DDL needed in MongoDB. Ensure ViewSort document type includes
  //            `subFieldName?: string`.
}

export async function down(): Promise<void> {
  // PORT-NOTE: To roll back, $unset subFieldName from all sabcrm_viewSort documents.
}
