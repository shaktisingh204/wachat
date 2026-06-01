// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: creates core."agentChatMessagePart" table + index on messageId; drops "rawContent" from "agentChatMessage".

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1758767315179 – CreateAgentChatMessagePartTableAndRemoveRawContent
 *
 * Postgres intent:
 *   UP:   CREATE TABLE core.agentChatMessagePart (id uuid PK, messageId uuid NOT NULL,
 *           orderIndex int NOT NULL, type varchar NOT NULL, textContent text, reasoningContent text,
 *           toolName varchar, toolCallId varchar, toolInput jsonb, toolOutput jsonb, state varchar,
 *           errorMessage text, errorDetails jsonb, sourceUrlSourceId varchar, sourceUrlUrl varchar,
 *           sourceUrlTitle varchar, sourceDocumentSourceId varchar, sourceDocumentMediaType varchar,
 *           sourceDocumentTitle varchar, sourceDocumentFilename varchar, fileMediaType varchar,
 *           fileFilename varchar, fileUrl varchar, providerMetadata jsonb, createdAt timestamp NOT NULL DEFAULT now(),
 *           FK messageId -> agentChatMessage(id) ON DELETE CASCADE);
 *         CREATE INDEX IDX_5d4b48eeebfa7b23cd2226a874 ON core.agentChatMessagePart (messageId);
 *         ALTER TABLE core.agentChatMessage DROP COLUMN rawContent;
 *   DOWN: reverse of the above.
 *
 * Mongo equivalent:
 *   - New collection: sabcrm_agentChatMessagePart
 *   - Index on { messageId } for efficient lookup
 *   - Field `rawContent` removed from sabcrm_agentChatMessage (no DDL needed; schema-less)
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_agentChatMessagePart");

  await collection.createIndex(
    { messageId: 1 },
    { name: "IDX_agentChatMessagePart_messageId" },
  );

  // Compound index to support ordered retrieval of parts within a message
  await collection.createIndex(
    { messageId: 1, orderIndex: 1 },
    { name: "IDX_agentChatMessagePart_messageId_orderIndex" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("sabcrm_agentChatMessagePart").drop();
}

export const migrationNote = {
  id: "1758767315179",
  name: "CreateAgentChatMessagePartTableAndRemoveRawContent",
  mongoEquivalent:
    "sabcrm_agentChatMessagePart collection + index on { messageId }; rawContent field removal is schema-less no-op",
} as const;
