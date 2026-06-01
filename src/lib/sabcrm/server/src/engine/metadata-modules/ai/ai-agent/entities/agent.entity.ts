import "server-only";

// PORT-NOTE: Ported from twenty-server AgentEntity (TypeORM/Postgres @Entity('agent')).
// Converted to a typed Mongo collection module.
// Collection name: sabcrm_agent
// Indexes:
//   IDX_AGENT_ID_DELETED_AT     -> { id, deletedAt }
//   IDX_AGENT_NAME_WORKSPACE_ID_UNIQUE -> { name, workspaceId } unique where deletedAt IS NULL

import type { Collection, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

import type { AgentResponseFormat } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/agent-response-format.type";
import type { ModelConfiguration } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/modelConfiguration";
import type { ModelId } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/model-id.type";

// Relation references (stored as string IDs in Mongo):
//   workspaceId -> workspace document
// OneToMany: agent-chat-threads, agent-turns, role-targets resolved via their collections.

export type AgentDocument = {
  _id: ObjectId;

  /** UUID primary key (stored alongside _id for cross-collection joins) */
  id: string;

  workspaceId: string;

  /** Unique within workspaceId where deletedAt IS NULL */
  name: string;

  label: string;

  icon: string | null;

  description: string | null;

  prompt: string;

  /** Default: AUTO_SELECT_SMART_MODEL_ID */
  modelId: ModelId;

  /** Default: { type: 'text' } */
  responseFormat: AgentResponseFormat;

  isCustom: boolean;

  modelConfiguration: ModelConfiguration | null;

  evaluationInputs: string[];

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

let _collection: Collection<AgentDocument> | null = null;

export async function getAgentCollection(): Promise<Collection<AgentDocument>> {
  if (_collection) return _collection;

  const { db } = await connectToDatabase();
  _collection = db.collection<AgentDocument>("sabcrm_agent");

  // IDX_AGENT_ID_DELETED_AT
  await _collection.createIndex({ id: 1, deletedAt: 1 });
  // IDX_AGENT_NAME_WORKSPACE_ID_UNIQUE (partial — filtered to deletedAt IS NULL via sparse)
  await _collection.createIndex(
    { name: 1, workspaceId: 1 },
    {
      unique: true,
      partialFilterExpression: { deletedAt: { $eq: null } },
      sparse: true,
    },
  );
  await _collection.createIndex({ workspaceId: 1 });

  return _collection;
}
