// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."agentChatThread" — drops FK + index on agentId column, then drops agentId column;
//         core."workspace" — drops defaultAgentId column.

/**
 * Migration 1760994964826 – RemoveDefaultAgentAndThreadAgentId
 *
 * Postgres intent:
 *   UP:   agentChatThread: DROP CONSTRAINT FK; DROP INDEX IDX_d0bdc80c68a48b1f26727aabfe;
 *                          DROP COLUMN agentId;
 *         workspace: DROP COLUMN defaultAgentId.
 *   DOWN: agentChatThread: ADD COLUMN agentId uuid NOT NULL; CREATE INDEX; ADD CONSTRAINT FK -> agent ON DELETE CASCADE;
 *         workspace: ADD COLUMN defaultAgentId uuid.
 *
 * Mongo equivalent:
 *   - sabcrm_agentChatThread documents should no longer include `agentId`.
 *   - sabcrm_workspace documents should no longer include `defaultAgentId`.
 *   - Schema-less Mongo requires no DDL.
 *   - One-off field removal:
 *       db.sabcrm_agentChatThread.updateMany({}, { $unset: { agentId: "" } });
 *       db.sabcrm_workspace.updateMany({}, { $unset: { defaultAgentId: "" } });
 *   - Drop index on agentId if it was created:
 *       db.sabcrm_agentChatThread.dropIndex("IDX_agentChatThread_agentId");
 */

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  // Drop agentId index if it exists
  try {
    await db
      .collection("sabcrm_agentChatThread")
      .dropIndex("IDX_agentChatThread_agentId");
  } catch {
    // Safe to ignore if index doesn't exist
  }
}

export const migrationNote = {
  id: "1760994964826",
  name: "RemoveDefaultAgentAndThreadAgentId",
  mongoEquivalent:
    "drop agentId index from sabcrm_agentChatThread; field removals are schema-less no-ops",
} as const;
