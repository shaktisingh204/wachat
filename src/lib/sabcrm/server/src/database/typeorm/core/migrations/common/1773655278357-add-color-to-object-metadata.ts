// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."objectMetadata" ADD "color" text
// Mongo equivalent: sabcrm_objectMetadata documents can store a "color" string field without
// any schema change. No index is needed for a simple text field that is not queried by default.
// This file exists to document the migration boundary and is a no-op at runtime.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * No-op in Mongo: adding a nullable text field requires no DDL.
 * Exported so the migration runner can record this migration as applied.
 */
export async function applyMigration1773655278357(): Promise<void> {
  // sabcrm_objectMetadata documents will naturally include "color" once the
  // application layer starts writing it. No collection-level change is required.
  await connectToDatabase(); // ensure connectivity check passes
}

/** Reversal: no-op — there is no schema to revert for an optional field. */
export async function rollbackMigration1773655278357(): Promise<void> {
  // No action needed.
}
