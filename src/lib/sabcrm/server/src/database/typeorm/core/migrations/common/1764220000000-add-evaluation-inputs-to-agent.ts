// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddEvaluationInputsToAgent1764220000000
//
// This Postgres migration adds:
//   "evaluationInputs" text[] NOT NULL DEFAULT '{}'
// to the "agent" table.
//
// Mongo equivalent: Back-fill existing sabcrm_agent documents.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1764220000000-add-evaluation-inputs-to-agent';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('sabcrm_agent').updateMany(
    { evaluationInputs: { $exists: false } },
    { $set: { evaluationInputs: [] } },
  );
}
