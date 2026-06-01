// PORT-NOTE: Postgres DDL migration — adds package-management fields and FK
// constraints to "core"."application".
// In MongoDB (sabcrm_application) these map to new document fields. The FK
// constraints become application-level references (no DB-enforced FKs in Mongo).
// Unique constraints on packageJsonFileId and yarnLockFileId translate to
// sparse unique indexes.
//
// Original Twenty migration: AddApplicationPackageFields1770050100000
//   UP:
//     ADD "packageJsonChecksum" text
//     ADD "packageJsonFileId"   uuid  (UNIQUE)  → FK → core.file
//     ADD "yarnLockChecksum"    text
//     ADD "yarnLockFileId"      uuid  (UNIQUE)  → FK → core.file
//     ADD "availablePackages"   jsonb NOT NULL DEFAULT '{}'
//   DOWN: reverses all of the above
//
// Mongo equivalent indexes (run once):
//   db.sabcrm_application.createIndex(
//     { packageJsonFileId: 1 },
//     { unique: true, sparse: true, name: "UQ_3818380258798f9ffa9963b6dc4" }
//   )
//   db.sabcrm_application.createIndex(
//     { yarnLockFileId: 1 },
//     { unique: true, sparse: true, name: "UQ_28f20711184b3c3318a8e44d117" }
//   )
//
// New fields on the Application document type:
//   packageJsonChecksum?: string | null
//   packageJsonFileId?:   string | null   (ref sabcrm_file)
//   yarnLockChecksum?:    string | null
//   yarnLockFileId?:      string | null   (ref sabcrm_file)
//   availablePackages:    Record<string, string>  (default {})

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/** Ensures package-field indexes exist on sabcrm_application. */
export async function ensureApplicationPackageIndexes(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_application");
  await Promise.all([
    col.createIndex(
      { packageJsonFileId: 1 },
      { unique: true, sparse: true, name: "UQ_3818380258798f9ffa9963b6dc4" },
    ),
    col.createIndex(
      { yarnLockFileId: 1 },
      { unique: true, sparse: true, name: "UQ_28f20711184b3c3318a8e44d117" },
    ),
  ]);
}

export const migrationNote = {
  id: '1770050100000',
  name: 'AddApplicationPackageFields',
  mongoAction: 'field-add + create-index',
  collections: ['sabcrm_application'],
  fieldsAdded: [
    { name: 'packageJsonChecksum', type: 'string | null', default: null },
    { name: 'packageJsonFileId', type: 'string | null', default: null },
    { name: 'yarnLockChecksum', type: 'string | null', default: null },
    { name: 'yarnLockFileId', type: 'string | null', default: null },
    { name: 'availablePackages', type: 'Record<string,string>', default: {} },
  ],
  indexes: [
    { field: 'packageJsonFileId', unique: true, sparse: true },
    { field: 'yarnLockFileId', unique: true, sparse: true },
  ],
} as const;
