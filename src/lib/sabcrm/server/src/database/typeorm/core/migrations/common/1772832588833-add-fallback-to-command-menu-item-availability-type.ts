// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddFallbackToCommandMenuItemAvailabilityType1772832588833
//
// Postgres DDL intent:
//   - Extended the `commandMenuItem_availabilitytype_enum` Postgres enum by adding
//     the value 'FALLBACK' after 'RECORD_SELECTION'.
//   - No column changes; the enum value was added non-destructively (IF NOT EXISTS).
//
// MongoDB equivalent:
//   - MongoDB stores enum values as plain strings — no DDL change is needed.
//   - Existing documents with `availabilityType: 'GLOBAL'` or 'RECORD_SELECTION'
//     are unaffected.
//   - New documents may now use `availabilityType: 'FALLBACK'`.
//   - No index or seed operation is required.

import "server-only";

export const MIGRATION_NAME =
  "AddFallbackToCommandMenuItemAvailabilityType1772832588833";

/**
 * No-op: MongoDB stores availability types as strings, so 'FALLBACK' is valid
 * without any schema migration.
 */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op: cannot un-write string values that haven't been written yet.
}
