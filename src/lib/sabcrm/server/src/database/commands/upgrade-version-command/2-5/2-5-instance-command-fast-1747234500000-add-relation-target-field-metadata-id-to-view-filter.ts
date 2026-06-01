import "server-only";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that added a
// nullable `relationTargetFieldMetadataId` uuid column to the `viewFilter`
// table in the `core` schema (IF NOT EXISTS — idempotent).
//
// In MongoDB, `viewFilter` documents are stored in sabcrm_viewfilter. The
// field is added automatically on first write. No migration is required for
// schemaless documents, but an index may be added for query performance.
//
// Original SQL:
//   ALTER TABLE "core"."viewFilter"
//     ADD COLUMN IF NOT EXISTS "relationTargetFieldMetadataId" uuid

export const VERSION = '2.5.0';
export const TIMESTAMP = 1747234500000;

export async function up(): Promise<void> {
  // No-op: MongoDB is schemaless; `relationTargetFieldMetadataId` is added on
  // first write without a migration.
}

export async function down(): Promise<void> {
  // No-op: dropping a field from MongoDB requires an explicit $unset migration
  // which is not required here.
}
