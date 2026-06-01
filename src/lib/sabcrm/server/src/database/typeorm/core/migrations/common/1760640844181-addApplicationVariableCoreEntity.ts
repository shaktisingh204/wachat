// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: creates core."applicationVariable" table with unique constraint on (key, applicationId), FK to application.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1760640844181 – AddApplicationVariableCoreEntity
 *
 * Postgres intent:
 *   UP:   CREATE TABLE core.applicationVariable (id uuid PK, key text NOT NULL, value text NOT NULL DEFAULT '',
 *           description text NOT NULL DEFAULT '', isSecret boolean NOT NULL DEFAULT false,
 *           applicationId uuid, createdAt timestamptz, updatedAt timestamptz,
 *           UNIQUE(key, applicationId), FK applicationId -> application(id) ON DELETE CASCADE);
 *   DOWN: DROP CONSTRAINT; DROP TABLE.
 *
 * Mongo equivalent:
 *   - New collection: sabcrm_applicationVariable
 *   - Unique compound index on { key, applicationId }
 *   - Index on { applicationId } for cascade-style lookups
 *   - Fields: key (string), value (string, default ""), description (string, default ""),
 *             isSecret (boolean, default false), applicationId (string, optional)
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_applicationVariable");

  await collection.createIndex(
    { key: 1, applicationId: 1 },
    {
      unique: true,
      sparse: true,
      name: "IDX_applicationVariable_key_applicationId_unique",
    },
  );

  await collection.createIndex(
    { applicationId: 1 },
    { name: "IDX_applicationVariable_applicationId" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("sabcrm_applicationVariable").drop();
}

export const migrationNote = {
  id: "1760640844181",
  name: "AddApplicationVariableCoreEntity",
  mongoEquivalent:
    "sabcrm_applicationVariable collection + unique index on { key, applicationId }",
} as const;
