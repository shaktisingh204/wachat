// PORT-NOTE: pg-migration->mongo-index/seed
// Original: UpdateAgentResponseFormat1763622159656
//
// This Postgres migration:
//   1. Sets responseFormat = '{"type":"text"}' on all agent rows where it is NULL.
//   2. Sets the column DEFAULT to '{"type":"text"}'.
//
// Mongo equivalent: Back-fill existing sabcrm_agent documents where
// responseFormat is absent or null.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1763622159656-update-agent-response-format';

export const DEFAULT_AGENT_RESPONSE_FORMAT = { type: 'text' } as const;

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('sabcrm_agent').updateMany(
    {
      $or: [
        { responseFormat: { $exists: false } },
        { responseFormat: null },
      ],
    },
    { $set: { responseFormat: DEFAULT_AGENT_RESPONSE_FORMAT } },
  );
}
