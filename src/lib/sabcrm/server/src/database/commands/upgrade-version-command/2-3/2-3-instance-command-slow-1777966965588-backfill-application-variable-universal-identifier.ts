import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { randomUUID } from "crypto";

// PORT-NOTE: SlowInstanceCommand — backfills universalIdentifier on applicationVariable,
// removes rows without applicationId, and makes applicationId + universalIdentifier NOT NULL.
// Version: 2.3.0  Timestamp: 1777966965588

export interface BackfillApplicationVariableUniversalIdentifierMigration {
  version: "2.3.0";
  timestamp: 1777966965588;
  type: "slow";
  description: "Delete applicationVariable rows with null applicationId, backfill universalIdentifier UUIDs, enforce NOT NULL + unique index";
}

/**
 * Mongo data migration:
 *
 * 1. Delete documents where applicationId is null/missing.
 * 2. Assign a random UUID to any document missing universalIdentifier.
 * 3. Create unique index on { workspaceId, universalIdentifier }.
 *
 * The Postgres NOT NULL constraints have no Mongo DDL equivalent — enforce
 * them via the TypeScript type (applicationId: string, universalIdentifier: string).
 */
export async function runDataMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_applicationVariable");

  // Step 1: Remove documents without applicationId.
  await collection.deleteMany({
    $or: [{ applicationId: null }, { applicationId: { $exists: false } }],
  });

  // Step 2: Backfill universalIdentifier for remaining documents that lack it.
  const cursor = collection.find({
    $or: [
      { universalIdentifier: null },
      { universalIdentifier: { $exists: false } },
    ],
  });

  for await (const doc of cursor) {
    await collection.updateOne(
      { _id: doc._id },
      { $set: { universalIdentifier: randomUUID() } },
    );
  }
}

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_applicationVariable");

  // Create unique index on { workspaceId, universalIdentifier }.
  await collection.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, name: "IDX_44ecebdf70cbed17f89527b36b" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_applicationVariable");

  try {
    await collection.dropIndex("IDX_44ecebdf70cbed17f89527b36b");
  } catch {
    // Index may not exist.
  }
}
