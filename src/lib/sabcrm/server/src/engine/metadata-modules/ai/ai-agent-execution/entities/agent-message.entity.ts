import "server-only";

// PORT-NOTE: Ported from twenty-server AgentMessageEntity (TypeORM/Postgres).
// Becomes a typed Mongo document + collection accessor.
// Collection name: sabcrm_agent_message
// Relations preserved as id refs:
//   workspaceId -> sabcrm_workspace
//   threadId    -> sabcrm_agent_chat_thread
//   turnId      -> sabcrm_agent_turn (nullable)
// OneToMany parts relation is resolved via sabcrm_agent_message_part.messageId.

import { type Collection, type ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";

export enum AgentMessageRole {
  SYSTEM = "system",
  USER = "user",
  ASSISTANT = "assistant",
}

export enum AgentMessageStatus {
  QUEUED = "queued",
  SENT = "sent",
}

export type AgentMessageDocument = {
  _id: ObjectId;

  /** UUID primary key. */
  id: string;

  /** FK -> sabcrm_workspace */
  workspaceId: string;

  /** FK -> sabcrm_agent_chat_thread */
  threadId: string;

  /** FK -> sabcrm_agent_turn (nullable) */
  turnId: string | null;

  /** FK -> sabcrm_agent (nullable) */
  agentId: string | null;

  role: AgentMessageRole;

  /** Default: AgentMessageStatus.SENT */
  status: AgentMessageStatus;

  processedAt: Date | null;

  createdAt: Date;
};

let _col: Collection<AgentMessageDocument> | null = null;

export async function getAgentMessageCollection(): Promise<
  Collection<AgentMessageDocument>
> {
  if (_col) return _col;
  const { db } = await connectToDatabase();
  _col = db.collection<AgentMessageDocument>("sabcrm_agent_message");

  await _col.createIndex({ workspaceId: 1 });
  await _col.createIndex({ threadId: 1 });
  await _col.createIndex({ turnId: 1 });
  await _col.createIndex({ agentId: 1 });
  await _col.createIndex({ id: 1 }, { unique: true });

  return _col;
}
