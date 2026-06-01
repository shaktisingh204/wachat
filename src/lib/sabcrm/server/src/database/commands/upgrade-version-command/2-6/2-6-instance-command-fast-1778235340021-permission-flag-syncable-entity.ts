import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that created a
// new `permissionFlag` table in the `core` schema (after the rename migration
// freed the name), with associated indexes and FK constraints referencing
// `workspace` and `application`.
//
// In MongoDB we ensure the sabcrm_permissionflag collection exists (implicit
// on first insert) and create the equivalent indexes. FK constraints have no
// MongoDB equivalent.
//
// Original SQL highlights:
//   CREATE TABLE "core"."permissionFlag" (id, workspaceId, applicationId,
//     universalIdentifier, key, label, description, icon, permissionType,
//     createdAt, updatedAt, UNIQUE(key, workspaceId))
//   CREATE INDEX "IDX_PERMISSION_FLAG_APPLICATION_ID" (applicationId)
//   CREATE UNIQUE INDEX "IDX_da8ffd3c24b4a819430a861067" (workspaceId, universalIdentifier)
//   FK -> workspace, application

export const VERSION = '2.6.0';
export const TIMESTAMP = 1778235340021;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_permissionflag');

  // Unique index on (key, workspaceId) — equivalent to the table UNIQUE constraint
  await col.createIndex(
    { key: 1, workspaceId: 1 },
    { unique: true, name: 'IDX_PERMISSION_FLAG_KEY_WORKSPACE_ID_UNIQUE' },
  );

  // Index on applicationId
  await col.createIndex(
    { applicationId: 1 },
    { name: 'IDX_PERMISSION_FLAG_APPLICATION_ID' },
  );

  // Unique index on (workspaceId, universalIdentifier) — canonical hash name preserved
  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, name: 'IDX_da8ffd3c24b4a819430a861067' },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const collections = await db
    .listCollections({ name: 'sabcrm_permissionflag' })
    .toArray();

  if (collections.length > 0) {
    await db.collection('sabcrm_permissionflag').drop();
  }
}
