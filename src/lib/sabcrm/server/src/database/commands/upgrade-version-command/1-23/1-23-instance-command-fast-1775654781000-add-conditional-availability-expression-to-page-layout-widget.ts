import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.23.0', 1775654781000) — pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."pageLayoutWidget"
//   ADD COLUMN IF NOT EXISTS "conditionalAvailabilityExpression" varchar
//
// Mongo analogue: backfill conditionalAvailabilityExpression = null for any
// existing documents that lack the field (Mongo is schema-less so new writes
// will already include the field). No index is needed for this optional column.

import { connectToDatabase } from "@/lib/mongodb";

export async function up(): Promise<void> {
  // PORT-NOTE: In Mongo, adding a nullable varchar column requires no DDL.
  // Documents without conditionalAvailabilityExpression naturally return
  // undefined. If you need explicit nulls in existing docs, run the backfill below.
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_pageLayoutWidget")
    .updateMany(
      { conditionalAvailabilityExpression: { $exists: false } },
      { $set: { conditionalAvailabilityExpression: null } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_pageLayoutWidget")
    .updateMany({}, { $unset: { conditionalAvailabilityExpression: "" } });
}
