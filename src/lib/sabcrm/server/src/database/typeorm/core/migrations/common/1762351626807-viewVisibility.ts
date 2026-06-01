// PORT-NOTE: pg-migration->mongo-index/seed
// Original: ViewVisibility1762351626807
//
// This Postgres migration:
//   1. Creates "view_visibility_enum" AS ENUM('WORKSPACE', 'UNLISTED').
//   2. Adds "visibility" NOT NULL DEFAULT 'WORKSPACE' to the "view" table.
//   3. Adds nullable "createdByUserWorkspaceId" uuid to the "view" table.
//   4. Creates an index on "visibility".
//   5. Adds a FK from "createdByUserWorkspaceId" to "userWorkspace"("id").
//
// Mongo equivalents:

import "server-only";
import { connectToDatabase } from '@/lib/mongodb';

export const migrationId = '1762351626807-viewVisibility';

/** Valid visibility values for sabcrm_view documents. */
export type ViewVisibility = 'WORKSPACE' | 'UNLISTED';

/** Apply the Mongo-equivalent of this migration (idempotent). */
export async function applyMongoMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const views = db.collection('sabcrm_view');

  // Back-fill: set default visibility on documents that lack it
  await views.updateMany(
    { visibility: { $exists: false } },
    { $set: { visibility: 'WORKSPACE' as ViewVisibility } },
  );

  // Index on visibility for filtering
  await views.createIndex(
    { visibility: 1 },
    { name: 'IDX_VIEW_VISIBILITY' },
  );

  // Index on createdByUserWorkspaceId (nullable, sparse)
  await views.createIndex(
    { createdByUserWorkspaceId: 1 },
    { sparse: true, name: 'IDX_VIEW_CREATED_BY_USER_WORKSPACE_ID' },
  );
}
