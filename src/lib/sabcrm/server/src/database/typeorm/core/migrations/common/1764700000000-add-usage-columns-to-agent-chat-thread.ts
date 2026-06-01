// PORT-NOTE: pg-migration->mongo-index/seed
// Original PG migration adds the following columns to "core"."agentChatThread":
//   - totalInputTokens   integer NOT NULL DEFAULT 0
//   - totalOutputTokens  integer NOT NULL DEFAULT 0
//   - contextWindowTokens integer (nullable)
//   - totalInputCredits  bigint  NOT NULL DEFAULT 0
//   - totalOutputCredits bigint  NOT NULL DEFAULT 0
//
// Mongo analogue:
//   MongoDB documents are schema-less, so these fields are added by simply
//   writing them from application code. For documents that existed before
//   this change, a one-time seed / backfill is appropriate to set default
//   values so that downstream queries don't need to handle missing fields.
//
// Seed (run once):
//   db.sabcrm_agentChatThread.updateMany(
//     {
//       $or: [
//         { totalInputTokens:   { $exists: false } },
//         { totalOutputTokens:  { $exists: false } },
//         { totalInputCredits:  { $exists: false } },
//         { totalOutputCredits: { $exists: false } },
//       ]
//     },
//     {
//       $set: {
//         totalInputTokens:   0,
//         totalOutputTokens:  0,
//         totalInputCredits:  0,
//         totalOutputCredits: 0,
//       }
//     }
//   );
//   // contextWindowTokens is nullable — leave absent docs alone.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const migration1764700000000 = {
  name: "AddUsageColumnsToAgentChatThread1764700000000",
  description:
    "Backfills usage token/credit fields with defaults on existing sabcrm_agentChatThread documents.",

  up: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db.collection("sabcrm_agentChatThread").updateMany(
      {
        $or: [
          { totalInputTokens: { $exists: false } },
          { totalOutputTokens: { $exists: false } },
          { totalInputCredits: { $exists: false } },
          { totalOutputCredits: { $exists: false } },
        ],
      },
      {
        $set: {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalInputCredits: 0,
          totalOutputCredits: 0,
        },
      }
    );
    // contextWindowTokens is optional/nullable — no default backfill needed.
  },

  down: async (): Promise<void> => {
    const { db } = await connectToDatabase();
    await db.collection("sabcrm_agentChatThread").updateMany(
      {},
      {
        $unset: {
          totalInputTokens: "",
          totalOutputTokens: "",
          contextWindowTokens: "",
          totalInputCredits: "",
          totalOutputCredits: "",
        },
      }
    );
  },
};
