import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that:
//   - Added a nullable `permissionFlagId` uuid column to `rolePermissionFlag`
//   - Added a UNIQUE constraint on (permissionFlagId, roleId)
//   - Created an index on permissionFlagId
//   - Added a FK -> permissionFlag(id) ON DELETE CASCADE
//
// In MongoDB we add the field (schemaless — no DDL needed) and create
// the equivalent indexes. FK constraints have no MongoDB equivalent.

export const VERSION = '2.6.0';
export const TIMESTAMP = 1778235340022;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_rolepermissionflag');

  // Unique index on (permissionFlagId, roleId)
  await col.createIndex(
    { permissionFlagId: 1, roleId: 1 },
    {
      unique: true,
      sparse: true,
      name: 'IDX_ROLE_PERMISSION_FLAG_PERMISSION_FLAG_ID_ROLE_ID_UNIQUE',
    },
  );

  // Index on permissionFlagId
  await col.createIndex(
    { permissionFlagId: 1 },
    { name: 'IDX_ROLE_PERMISSION_FLAG_PERMISSION_FLAG_ID' },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_rolepermissionflag');

  await col
    .dropIndex('IDX_ROLE_PERMISSION_FLAG_PERMISSION_FLAG_ID')
    .catch(() => {});
  await col
    .dropIndex('IDX_ROLE_PERMISSION_FLAG_PERMISSION_FLAG_ID_ROLE_ID_UNIQUE')
    .catch(() => {});

  // Remove permissionFlagId field from all documents
  await col.updateMany({}, { $unset: { permissionFlagId: '' } });
}
