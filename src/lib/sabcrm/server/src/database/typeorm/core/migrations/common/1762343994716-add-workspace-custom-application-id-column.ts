// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddWorkspaceCustomApplicationIdColumn1762343994716
//
// This Postgres migration:
//   1. Adds a nullable uuid column "workspaceCustomApplicationId" to "workspace".
//   2. Drops and recreates the unique partial index on application
//      (universalIdentifier, workspaceId) — this time with universalIdentifier
//      NOT NULL and a WHERE clause filtering out soft-deleted rows.
//
// Mongo equivalents:
//
// 1. The field "workspaceCustomApplicationId" is optional in sabcrm_workspace
//    documents — no action needed for existing documents (field defaults to
//    absent/undefined).
//
// 2. Re-create the partial unique index on sabcrm_application:

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1762343994716-add-workspace-custom-application-id-column';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();

  // Partial unique index: (universalIdentifier, workspaceId) where not deleted
  // and universalIdentifier is present — mirrors the Postgres partial index.
  await db.collection('sabcrm_application').createIndex(
    { universalIdentifier: 1, workspaceId: 1 },
    {
      unique: true,
      sparse: true, // skip docs where universalIdentifier is absent
      partialFilterExpression: {
        deletedAt: null,
        universalIdentifier: { $exists: true, $ne: null },
      },
      name: 'IDX_APPLICATION_UNIVERSAL_IDENTIFIER_WORKSPACE_ID_UNIQUE',
    },
  );
}
