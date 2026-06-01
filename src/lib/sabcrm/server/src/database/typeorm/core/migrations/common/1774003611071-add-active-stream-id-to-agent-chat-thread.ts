// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."agentChatThread" ADD "activeStreamId" character varying
// Mongo equivalent: no DDL needed; documents in sabcrm_agentChatThread can store
// an optional "activeStreamId" string field once the app layer writes it.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * No-op in Mongo: adding a nullable varchar field requires no schema change.
 * A sparse index is created so active-stream lookups remain efficient.
 */
export async function applyMigration1774003611071(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_agentChatThread");

  await col.createIndex(
    { activeStreamId: 1 },
    {
      sparse: true,
      background: true,
      name: "idx_agentChatThread_activeStreamId",
    },
  );
}

/** Reversal: drop the sparse index. */
export async function rollbackMigration1774003611071(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_agentChatThread");
  await col
    .dropIndex("idx_agentChatThread_activeStreamId")
    .catch(() => undefined);
}
