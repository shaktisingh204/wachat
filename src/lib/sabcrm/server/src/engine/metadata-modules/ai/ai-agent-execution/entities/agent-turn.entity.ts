import "server-only";

// PORT-NOTE: Ported from twenty-server AgentTurnEntity (TypeORM/Postgres).
// Becomes a typed Mongo document + collection accessor.
// Collection name: sabcrm_agent_turn
// Relations preserved as id refs:
//   workspaceId -> sabcrm_workspace
//   threadId    -> sabcrm_agent_chat_thread
// OneToMany messages   resolved via sabcrm_agent_message.turnId
// OneToMany evaluations resolved via sabcrm_agent_turn_evaluation.turnId

import { type Collection, type ObjectId } from "mongodb";

import { connectToDatabase } from "@/lib/mongodb";

export type AgentTurnDocument = {
  _id: ObjectId;

  /** UUID primary key. */
  id: string;

  /** FK -> sabcrm_workspace */
  workspaceId: string;

  /** FK -> sabcrm_agent_chat_thread */
  threadId: string;

  /** FK -> sabcrm_agent (nullable) */
  agentId: string | null;

  createdAt: Date;
};

let _col: Collection<AgentTurnDocument> | null = null;

export async function getAgentTurnCollection(): Promise<
  Collection<AgentTurnDocument>
> {
  if (_col) return _col;
  const { db } = await connectToDatabase();
  _col = db.collection<AgentTurnDocument>("sabcrm_agent_turn");

  await _col.createIndex({ workspaceId: 1 });
  await _col.createIndex({ threadId: 1 });
  await _col.createIndex({ agentId: 1 });
  await _col.createIndex({ id: 1 }, { unique: true });

  return _col;
}
