import "server-only";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command (idempotent,
// coexisting with the early 2.3 command 1747234200000) that added a nullable
// varchar `subFieldName` column to the `viewSort` table IF NOT EXISTS.
//
// In MongoDB, `viewSort` documents are stored in sabcrm_viewsort. The field
// is added automatically on first write; no migration is required.
//
// Original SQL:
//   ALTER TABLE "core"."viewSort"
//     ADD COLUMN IF NOT EXISTS "subFieldName" character varying

export const VERSION = '2.5.0';
export const TIMESTAMP = 1778502963794;

export async function up(): Promise<void> {
  // No-op: MongoDB is schemaless; `subFieldName` is added on first write.
}

export async function down(): Promise<void> {
  // No-op.
}
