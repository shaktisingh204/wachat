// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddLogoFileIdColumnOnWorkspaceTable1771323022170
//
// Postgres DDL intent:
//   - Added nullable column `logoFileId` (uuid) to `core.workspace`
//   - Added UNIQUE constraint on `logoFileId`
//   - Added FK to `core.file(id)` ON DELETE SET NULL
//
// MongoDB equivalent:
//   - The `sabcrm_workspace` collection document type should include:
//       logoFileId?: string | null   // reference to sabcrm_file._id (stored as string uuid)
//   - A sparse unique index on `logoFileId` enforces the uniqueness of the reference.
//   - Referential integrity (FK → file) is enforced at the application layer.
//
// Run this index creation once against your MongoDB instance when applying this migration:
//
//   db.getSiblingDB("sabcrm").sabcrm_workspace.createIndex(
//     { logoFileId: 1 },
//     { unique: true, sparse: true, name: "UQ_workspace_logoFileId" }
//   );

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "AddLogoFileIdColumnOnWorkspaceTable1771323022170";

/**
 * Applies the Mongo equivalent of this migration: creates a sparse unique index
 * on `logoFileId` in the `sabcrm_workspace` collection.
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_workspace")
    .createIndex(
      { logoFileId: 1 },
      { unique: true, sparse: true, name: "UQ_workspace_logoFileId" },
    );
}

/**
 * Reverses the migration by dropping the index.
 */
export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_workspace")
    .dropIndex("UQ_workspace_logoFileId")
    .catch(() => {
      // index may not exist — swallow
    });
}
