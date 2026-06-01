// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddUsesSdkClientToFrontComponent1773100000000
//
// Postgres DDL intent:
//   - Added NOT NULL boolean `usesSdkClient` DEFAULT false to `core.frontComponent`
//
// MongoDB equivalent:
//   - The `sabcrm_frontComponent` collection document type gains:
//       usesSdkClient: boolean   // default: false
//   - Seed existing documents that are missing the field.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "AddUsesSdkClientToFrontComponent1773100000000";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_frontComponent")
    .updateMany(
      { usesSdkClient: { $exists: false } },
      { $set: { usesSdkClient: false } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_frontComponent")
    .updateMany({}, { $unset: { usesSdkClient: "" } });
}
