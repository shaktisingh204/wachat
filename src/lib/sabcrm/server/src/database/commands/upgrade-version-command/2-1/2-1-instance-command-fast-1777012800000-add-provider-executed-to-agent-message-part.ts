import "server-only";

// PORT-NOTE: FastInstanceCommand — pure Postgres DDL (ALTER TABLE core.agentMessagePart).
// In SabNode/Mongo this is documented for reference; apply equivalent schema changes to
// the sabcrm_agentMessagePart collection by adding the `providerExecuted` field (boolean, optional).
// Version: 2.1.0  Timestamp: 1777012800000

export interface AddProviderExecutedToAgentMessagePartMigration {
  version: "2.1.0";
  timestamp: 1777012800000;
  type: "fast";
  description: "Add providerExecuted boolean field to agentMessagePart";
}

/**
 * Mongo analogue: ensure the `providerExecuted` field exists on documents in
 * the `sabcrm_agentMessagePart` collection (optional boolean, no default).
 * No schema enforcement is needed beyond adding the field to the TypeScript type.
 *
 * up:   ALTER TABLE "core"."agentMessagePart" ADD "providerExecuted" boolean
 * down: ALTER TABLE "core"."agentMessagePart" DROP COLUMN "providerExecuted"
 */
export async function up(): Promise<void> {
  // PORT-NOTE: No DDL equivalent in MongoDB — field is added implicitly on write.
  // Add `providerExecuted?: boolean` to the AgentMessagePart document type.
}

export async function down(): Promise<void> {
  // PORT-NOTE: To roll back, remove the field from all documents if needed.
}
