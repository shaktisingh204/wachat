import "server-only";

// PORT-NOTE: FastInstanceCommand — pure Postgres DDL (ALTER TABLE core.viewFilter).
// Adds optional `relationTargetFieldMetadataId` (uuid) column to viewFilter.
// Version: 2.3.0  Timestamp: 1747234300000

export interface AddRelationTargetFieldMetadataIdToViewFilterMigration {
  version: "2.3.0";
  timestamp: 1747234300000;
  type: "fast";
  description: "Add optional relationTargetFieldMetadataId (uuid) to viewFilter (idempotent)";
}

/**
 * Mongo analogue:
 *
 * up:   ALTER TABLE "core"."viewFilter" ADD COLUMN IF NOT EXISTS "relationTargetFieldMetadataId" uuid
 *       -> Add `relationTargetFieldMetadataId?: string` to the ViewFilter TS type.
 *
 * down: ALTER TABLE "core"."viewFilter" DROP COLUMN IF EXISTS "relationTargetFieldMetadataId"
 *       -> $unset the field from all sabcrm_viewFilter documents.
 */
export async function up(): Promise<void> {
  // PORT-NOTE: No DDL needed in MongoDB. Update ViewFilter document type to include
  //            `relationTargetFieldMetadataId?: string`.
}

export async function down(): Promise<void> {
  // PORT-NOTE: To roll back, $unset relationTargetFieldMetadataId from all
  //            sabcrm_viewFilter documents.
}
