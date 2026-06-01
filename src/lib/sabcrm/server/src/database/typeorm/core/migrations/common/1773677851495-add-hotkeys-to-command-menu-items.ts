// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."commandMenuItem" ADD "hotKeys" text array
// Mongo equivalent: no DDL needed; documents in sabcrm_commandMenuItem can store a "hotKeys"
// array of strings once the application layer starts writing the field.
// This file records the migration boundary.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * No-op in Mongo: adding a nullable array field requires no schema change.
 * Documents will carry "hotKeys: string[]" once the app layer writes it.
 */
export async function applyMigration1773677851495(): Promise<void> {
  await connectToDatabase(); // connectivity check
}

/** Reversal: no-op. */
export async function rollbackMigration1773677851495(): Promise<void> {
  // No action needed.
}
