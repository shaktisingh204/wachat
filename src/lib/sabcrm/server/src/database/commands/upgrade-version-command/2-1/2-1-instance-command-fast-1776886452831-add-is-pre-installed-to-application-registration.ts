import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('2.1.0', 1776886452831) — pg-migration->mongo-index/seed
// Original:
//   up:   ALTER TABLE "core"."applicationRegistration"
//           ADD "isPreInstalled" boolean NOT NULL DEFAULT false
//   down: ALTER TABLE "core"."applicationRegistration"
//           DROP COLUMN "isPreInstalled"
//
// Mongo analogue:
//   up:   backfill isPreInstalled = false on all existing sabcrm_applicationRegistration
//         documents that lack the field (mirrors DEFAULT false).
//   down: $unset the field from all documents.

import { connectToDatabase } from "@/lib/mongodb";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_applicationRegistration")
    .updateMany(
      { isPreInstalled: { $exists: false } },
      { $set: { isPreInstalled: false } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_applicationRegistration")
    .updateMany({}, { $unset: { isPreInstalled: "" } });
}
