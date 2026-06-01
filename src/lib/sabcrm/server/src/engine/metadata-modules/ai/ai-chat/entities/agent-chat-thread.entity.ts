import "server-only";

// PORT-NOTE: Originally a TypeORM @Entity (Postgres) in twenty-server.
// Ported to a typed Mongo collection module for SabNode.
// Relations (workspace, userWorkspace, turns, messages) are preserved as
// id-reference fields. OneToMany back-references (turns, messages) are
// not stored in this document — they are owned by the child collections.
// Indexes mirror the original: unique on id, indexed on workspaceId and
// userWorkspaceId, compound on [id, deletedAt].

import type { Collection, ObjectId } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Document type
// ---------------------------------------------------------------------------

export type AgentChatThreadDocument = {
  _id?: ObjectId;
  /** Primary UUID (mirrors TypeORM PrimaryGeneratedColumn('uuid')) */
  id: string;

  /** FK → sabcrm_workspace collection */
  workspaceId: string;

  /** FK → sabcrm_user_workspace collection */
  userWorkspaceId: string;

  title: string | null;

  totalInputTokens: number;
  totalOutputTokens: number;
  contextWindowTokens: number | null;
  conversationSize: number;

  /** Internal precision credit counter (bigint in Postgres → number in Mongo) */
  totalInputCredits: number;
  totalOutputCredits: number;
  totalCacheReadTokens: number;
  totalCacheCreationTokens: number;

  activeStreamId: string | null;

  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ---------------------------------------------------------------------------
// Collection name
// ---------------------------------------------------------------------------

export const AGENT_CHAT_THREAD_COLLECTION = "sabcrm_agentchatthread";

// ---------------------------------------------------------------------------
// Typed collection accessor
// ---------------------------------------------------------------------------

export async function getAgentChatThreadCollection(): Promise<
  Collection<AgentChatThreadDocument>
> {
  const db = await connectToDatabase();
  return db.collection<AgentChatThreadDocument>(AGENT_CHAT_THREAD_COLLECTION);
}

// ---------------------------------------------------------------------------
// Index creation (call once at startup / migration)
// ---------------------------------------------------------------------------

export async function ensureAgentChatThreadIndexes(): Promise<void> {
  const col = await getAgentChatThreadCollection();

  await Promise.all([
    // Primary lookup by UUID
    col.createIndex({ id: 1 }, { unique: true, name: "IDX_AGENT_CHAT_THREAD_ID" }),

    // FK indexes
    col.createIndex({ workspaceId: 1 }, { name: "IDX_AGENT_CHAT_THREAD_WORKSPACE_ID" }),
    col.createIndex({ userWorkspaceId: 1 }, { name: "IDX_AGENT_CHAT_THREAD_USER_WORKSPACE_ID" }),

    // Mirrors: IDX_AGENT_CHAT_THREAD_ID_DELETED_AT
    col.createIndex(
      { id: 1, deletedAt: 1 },
      { name: "IDX_AGENT_CHAT_THREAD_ID_DELETED_AT" },
    ),
  ]);
}
