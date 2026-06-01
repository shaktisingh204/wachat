// PORT-NOTE: pg-migration->mongo-index/seed
// Original: creates a partial unique index on keyValuePair WHERE userId IS NULL AND workspaceId IS NULL.
// Mongo equivalent: create a partial unique index on (key) filtered to docs where
// userId is null/absent AND workspaceId is null/absent.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Creates a unique index for global (no user, no workspace) key-value pair entries. */
export async function applyMigration1774700000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_keyValuePair");

  // Mirrors "IDX_KEY_VALUE_PAIR_KEY_NULL_USER_ID_NULL_WORKSPACE_ID_UNIQUE"
  await col.createIndex(
    { key: 1 },
    {
      unique: true,
      background: true,
      name: "IDX_KEY_VALUE_PAIR_KEY_NULL_USER_ID_NULL_WORKSPACE_ID_UNIQUE",
      partialFilterExpression: {
        userId: null,
        workspaceId: null,
      },
    },
  );
}

/** Reversal: drop the partial unique index. */
export async function rollbackMigration1774700000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_keyValuePair");
  await col
    .dropIndex("IDX_KEY_VALUE_PAIR_KEY_NULL_USER_ID_NULL_WORKSPACE_ID_UNIQUE")
    .catch(() => undefined);
}
