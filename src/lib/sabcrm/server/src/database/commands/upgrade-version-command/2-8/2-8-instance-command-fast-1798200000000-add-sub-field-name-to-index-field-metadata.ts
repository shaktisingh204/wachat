import "server-only";

// PORT-NOTE: FastInstanceCommand — Postgres-only DDL (ALTER TABLE core.indexFieldMetadata ADD COLUMN subFieldName).
// MongoDB has no DDL; the "subFieldName" field can simply be written into documents as-needed
// because Mongo is schema-less. Document the intent here so the mapping stays complete.

export interface FastInstanceCommand {
  up(): Promise<void>;
  down(): Promise<void>;
}

/**
 * v2.8.0 — fast instance command #1798200000000
 * Adds a nullable "subFieldName" text column to indexFieldMetadata.
 *
 * PORT-NOTE: The original command runs raw Postgres DDL:
 *   up:   ALTER TABLE "core"."indexFieldMetadata" ADD COLUMN IF NOT EXISTS "subFieldName" text
 *   down: ALTER TABLE "core"."indexFieldMetadata" DROP COLUMN IF EXISTS "subFieldName"
 *
 * MongoDB analogue: no schema migration required — documents in sabcrm_indexFieldMetadata
 * may include a "subFieldName" string field at any time. Ensure application code handles
 * documents both with and without the field (treat absence as null/undefined).
 */
export class AddSubFieldNameToIndexFieldMetadataFastInstanceCommand
  implements FastInstanceCommand
{
  readonly version = "2.8.0";
  readonly timestamp = 1798200000000;

  public async up(): Promise<void> {
    // PORT-NOTE: Postgres DDL only. In MongoDB, subFieldName is added dynamically
    // on first write. No migration step needed.
  }

  public async down(): Promise<void> {
    // PORT-NOTE: Postgres DDL only. To remove subFieldName from existing Mongo
    // documents, run: db.sabcrm_indexFieldMetadata.updateMany({}, { $unset: { subFieldName: "" } })
  }
}
