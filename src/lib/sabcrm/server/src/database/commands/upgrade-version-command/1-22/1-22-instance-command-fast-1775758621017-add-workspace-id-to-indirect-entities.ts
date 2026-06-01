import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.22.0', 1775758621017) — pg-migration->mongo-index
// Original: ALTER TABLE "core"."<table>" ADD COLUMN IF NOT EXISTS "workspaceId" uuid
// for each table in TABLES.
//
// Mongo analogue: create a sparse index on workspaceId for each collection so
// queries that filter by workspaceId are efficient. Documents that already have
// the field are unaffected; new writes should supply the field at the
// application layer.

import { connectToDatabase } from "@/lib/mongodb";

const TABLES = [
  "applicationVariable",
  "indexFieldMetadata",
  "twoFactorAuthenticationMethod",
  "agentMessagePart",
  "agentTurnEvaluation",
  "agentChatThread",
  "agentTurn",
  "agentMessage",
] as const;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const table of TABLES) {
    await db.collection(`sabcrm_${table}`).createIndex(
      { workspaceId: 1 },
      { name: `IDX_${table}_workspaceId`, sparse: true, background: true },
    );
  }
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const table of TABLES) {
    try {
      await db.collection(`sabcrm_${table}`).dropIndex(`IDX_${table}_workspaceId`);
    } catch {
      // Index may not exist; ignore
    }
  }
}
