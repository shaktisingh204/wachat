// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddIsListedToAppRegistration1772732588833
//
// Postgres DDL intent (on core.applicationRegistration):
//   - Added NOT NULL boolean `isListed` DEFAULT false
//   - Changed `workspaceId` from NOT NULL → nullable
//   - Re-pointed FK from CASCADE DELETE to SET NULL delete behaviour
//
// MongoDB equivalent:
//   - Seed `isListed: false` on existing documents missing the field.
//   - The workspaceId nullability change has no structural Mongo analogue
//     (fields are always nullable in Mongo documents).
//   - FK delete behaviour is enforced at the application layer.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME = "AddIsListedToAppRegistration1772732588833";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_applicationRegistration")
    .updateMany(
      { isListed: { $exists: false } },
      { $set: { isListed: false } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_applicationRegistration")
    .updateMany({}, { $unset: { isListed: "" } });
}
