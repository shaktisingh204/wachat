// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   ALTER TABLE "core"."upgradeMigration" ADD "isInitial" boolean NOT NULL DEFAULT false
//
// Mongo equivalent: seed isInitial=false on existing documents that lack the field.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export async function applyMigration1775909335324(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_upgradeMigration");

  // Default existing docs to isInitial=false (mirrors Postgres DEFAULT false).
  await col.updateMany(
    { isInitial: { $exists: false } },
    { $set: { isInitial: false } },
  );
}

/** Reversal: unset isInitial from all documents. */
export async function rollbackMigration1775909335324(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_upgradeMigration");
  await col.updateMany({}, { $unset: { isInitial: "" } });
}
