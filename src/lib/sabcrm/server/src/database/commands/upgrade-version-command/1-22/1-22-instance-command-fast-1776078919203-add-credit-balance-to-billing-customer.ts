import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.22.0', 1776078919203) — pg-migration->mongo-index/seed
// Original: ALTER TABLE "core"."billingCustomer"
//   ADD COLUMN IF NOT EXISTS "creditBalanceMicro" bigint NOT NULL DEFAULT 0
//
// Mongo analogue: backfill creditBalanceMicro = 0 for all documents in
// sabcrm_billingCustomer that do not yet have the field.

import { connectToDatabase } from "@/lib/mongodb";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  // Check if collection exists
  const collections = await db
    .listCollections({ name: "sabcrm_billingCustomer" })
    .toArray();

  if (collections.length === 0) {
    // Collection does not exist; nothing to do
    return;
  }

  // Backfill default value for existing documents
  await db
    .collection("sabcrm_billingCustomer")
    .updateMany(
      { creditBalanceMicro: { $exists: false } },
      { $set: { creditBalanceMicro: 0 } },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  const collections = await db
    .listCollections({ name: "sabcrm_billingCustomer" })
    .toArray();

  if (collections.length === 0) {
    return;
  }

  // Remove the field from all documents (reverse of up)
  await db
    .collection("sabcrm_billingCustomer")
    .updateMany({}, { $unset: { creditBalanceMicro: "" } });
}
