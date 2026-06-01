// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddUseRecommendedModels1771840510112
//
// Postgres DDL intent:
//   - Added NOT NULL boolean column `useRecommendedModels` with DEFAULT true
//     to `core.workspace`
//
// MongoDB equivalent:
//   - The `sabcrm_workspace` collection document type gains:
//       useRecommendedModels: boolean   // default: true
//   - Seed existing documents that are missing the field.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME = "AddUseRecommendedModels1771840510112";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_workspace")
    .updateMany(
      { useRecommendedModels: { $exists: false } },
      { $set: { useRecommendedModels: true } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_workspace")
    .updateMany({}, { $unset: { useRecommendedModels: "" } });
}
