// PORT-NOTE: pg-migration->mongo-index/seed
// Original: RefactorAgentChatEntities1764100000000
//
// This Postgres migration replaces the agentChatMessage/agentChatMessagePart
// tables with three new tables:
//   - agentTurn       { id, threadId, agentId, createdAt }
//   - agentMessage    { id, threadId, turnId, agentId, role('user'|'assistant'), createdAt }
//   - agentMessagePart { id, messageId, orderIndex, type, textContent, reasoningContent,
//                        toolName, toolCallId, toolInput, toolOutput, state, errorMessage,
//                        errorDetails, sourceUrl*, sourceDocument*, file*, providerMetadata,
//                        createdAt }
//
// Mongo equivalent: create new collections + drop old ones + add indexes.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1764100000000-refactor-agent-chat-entities';

export type AgentMessageRole = 'user' | 'assistant';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();

  // Drop old collections
  for (const name of ['sabcrm_agentchatmessage', 'sabcrm_agentchatmessagepart']) {
    const cols = await db.listCollections({ name }).toArray();
    if (cols.length > 0) {
      await db.collection(name).drop();
    }
  }

  // agentTurn indexes
  const agentTurn = db.collection('sabcrm_agentturn');
  await agentTurn.createIndex({ threadId: 1 }, { name: 'IDX_3be906dca9d5b50fbfe40e33f0' });
  await agentTurn.createIndex({ agentId: 1 }, { sparse: true, name: 'IDX_e6d7c07f32e6f0f08cf639d4f5' });

  // agentMessage indexes
  const agentMessage = db.collection('sabcrm_agentmessage');
  await agentMessage.createIndex({ threadId: 1 }, { name: 'IDX_4c31daa882e3130534995bf90c' });
  await agentMessage.createIndex({ turnId: 1 }, { name: 'IDX_87dbab10ac94d9a091f8efaa67' });
  await agentMessage.createIndex({ agentId: 1 }, { sparse: true, name: 'IDX_48c75cb32ff0d2887ef0dc547f' });

  // agentMessagePart indexes
  const agentMessagePart = db.collection('sabcrm_agentmessagepart');
  await agentMessagePart.createIndex({ messageId: 1 }, { name: 'IDX_2aff9daad5cc3b5e15ca717334' });
}
