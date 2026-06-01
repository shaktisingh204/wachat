// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: FixAiEntityTimestampsToTimestamptz1771600000000
//
// Postgres DDL intent:
//   - Changed `createdAt` / `updatedAt` columns in the following tables from
//     `TIMESTAMP` (without timezone) to `TIMESTAMP WITH TIME ZONE`:
//       core.agentChatThread  (createdAt, updatedAt)
//       core.agentMessage     (createdAt)
//       core.agentMessagePart (createdAt)
//       core.agentTurn        (createdAt)
//       core.agentTurnEvaluation (createdAt)
//
// MongoDB equivalent:
//   - MongoDB BSON Date values are always stored as UTC milliseconds since epoch
//     (equivalent to timestamptz). There is no "timestamp without timezone" type in Mongo.
//   - If application code previously stored timestamps as local ISO strings without a
//     timezone offset, a one-time coercion to proper Date objects is recommended.
//   - No index changes are required.
//
// Affected collections:
//   sabcrm_agentChatThread, sabcrm_agentMessage, sabcrm_agentMessagePart,
//   sabcrm_agentTurn, sabcrm_agentTurnEvaluation
//
// No structural migration is needed in MongoDB. This file documents the intent only.

import "server-only";

export const MIGRATION_NAME =
  "FixAiEntityTimestampsToTimestamptz1771600000000";

/**
 * No-op in MongoDB: all BSON Dates are already UTC (equivalent to timestamptz).
 * Documents that stored timestamps as plain strings should be coerced by the
 * application layer when they are next written.
 */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op
}
