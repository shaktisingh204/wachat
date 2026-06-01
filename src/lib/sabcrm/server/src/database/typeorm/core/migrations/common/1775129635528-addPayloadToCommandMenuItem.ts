// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. ALTER TABLE "core"."commandMenuItem" ADD "payload" jsonb
//   2. Savepoint-guarded: add a CHECK constraint "CHK_CMD_MENU_ITEM_ENGINE_KEY_COHERENCE"
//      via a util function.
//
// Mongo equivalent:
//   • The "payload" field is schema-less in Mongo — no DDL needed.
//   • The CHECK constraint coherence is enforced at the application layer.
//   • A sparse index on "payload" is omitted (JSONB structure varies too much).
//   This file documents the migration boundary.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * No-op in Mongo: adding a nullable JSONB field requires no schema change.
 * Coherence rules (engineComponentKey vs workflowVersionId vs frontComponentId) are
 * enforced in the SabCRM service layer, not in the database.
 */
export async function applyMigration1775129635528(): Promise<void> {
  await connectToDatabase(); // connectivity check
}

/** Reversal: no-op — payload field simply stops being written. */
export async function rollbackMigration1775129635528(): Promise<void> {
  // No action needed.
}
