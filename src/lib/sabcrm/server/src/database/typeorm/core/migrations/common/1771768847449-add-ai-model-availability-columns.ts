// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddAiModelAvailabilityColumns1771768847449
//
// Postgres DDL intent:
//   Added the following NOT NULL columns with defaults to `core.workspace`:
//     - autoEnableNewAiModels  boolean  DEFAULT true
//     - disabledAiModelIds     varchar[] DEFAULT '{}'
//     - enabledAiModelIds      varchar[] DEFAULT '{}'
//
// MongoDB equivalent:
//   - The `sabcrm_workspace` collection document type gains three new fields:
//       autoEnableNewAiModels: boolean       // default: true
//       disabledAiModelIds:    string[]      // default: []
//       enabledAiModelIds:     string[]      // default: []
//   - Seed existing documents that are missing these fields.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "AddAiModelAvailabilityColumns1771768847449";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("sabcrm_workspace").updateMany(
    {
      $or: [
        { autoEnableNewAiModels: { $exists: false } },
        { disabledAiModelIds: { $exists: false } },
        { enabledAiModelIds: { $exists: false } },
      ],
    },
    {
      $set: {
        autoEnableNewAiModels: true,
        disabledAiModelIds: [],
        enabledAiModelIds: [],
      },
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_workspace")
    .updateMany(
      {},
      { $unset: { autoEnableNewAiModels: "", disabledAiModelIds: "", enabledAiModelIds: "" } },
    );
}
