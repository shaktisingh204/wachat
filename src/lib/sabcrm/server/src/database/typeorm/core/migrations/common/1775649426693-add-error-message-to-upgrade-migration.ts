// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."upgradeMigration" ADD "errorMessage" text
// Mongo equivalent: no DDL needed; documents in sabcrm_upgradeMigration can carry
// an optional "errorMessage" string field once the app layer writes it.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * No-op in Mongo: adding a nullable text field requires no schema change.
 * Exported for migration-runner traceability.
 */
export async function applyMigration1775649426693(): Promise<void> {
  await connectToDatabase(); // connectivity check
}

/** Reversal: no-op. */
export async function rollbackMigration1775649426693(): Promise<void> {
  // No action needed.
}
