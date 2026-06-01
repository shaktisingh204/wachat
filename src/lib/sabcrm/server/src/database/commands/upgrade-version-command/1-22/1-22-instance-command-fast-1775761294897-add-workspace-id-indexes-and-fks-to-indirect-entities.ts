import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.22.0', 1775761294897) — pg-migration->mongo-index
// Original: CREATE INDEX + ADD FOREIGN KEY on workspaceId for each of the
// indirect entity tables (applicationVariable, indexFieldMetadata,
// twoFactorAuthenticationMethod, agentMessagePart, agentTurnEvaluation,
// agentChatThread, agentTurn, agentMessage).
//
// Mongo analogue: compound index on (workspaceId) per collection.
// Mongo does not have foreign keys; referential integrity is enforced at the
// application layer (cascade deletes on workspace removal).

import { connectToDatabase } from "@/lib/mongodb";

const INDEX_SPECS = [
  { collection: "sabcrm_applicationVariable",          indexName: "IDX_78ae6cfe5f49a76c4bf842ad58" },
  { collection: "sabcrm_indexFieldMetadata",           indexName: "IDX_d8cf7f15cf6466ac0e3b443b3d" },
  { collection: "sabcrm_twoFactorAuthenticationMethod",indexName: "IDX_b8282d1e10fbb7856950f86c61" },
  { collection: "sabcrm_agentMessagePart",             indexName: "IDX_70b398dc45219db8f3e36b3a07" },
  { collection: "sabcrm_agentTurnEvaluation",          indexName: "IDX_c81d8fabdda94b7fa86fb6f1e7" },
  { collection: "sabcrm_agentChatThread",              indexName: "IDX_3d097ed53841d80904ed02c837" },
  { collection: "sabcrm_agentTurn",                   indexName: "IDX_a4bb3c6176c2607693a6756ff6" },
  { collection: "sabcrm_agentMessage",                indexName: "IDX_75db4f2e80922078e8171ae130" },
] as const;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const { collection, indexName } of INDEX_SPECS) {
    await db.collection(collection).createIndex(
      { workspaceId: 1 },
      { name: indexName, background: true },
    );
  }
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const { collection, indexName } of INDEX_SPECS) {
    try {
      await db.collection(collection).dropIndex(indexName);
    } catch {
      // Index may not exist; ignore
    }
  }
}
