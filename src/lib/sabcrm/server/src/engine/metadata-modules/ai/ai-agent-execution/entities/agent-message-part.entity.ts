import "server-only";

// PORT-NOTE: Ported from twenty-server AgentMessagePartEntity (TypeORM/Postgres).
// Becomes a typed Mongo document + collection accessor.
// Collection name: sabcrm_agent_message_part
// Relations preserved as id refs:
//   workspaceId  -> sabcrm_workspace
//   messageId    -> sabcrm_agent_message
//   fileId       -> sabcrm_file (nullable)

import { type Collection, type ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";

export type AgentMessagePartDocument = {
  _id: ObjectId;

  /** UUID primary key (mirrors TypeORM uuid PK). */
  id: string;

  /** FK -> sabcrm_workspace */
  workspaceId: string;

  /** FK -> sabcrm_agent_message */
  messageId: string;

  /** Ordering position within the message. */
  orderIndex: number;

  /** Part type discriminator (e.g. "text", "tool_call", "tool_result"). */
  type: string;

  textContent: string | null;
  reasoningContent: string | null;
  toolName: string | null;
  toolCallId: string | null;
  toolInput: unknown | null;
  toolOutput: unknown | null;
  state: string | null;

  /**
   * True when the tool was executed by the model provider itself
   * (e.g. Anthropic's server-side web_search). convertToModelMessages relies
   * on this to emit the correct server-tool wire format.
   */
  providerExecuted: boolean | null;

  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;

  sourceUrlSourceId: string | null;
  sourceUrlUrl: string | null;
  sourceUrlTitle: string | null;

  sourceDocumentSourceId: string | null;
  sourceDocumentMediaType: string | null;
  sourceDocumentTitle: string | null;
  sourceDocumentFilename: string | null;

  fileFilename: string | null;

  /** FK -> sabcrm_file (nullable). */
  fileId: string | null;

  providerMetadata: Record<string, Record<string, unknown>> | null;

  createdAt: Date;
};

let _col: Collection<AgentMessagePartDocument> | null = null;

export async function getAgentMessagePartCollection(): Promise<
  Collection<AgentMessagePartDocument>
> {
  if (_col) return _col;
  const { db } = await connectToDatabase();
  _col = db.collection<AgentMessagePartDocument>("sabcrm_agent_message_part");

  // Indexes mirroring TypeORM @Index decorators
  await _col.createIndex({ workspaceId: 1 });
  await _col.createIndex({ messageId: 1 });
  await _col.createIndex({ id: 1 }, { unique: true });

  return _col;
}
