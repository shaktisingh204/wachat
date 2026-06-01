// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeAgentUniversalIdentifierAndApplicationIdNotNullable
// PostgreSQL DDL (ALTER TABLE core.agent) has no direct Mongo analogue for NOT NULL
// constraints or FK constraints. In MongoDB, enforcement is done at the application layer.
//
// Original Postgres operations:
//   - DROP FK "FK_259c48f99f625708723414adb5d" on agent.applicationId
//   - DROP INDEX "IDX_0cc4d03dbcc269e77ba4d297fb"
//   - ALTER agent.universalIdentifier SET NOT NULL
//   - ALTER agent.applicationId SET NOT NULL
//   - CREATE UNIQUE INDEX "IDX_0cc4d03dbcc269e77ba4d297fb" ON agent (workspaceId, universalIdentifier)
//   - ADD FK agent.applicationId -> application(id) ON DELETE CASCADE
//
// Mongo equivalent:
//   - Ensure { workspaceId: 1, universalIdentifier: 1 } unique index on sabcrm_agent

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures the Mongo equivalent of the agent uniqueness constraint:
 * a unique compound index on (workspaceId, universalIdentifier).
 */
export async function ensureAgentIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_agent");

  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, sparse: false, name: "IDX_agent_workspaceId_universalIdentifier" }
  );
}
