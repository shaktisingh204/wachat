// PORT-NOTE: pg-migration->mongo-index/seed
// Original: DELETE FROM "core"."keyValuePair"
//           WHERE "key" IN ('DEFAULT_AI_SPEED_MODEL_ID', 'DEFAULT_AI_PERFORMANCE_MODEL_ID')
//             AND "type" = 'CONFIG_VARIABLE' AND "userId" IS NULL AND "workspaceId" IS NULL
//
// Mongo equivalent: remove matching documents from sabcrm_keyValuePair.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Removes legacy global AI model key-value config entries. */
export async function applyMigration1774000000000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_keyValuePair");

  await col.deleteMany({
    key: {
      $in: ["DEFAULT_AI_SPEED_MODEL_ID", "DEFAULT_AI_PERFORMANCE_MODEL_ID"],
    },
    type: "CONFIG_VARIABLE",
    userId: null,
    workspaceId: null,
  });
}

/**
 * Reversal: no-op.
 * Legacy keys are not restored — they are superseded by AI_MODEL_PREFERENCES.
 */
export async function rollbackMigration1774000000000(): Promise<void> {
  // No action needed.
}
