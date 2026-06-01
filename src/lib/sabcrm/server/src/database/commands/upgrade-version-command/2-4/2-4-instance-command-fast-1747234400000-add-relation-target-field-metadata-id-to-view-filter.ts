import "server-only";

// PORT-NOTE: FastInstanceCommand — adds relationTargetFieldMetadataId (uuid, optional)
// to viewFilter in Postgres, equivalent to version 2.3.0's 1747234300000 but for 2.4.
// In Mongo the field is schema-less; update the ViewFilter TS type.
// Version: 2.4.0  Timestamp: 1747234400000

export interface AddRelationTargetFieldMetadataIdToViewFilterEarly2_4Migration {
  version: "2.4.0";
  timestamp: 1747234400000;
  type: "fast";
  description: "Add optional relationTargetFieldMetadataId (uuid) to viewFilter — idempotent, 2.4 early guard";
}

/**
 * Mongo analogue:
 *
 * up:   ALTER TABLE "core"."viewFilter" ADD COLUMN IF NOT EXISTS "relationTargetFieldMetadataId" uuid
 *       -> Add `relationTargetFieldMetadataId?: string` to the ViewFilter TS type.
 *          No collection-level change needed; field is added implicitly on write.
 *
 * down: ALTER TABLE "core"."viewFilter" DROP COLUMN IF EXISTS "relationTargetFieldMetadataId"
 *       -> $unset the field from all sabcrm_viewFilter documents if rolling back.
 */
export async function up(): Promise<void> {
  // PORT-NOTE: No DDL needed in MongoDB. Ensure ViewFilter document type includes
  //            `relationTargetFieldMetadataId?: string`.
}

export async function down(): Promise<void> {
  // PORT-NOTE: To roll back, $unset relationTargetFieldMetadataId from all
  //            sabcrm_viewFilter documents.
}
