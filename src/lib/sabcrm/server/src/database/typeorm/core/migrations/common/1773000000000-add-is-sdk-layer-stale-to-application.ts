// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddIsSdkLayerStaleToApplication1773000000000
//
// Postgres DDL intent:
//   - Added NOT NULL boolean `isSdkLayerStale` DEFAULT false to `core.application`
//
// MongoDB equivalent:
//   - The `sabcrm_application` collection document type gains:
//       isSdkLayerStale: boolean   // default: false
//   - Seed existing documents that are missing the field.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME = "AddIsSdkLayerStaleToApplication1773000000000";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_application")
    .updateMany(
      { isSdkLayerStale: { $exists: false } },
      { $set: { isSdkLayerStale: false } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_application")
    .updateMany({}, { $unset: { isSdkLayerStale: "" } });
}
