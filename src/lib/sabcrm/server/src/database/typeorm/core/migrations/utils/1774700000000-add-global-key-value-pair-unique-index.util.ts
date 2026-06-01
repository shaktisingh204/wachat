// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: add-global-key-value-pair-unique-index
// This migration adds a conditional unique index in Postgres:
//   CREATE UNIQUE INDEX "IDX_KEY_VALUE_PAIR_KEY_NULL_USER_ID_NULL_WORKSPACE_ID_UNIQUE"
//     ON core.keyValuePair ("key")
//     WHERE "userId" IS NULL AND "workspaceId" IS NULL
//
// Mongo equivalent: a partial unique index on { key: 1 } where userId and workspaceId are null.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * Ensures a partial unique index on sabcrm_keyvaluepair.key for global (user/workspace-unscoped)
 * key-value pairs, mirroring the Postgres conditional unique index.
 */
export async function ensureGlobalKeyValuePairUniqueIndex(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_keyvaluepair");

  // Drop existing index if present to allow idempotent re-creation
  try {
    await col.dropIndex("IDX_keyValuePair_global_key_unique");
  } catch {
    // Index may not exist yet — safe to ignore
  }

  await col.createIndex(
    { key: 1 },
    {
      unique: true,
      partialFilterExpression: { userId: null, workspaceId: null },
      name: "IDX_keyValuePair_global_key_unique",
    }
  );
}
