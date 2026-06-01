import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: FastInstanceCommand — adds deletedAt timestamp + compound index on agentChatThread.
// Version: 2.3.0  Timestamp: 1777682000000

export interface AddDeletedAtToAgentChatThreadMigration {
  version: "2.3.0";
  timestamp: 1777682000000;
  type: "fast";
  description: "Add deletedAt (timestamp with time zone) and compound index to agentChatThread";
}

/**
 * Mongo analogue:
 *
 * up:
 *   ALTER TABLE "core"."agentChatThread" ADD "deletedAt" TIMESTAMP WITH TIME ZONE
 *   CREATE INDEX "IDX_AGENT_CHAT_THREAD_ID_DELETED_AT" ON ... ("id", "deletedAt")
 *
 * down:
 *   DROP INDEX ...
 *   ALTER TABLE "core"."agentChatThread" DROP COLUMN "deletedAt"
 *
 * In MongoDB:
 * - `deletedAt` is added implicitly on documents (type Date | null).
 * - We create a compound index on { _id, deletedAt } for query efficiency.
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_agentChatThread");

  await collection.createIndex(
    { _id: 1, deletedAt: 1 },
    {
      name: "IDX_AGENT_CHAT_THREAD_ID_DELETED_AT",
      background: true,
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_agentChatThread");

  await collection.dropIndex("IDX_AGENT_CHAT_THREAD_ID_DELETED_AT");
  // PORT-NOTE: MongoDB doesn't require DDL to remove a field; optionally
  //            $unset deletedAt from all documents if required.
}
