// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddAgentIdToAgentChatMessage1764081474225
//
// This Postgres migration:
//   1. Adds nullable uuid "agentId" to "agentChatMessage".
//   2. Updates agent.modelId DEFAULT to 'default-smart-model'.
//   3. Creates an index on agentChatMessage.agentId.
//
// NOTE: The agentChatMessage table was later replaced by agentMessage in
// migration 1764100000000-refactor-agent-chat-entities. This migration is
// preserved for historical accuracy.
//
// Mongo equivalents for the collection that existed before the refactor:

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1764081474225-add-agent-id-to-agent-chat-message';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();

  // Index on agentId in (now-legacy) sabcrm_agentchatmessage
  const collections = await db
    .listCollections({ name: 'sabcrm_agentchatmessage' })
    .toArray();
  if (collections.length > 0) {
    await db.collection('sabcrm_agentchatmessage').createIndex(
      { agentId: 1 },
      { sparse: true, name: 'IDX_f3cab3cd2160867060a2812a3d' },
    );
  }

  // Update agent modelId default (same as coreMigrationCheck migration)
  await db.collection('sabcrm_agent').updateMany(
    {
      $or: [
        { modelId: { $exists: false } },
        { modelId: null },
        { modelId: 'auto' },
      ],
    },
    { $set: { modelId: 'default-smart-model' } },
  );
}
