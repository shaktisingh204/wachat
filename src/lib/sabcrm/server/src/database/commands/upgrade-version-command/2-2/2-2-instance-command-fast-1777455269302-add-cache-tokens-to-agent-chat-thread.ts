import "server-only";

// PORT-NOTE: FastInstanceCommand — pure Postgres DDL (ALTER TABLE core.agentChatThread).
// In SabNode/Mongo the equivalent is adding two numeric fields to documents
// in the sabcrm_agentChatThread collection.
// Version: 2.2.0  Timestamp: 1777455269302

export interface AddCacheTokensToAgentChatThreadMigration {
  version: "2.2.0";
  timestamp: 1777455269302;
  type: "fast";
  description: "Add totalCacheReadTokens and totalCacheCreationTokens (bigint, default 0) to agentChatThread";
}

/**
 * Mongo analogue:
 *
 * up:
 *   ALTER TABLE "core"."agentChatThread" ADD "totalCacheReadTokens" bigint NOT NULL DEFAULT 0
 *   ALTER TABLE "core"."agentChatThread" ADD "totalCacheCreationTokens" bigint NOT NULL DEFAULT 0
 *
 * In MongoDB these fields are added implicitly on write. For existing documents
 * that are missing them, run:
 *
 *   db.sabcrm_agentChatThread.updateMany(
 *     { totalCacheReadTokens: { $exists: false } },
 *     { $set: { totalCacheReadTokens: 0, totalCacheCreationTokens: 0 } }
 *   )
 *
 * down:
 *   $unset both fields.
 */
export async function up(): Promise<void> {
  // PORT-NOTE: Add `totalCacheReadTokens: number` (default 0) and
  //            `totalCacheCreationTokens: number` (default 0) to the
  //            AgentChatThread TypeScript type and ensure write paths
  //            default them to 0.
}

export async function down(): Promise<void> {
  // PORT-NOTE: Remove totalCacheReadTokens / totalCacheCreationTokens from documents.
}
