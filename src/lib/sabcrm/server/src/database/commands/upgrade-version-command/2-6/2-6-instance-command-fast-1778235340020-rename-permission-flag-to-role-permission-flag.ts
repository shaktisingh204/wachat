import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that:
//   - Renamed the `permissionFlag` table to `rolePermissionFlag`
//   - Updated primary key, unique constraint names, and index names
//   - Re-created foreign-key constraints with new hash names
//
// In MongoDB the collection is renamed using renameCollection. Index names
// are dropped and recreated with the new naming convention. FK constraints
// have no MongoDB equivalent.
//
// Original SQL highlights:
//   ALTER TABLE "core"."permissionFlag" RENAME TO "rolePermissionFlag"
//   (+ constraint/index renames)

export const VERSION = '2.6.0';
export const TIMESTAMP = 1778235340020;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  const collections = await db
    .listCollections({ name: 'sabcrm_permissionflag' })
    .toArray();

  if (collections.length > 0) {
    // MongoDB rename: sabcrm_permissionflag -> sabcrm_rolepermissionflag
    // Note: the new permissionFlag syncable entity (timestamp 1778235340021)
    // will later create a fresh sabcrm_permissionflag collection.
    await db.collection('sabcrm_permissionflag').rename('sabcrm_rolepermissionflag');
  }

  // Re-create renamed indexes on sabcrm_rolepermissionflag
  const col = db.collection('sabcrm_rolepermissionflag');

  // Drop old index if present (original: IDX_PERMISSION_FLAG_ROLE_ID)
  await col.dropIndex('IDX_PERMISSION_FLAG_ROLE_ID').catch(() => {});
  await col.dropIndex('IDX_PERMISSION_FLAG_FLAG_ROLE_ID_UNIQUE').catch(() => {});
  await col.dropIndex('IDX_da8ffd3c24b4a819430a861067').catch(() => {});

  // Recreate with new names (original: IDX_ROLE_PERMISSION_FLAG_ROLE_ID etc.)
  await col.createIndex({ roleId: 1 }, { name: 'IDX_ROLE_PERMISSION_FLAG_ROLE_ID' });
  await col.createIndex(
    { flag: 1, roleId: 1 },
    { unique: true, name: 'IDX_ROLE_PERMISSION_FLAG_FLAG_ROLE_ID_UNIQUE' },
  );
  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, name: 'IDX_e4559ae0dba56e53714137c704' },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  const collections = await db
    .listCollections({ name: 'sabcrm_rolepermissionflag' })
    .toArray();

  if (collections.length > 0) {
    await db.collection('sabcrm_rolepermissionflag').rename('sabcrm_permissionflag');
  }

  const col = db.collection('sabcrm_permissionflag');

  await col.dropIndex('IDX_ROLE_PERMISSION_FLAG_ROLE_ID').catch(() => {});
  await col.dropIndex('IDX_ROLE_PERMISSION_FLAG_FLAG_ROLE_ID_UNIQUE').catch(() => {});
  await col.dropIndex('IDX_e4559ae0dba56e53714137c704').catch(() => {});

  await col.createIndex({ roleId: 1 }, { name: 'IDX_PERMISSION_FLAG_ROLE_ID' });
  await col.createIndex(
    { flag: 1, roleId: 1 },
    { unique: true, name: 'IDX_PERMISSION_FLAG_FLAG_ROLE_ID_UNIQUE' },
  );
  await col.createIndex(
    { workspaceId: 1, universalIdentifier: 1 },
    { unique: true, name: 'IDX_da8ffd3c24b4a819430a861067' },
  );
}
