import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// The original runs Postgres DDL (DELETE duplicates + CREATE UNIQUE INDEX) on core.keyValuePair.
// In Mongo we create an equivalent unique sparse index on sabcrm_key_value_pair.
// Deduplication logic is also ported to Mongo aggregation.

import { connectToDatabase } from "@/lib/mongodb";

export type AddGlobalKeyValuePairUniqueIndexOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

/**
 * Workspace command: 1.21.0 / 1775500002000
 * Deduplicate global keyValuePair rows (userId IS NULL, workspaceId IS NULL)
 * and add a unique index on (key, userId, workspaceId) with null equality.
 *
 * Runs once across all workspaces (guarded by hasRunOnce in the original).
 */
let hasRunOnce = false;

export async function addGlobalKeyValuePairUniqueIndex(
  options: AddGlobalKeyValuePairUniqueIndexOptions,
): Promise<void> {
  const { dryRun = false } = options;

  if (hasRunOnce) {
    return;
  }

  if (dryRun) {
    hasRunOnce = true;
    return;
  }

  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_key_value_pair");

  // Deduplicate: for each key where userId IS NULL and workspaceId IS NULL,
  // keep the most recently updated document and remove the rest.
  const duplicates = await col
    .aggregate<{ _id: string; ids: string[] }>([
      {
        $match: { userId: null, workspaceId: null },
      },
      {
        $sort: { updatedAt: -1, createdAt: -1, id: -1 },
      },
      {
        $group: {
          _id: "$key",
          ids: { $push: "$id" },
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ])
    .toArray();

  for (const group of duplicates) {
    const [, ...toRemove] = group.ids;
    if (toRemove.length > 0) {
      await col.deleteMany({ id: { $in: toRemove } });
    }
  }

  // Create unique sparse index: only one global row per key where both
  // userId and workspaceId are null.
  await col.createIndex(
    { key: 1, userId: 1, workspaceId: 1 },
    {
      unique: true,
      sparse: true,
      name: "IDX_KVP_GLOBAL_KEY_UNIQUE",
      partialFilterExpression: { userId: null, workspaceId: null },
    },
  );

  console.log("Successfully run addGlobalKeyValuePairUniqueIndex");
  hasRunOnce = true;
}
