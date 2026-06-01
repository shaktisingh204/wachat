// PORT-NOTE: Postgres DDL migration — adds a UNIQUE constraint across
// (workspaceId, applicationId, path) on "core"."file".
// In MongoDB this translates to a compound unique index on the
// sabcrm_file collection.
//
// Original Twenty migration: AddFileEntityUniqueConstraint1770032815802
//   UP:   ALTER TABLE "core"."file"
//           ADD CONSTRAINT "IDX_APPLICATION_PATH_WORKSPACE_ID_APPLICATION_ID_UNIQUE"
//           UNIQUE ("workspaceId", "applicationId", "path")
//   DOWN: ALTER TABLE "core"."file"
//           DROP CONSTRAINT "IDX_APPLICATION_PATH_WORKSPACE_ID_APPLICATION_ID_UNIQUE"
//
// Mongo equivalent — run once at startup or as a seed script:
//   db.sabcrm_file.createIndex(
//     { workspaceId: 1, applicationId: 1, path: 1 },
//     { unique: true, name: "IDX_APPLICATION_PATH_WORKSPACE_ID_APPLICATION_ID_UNIQUE", sparse: true }
//   )
//
// The index is marked sparse so that documents missing one of these fields
// (e.g. applicationId is null for workspace-level files) do not conflict.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/** Ensures the unique index exists on the sabcrm_file collection. */
export async function ensureFileUniqueIndex(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection("sabcrm_file").createIndex(
    { workspaceId: 1, applicationId: 1, path: 1 },
    {
      unique: true,
      sparse: true,
      name: "IDX_APPLICATION_PATH_WORKSPACE_ID_APPLICATION_ID_UNIQUE",
    },
  );
}

export const migrationNote = {
  id: '1770032815802',
  name: 'AddFileEntityUniqueConstraint',
  mongoAction: 'create-index',
  collections: ['sabcrm_file'],
  index: { workspaceId: 1, applicationId: 1, path: 1 },
  options: { unique: true, sparse: true },
} as const;
