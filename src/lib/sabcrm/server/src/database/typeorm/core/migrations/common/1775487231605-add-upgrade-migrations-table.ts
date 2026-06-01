// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   CREATE TABLE "core"."upgradeMigration" (
//     id uuid PK, name varchar NOT NULL, status varchar NOT NULL,
//     attempt integer DEFAULT 1, executedByVersion varchar NOT NULL,
//     createdAt TIMESTAMPTZ DEFAULT now(),
//     UNIQUE(name, attempt)
//   )
//
// Mongo equivalent: create sabcrm_upgradeMigration collection with a compound unique index.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export async function applyMigration1775487231605(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_upgradeMigration");

  // Compound unique index mirrors UNIQUE("name", "attempt").
  await col.createIndex(
    { name: 1, attempt: 1 },
    {
      unique: true,
      background: true,
      name: "UQ_upgrade_migration_name_attempt",
    },
  );
}

/** Reversal: drop the collection. */
export async function rollbackMigration1775487231605(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_upgradeMigration")
    .drop()
    .catch(() => undefined);
}
