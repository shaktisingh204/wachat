// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   1. ALTER TABLE "core"."workspace" DROP COLUMN IF EXISTS "databaseUrl"
//   2. ALTER COLUMN "databaseSchema" DROP NOT NULL / DROP DEFAULT
//   3. UPDATE workspace SET databaseSchema = NULL WHERE databaseSchema = ''
//
// Mongo equivalent:
//   1. Unset databaseUrl from all workspace documents.
//   2. Null-out databaseSchema where it is an empty string.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export async function applyMigration1774688563000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_workspace");

  // Drop the databaseUrl field from all documents.
  await col.updateMany({}, { $unset: { databaseUrl: "" } });

  // Normalize empty string databaseSchema to null.
  await col.updateMany(
    { databaseSchema: "" },
    { $set: { databaseSchema: null } },
  );
}

/** Reversal: restore databaseUrl as empty string and replace null databaseSchema with ''. */
export async function rollbackMigration1774688563000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_workspace");

  await col.updateMany(
    { databaseSchema: null },
    { $set: { databaseSchema: "" } },
  );
  await col.updateMany(
    { databaseUrl: { $exists: false } },
    { $set: { databaseUrl: "" } },
  );
}
