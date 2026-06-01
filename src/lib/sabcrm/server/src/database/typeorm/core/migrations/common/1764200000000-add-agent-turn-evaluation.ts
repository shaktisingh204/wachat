// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddAgentTurnEvaluation1764200000000
//
// This Postgres migration creates the "agentTurnEvaluation" table:
//   { id uuid PK, turnId uuid NOT NULL FK→agentTurn, score int, comment text, createdAt }
// and adds an index on turnId.
//
// Mongo equivalent: create the sabcrm_agentturnevaluation collection index.

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1764200000000-add-agent-turn-evaluation';

export type AgentTurnEvaluationDocument = {
  _id?: string;
  turnId: string;
  score: number;
  comment?: string | null;
  createdAt: Date;
};

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_agentturnevaluation');

  await col.createIndex(
    { turnId: 1 },
    { name: 'IDX_c94f072dbd3c11f7df51db5293' },
  );
}
