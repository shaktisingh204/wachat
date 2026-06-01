import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: FastInstanceCommand — transforms applicationVariable into a syncable entity by:
//   1. Dropping unique constraint IDX_APPLICATION_VARIABLE_KEY_APPLICATION_ID_UNIQUE
//   2. Dropping index IDX_78ae6cfe5f49a76c4bf842ad58 (on workspaceId)
//   3. Adding universalIdentifier (uuid) column
// Version: 2.3.0  Timestamp: 1777966965587

export interface TransformApplicationVariableToSyncableEntityMigration {
  version: "2.3.0";
  timestamp: 1777966965587;
  type: "fast";
  description: "Drop old unique/workspace indexes on applicationVariable and add universalIdentifier field";
}

/**
 * Mongo analogue:
 *
 * up:
 *   - Drop index IDX_APPLICATION_VARIABLE_KEY_APPLICATION_ID_UNIQUE (unique key+applicationId)
 *   - Drop index IDX_78ae6cfe5f49a76c4bf842ad58 (workspaceId)
 *   - Add universalIdentifier field (UUID, initially null — see slow command 1777966965588)
 *
 * down:
 *   - Drop universalIdentifier field
 *   - Re-create unique { key, applicationId } index
 *   - Re-create { workspaceId } index
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_applicationVariable");

  // Drop the old indexes (ignore error if they don't exist yet).
  try {
    await collection.dropIndex("IDX_APPLICATION_VARIABLE_KEY_APPLICATION_ID_UNIQUE");
  } catch {
    // Index may not exist.
  }

  try {
    await collection.dropIndex("IDX_78ae6cfe5f49a76c4bf842ad58");
  } catch {
    // Index may not exist.
  }

  // universalIdentifier is added implicitly in MongoDB; the slow command
  // (1777966965588) will backfill values.
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_applicationVariable");

  // Remove universalIdentifier from all documents.
  await collection.updateMany({}, { $unset: { universalIdentifier: "" } });

  // Re-create the dropped indexes.
  await collection.createIndex(
    { key: 1, applicationId: 1 },
    { unique: true, name: "IDX_APPLICATION_VARIABLE_KEY_APPLICATION_ID_UNIQUE" },
  );

  await collection.createIndex(
    { workspaceId: 1 },
    { name: "IDX_78ae6cfe5f49a76c4bf842ad58" },
  );
}
