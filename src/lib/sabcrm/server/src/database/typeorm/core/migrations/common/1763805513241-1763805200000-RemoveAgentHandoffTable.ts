// PORT-NOTE: pg-migration->mongo-index/seed
// Original: RemoveAgentHandoffTable1763805513241
//
// This Postgres migration:
//   1. Drops the "agentHandoff" table (CASCADE).
//   2. Sets agent.responseFormat DEFAULT '{"type":"text"}'.
//
// Mongo equivalents:
//
// 1. Drop the sabcrm_agenthandoff collection (if it exists):
//    db.sabcrm_agenthandoff.drop();
//
// 2. Back-fill agent responseFormat (handled by migration 1763622159656 —
//    no additional action needed here, but the default is documented below).

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1763805513241-RemoveAgentHandoffTable';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();

  // Drop the agentHandoff collection if it exists
  const collections = await db
    .listCollections({ name: 'sabcrm_agenthandoff' })
    .toArray();
  if (collections.length > 0) {
    await db.collection('sabcrm_agenthandoff').drop();
  }

  // Ensure responseFormat default on agents (idempotent with prior migration)
  await db.collection('sabcrm_agent').updateMany(
    {
      $or: [
        { responseFormat: { $exists: false } },
        { responseFormat: null },
      ],
    },
    { $set: { responseFormat: { type: 'text' } } },
  );
}
