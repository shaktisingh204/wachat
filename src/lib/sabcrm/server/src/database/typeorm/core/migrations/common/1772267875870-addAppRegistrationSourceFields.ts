// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddAppRegistrationSourceFields1772267875870
//
// Postgres DDL intent (all on core.applicationRegistration):
//   - sourceType          text  NOT NULL DEFAULT 'local'
//   - sourcePackage       text  NULLABLE
//   - tarballFileId       uuid  NULLABLE, UNIQUE, FK → core.file(id) ON DELETE SET NULL
//   - latestAvailableVersion text NULLABLE
//   - isFeatured          boolean NOT NULL DEFAULT false
//   - marketplaceDisplayData jsonb NULLABLE
//   - CHECK: sourceType <> 'npm' OR sourcePackage IS NOT NULL
//
// MongoDB equivalent:
//   - Seed missing fields on existing documents.
//   - Create a sparse unique index for tarballFileId.
//   - The npm/sourcePackage check constraint is enforced at the application layer.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME = "AddAppRegistrationSourceFields1772267875870";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_applicationRegistration");

  // Seed NOT NULL fields with defaults for existing documents
  await col.updateMany(
    {
      $or: [
        { sourceType: { $exists: false } },
        { isFeatured: { $exists: false } },
      ],
    },
    {
      $set: {
        sourceType: "local",
        isFeatured: false,
      },
    },
  );

  // Sparse unique index on tarballFileId (referencing sabcrm_file)
  await col.createIndex(
    { tarballFileId: 1 },
    {
      unique: true,
      sparse: true,
      name: "UQ_appReg_tarballFileId",
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_applicationRegistration");

  await col.dropIndex("UQ_appReg_tarballFileId").catch(() => {});

  await col.updateMany(
    {},
    {
      $unset: {
        sourceType: "",
        sourcePackage: "",
        tarballFileId: "",
        latestAvailableVersion: "",
        isFeatured: "",
        marketplaceDisplayData: "",
      },
    },
  );
}
