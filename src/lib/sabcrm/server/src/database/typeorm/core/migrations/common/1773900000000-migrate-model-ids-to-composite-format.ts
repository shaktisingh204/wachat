// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. UPDATE workspace SET fastModel='default-fast-model', smartModel='default-smart-model'
//      WHERE they differ from the placeholder.
//   2. UPDATE workspace SET disabledAiModelIds='{}', enabledAiModelIds='{}'
//      WHERE those arrays are non-empty.
//   3. UPDATE agent SET modelId='default-smart-model' WHERE modelId differs.
//
// Mongo equivalent: update the sabcrm_workspace and sabcrm_agent collections accordingly.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Resets AI model IDs to auto-select placeholders across workspace and agent documents. */
export async function applyMigration1773900000000(): Promise<void> {
  const { db } = await connectToDatabase();

  const workspaceCol = db.collection("sabcrm_workspace");
  const agentCol = db.collection("sabcrm_agent");

  // Reset model columns to auto-select placeholders.
  await workspaceCol.updateMany(
    {
      $or: [
        { fastModel: { $ne: "default-fast-model" } },
        { smartModel: { $ne: "default-smart-model" } },
      ],
    },
    {
      $set: {
        fastModel: "default-fast-model",
        smartModel: "default-smart-model",
      },
    },
  );

  // Clear per-workspace AI model allow/deny lists.
  await workspaceCol.updateMany(
    {
      $or: [
        { disabledAiModelIds: { $exists: true, $not: { $size: 0 } } },
        { enabledAiModelIds: { $exists: true, $not: { $size: 0 } } },
      ],
    },
    { $set: { disabledAiModelIds: [], enabledAiModelIds: [] } },
  );

  // Reset agent model IDs to the smart-model placeholder.
  await agentCol.updateMany(
    { modelId: { $ne: "default-smart-model" } },
    { $set: { modelId: "default-smart-model" } },
  );
}

/** Reversal: no-op — auto-select placeholders are safe to leave in place. */
export async function rollbackMigration1773900000000(): Promise<void> {
  // No action needed.
}
