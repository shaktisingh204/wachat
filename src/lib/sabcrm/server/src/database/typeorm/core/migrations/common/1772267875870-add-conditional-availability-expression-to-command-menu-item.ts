// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddConditionalAvailabilityExpressionToCommandMenuItem1772267875870
//
// Postgres DDL intent:
//   - Added nullable varchar column `conditionalAvailabilityExpression`
//     to `core.commandMenuItem`
//
// MongoDB equivalent:
//   - The `sabcrm_commandMenuItem` collection document type gains:
//       conditionalAvailabilityExpression?: string | null
//   - No index required; no seed needed (nullable field).

import "server-only";

export const MIGRATION_NAME =
  "AddConditionalAvailabilityExpressionToCommandMenuItem1772267875870";

/**
 * No structural migration needed in MongoDB.
 * The field `conditionalAvailabilityExpression` is nullable — absent documents
 * are treated as null by the application layer.
 */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op
}
