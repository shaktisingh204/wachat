import "server-only";

// PORT-NOTE: Ported from twenty-server AgentTurnEvaluationEntity (TypeORM/Postgres).
// Converted to a typed Mongo collection module.
// Original table: core.agentTurnEvaluation
// Collection name: sabcrm_agent_turn_evaluation

import type { Collection, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

// Relation references (stored as string IDs in Mongo)
// - workspaceId -> workspace document
// - turnId -> AgentTurnDocument (sabcrm_agent_turn)

export type AgentTurnEvaluationDocument = {
  _id: ObjectId;

  /** Tenant scope */
  workspaceId: string;

  /** Foreign key -> AgentTurn */
  turnId: string;

  /** 0-100 quality score */
  score: number;

  /** Optional evaluator comment (max ~500 chars in practice) */
  comment: string | null;

  createdAt: Date;
};

let _collection: Collection<AgentTurnEvaluationDocument> | null = null;

export async function getAgentTurnEvaluationCollection(): Promise<
  Collection<AgentTurnEvaluationDocument>
> {
  if (_collection) return _collection;

  const { db } = await connectToDatabase();
  _collection = db.collection<AgentTurnEvaluationDocument>(
    "sabcrm_agent_turn_evaluation",
  );

  // Replicate TypeORM @Index fields
  await _collection.createIndex({ workspaceId: 1 });
  await _collection.createIndex({ turnId: 1 });
  await _collection.createIndex({ workspaceId: 1, turnId: 1 });

  return _collection;
}
