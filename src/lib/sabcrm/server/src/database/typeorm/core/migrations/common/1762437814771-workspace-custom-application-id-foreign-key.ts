// PORT-NOTE: pg-migration->mongo-index/seed
// Original: WorkspaceCustomApplicationIdForeignKey1762437814771
//
// This Postgres migration adds a foreign-key constraint from
// workspace.workspaceCustomApplicationId → application.id ON DELETE RESTRICT.
//
// Mongo equivalent: MongoDB has no declarative foreign keys.
// The referential integrity between sabcrm_workspace.workspaceCustomApplicationId
// and sabcrm_application._id must be enforced at the application layer.
//
// Application-layer note:
//   - Before deleting a document from sabcrm_application, verify that no
//     sabcrm_workspace document references it via workspaceCustomApplicationId.
//   - Consider adding a sparse index on workspaceCustomApplicationId to speed
//     up the reverse lookup:
//
//     db.sabcrm_workspace.createIndex(
//       { workspaceCustomApplicationId: 1 },
//       { sparse: true, name: 'IDX_WORKSPACE_CUSTOM_APPLICATION_ID' }
//     );

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1762437814771-workspace-custom-application-id-foreign-key';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('sabcrm_workspace').createIndex(
    { workspaceCustomApplicationId: 1 },
    { sparse: true, name: 'IDX_WORKSPACE_CUSTOM_APPLICATION_ID' },
  );
}
