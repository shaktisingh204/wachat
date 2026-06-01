// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddWorkspaceIdToApplicationRegistration1772267875869
//
// Postgres DDL intent:
//   - Added `workspaceId` uuid column to `core.applicationRegistration`
//   - Deleted orphaned rows (workspaceId IS NULL)
//   - Made `workspaceId` NOT NULL
//   - Created index IDX_APPLICATION_REGISTRATION_WORKSPACE_ID
//   - Added FK → core.workspace(id) ON DELETE CASCADE
//
// MongoDB equivalent:
//   - Add regular index on `workspaceId` in `sabcrm_applicationRegistration`.
//   - Remove documents that have no `workspaceId` (orphan cleanup).
//   - Referential integrity (→ workspace) enforced at the application layer.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "AddWorkspaceIdToApplicationRegistration1772267875869";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_applicationRegistration");

  // Remove orphaned registrations that have no workspaceId
  await col.deleteMany({ workspaceId: { $exists: false } });
  await col.deleteMany({ workspaceId: null });

  // Create index
  await col.createIndex(
    { workspaceId: 1 },
    { name: "IDX_appReg_workspaceId" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_applicationRegistration")
    .dropIndex("IDX_appReg_workspaceId")
    .catch(() => {});

  await db
    .collection("sabcrm_applicationRegistration")
    .updateMany({}, { $unset: { workspaceId: "" } });
}
