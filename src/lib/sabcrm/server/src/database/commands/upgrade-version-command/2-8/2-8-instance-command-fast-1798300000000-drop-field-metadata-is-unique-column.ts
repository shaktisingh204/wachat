import "server-only";

// PORT-NOTE: FastInstanceCommand — Postgres-only DDL (ALTER TABLE core.fieldMetadata DROP COLUMN isUnique).
// IndexMetadata is the single source of truth for field-level uniqueness; the column on
// FieldMetadata is redundant and unread.
// MongoDB has no DDL; removing a field from all documents requires an explicit $unset.

export interface FastInstanceCommand {
  up(): Promise<void>;
  down(): Promise<void>;
}

/**
 * v2.8.0 — fast instance command #1798300000000
 * Drops the redundant "isUnique" boolean column from fieldMetadata.
 *
 * PORT-NOTE: The original command runs raw Postgres DDL:
 *   up:   ALTER TABLE "core"."fieldMetadata" DROP COLUMN IF EXISTS "isUnique"
 *   down: ALTER TABLE "core"."fieldMetadata" ADD COLUMN IF NOT EXISTS "isUnique" boolean DEFAULT false
 *
 * MongoDB analogue:
 *   up:   db.sabcrm_fieldMetadata.updateMany({}, { $unset: { isUnique: "" } })
 *   down: db.sabcrm_fieldMetadata.updateMany({ isUnique: { $exists: false } }, { $set: { isUnique: false } })
 */
export class DropFieldMetadataIsUniqueColumnFastInstanceCommand
  implements FastInstanceCommand
{
  readonly version = "2.8.0";
  readonly timestamp = 1798300000000;

  public async up(): Promise<void> {
    // PORT-NOTE: In MongoDB, run:
    //   db.sabcrm_fieldMetadata.updateMany({}, { $unset: { isUnique: "" } })
    // to remove the redundant field from all existing documents.
  }

  public async down(): Promise<void> {
    // PORT-NOTE: In MongoDB, run:
    //   db.sabcrm_fieldMetadata.updateMany({ isUnique: { $exists: false } }, { $set: { isUnique: false } })
    // to restore the default value on documents that lack it.
  }
}
