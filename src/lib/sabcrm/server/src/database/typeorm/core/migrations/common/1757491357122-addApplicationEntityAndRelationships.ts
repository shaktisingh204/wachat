// PORT-NOTE: pg-migration->mongo-index/seed
// Original: AddApplicationEntityAndRelationships1757491357122
// Postgres:
//   - Creates "core"."application" table with workspaceId FK and unique
//     (standardId, workspaceId) index when deletedAt IS NULL.
//   - Adds "applicationId" column to "core"."agent" with FK to application.
//
// In MongoDB:
//   up:   Create indexes on sabcrm_application and add a note for the agent relation.
//   down: Drop those indexes.

import 'server-only';
import { connectToDatabase } from '@/lib/mongodb';

export const up = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  // sabcrm_application indexes
  await db.collection('sabcrm_application').createIndexes([
    { key: { workspaceId: 1 }, name: 'IDX_APPLICATION_WORKSPACE_ID' },
    {
      key: { standardId: 1, workspaceId: 1 },
      unique: true,
      sparse: true,
      name: 'IDX_APPLICATION_STANDARD_ID_WORKSPACE_ID_UNIQUE',
    },
  ]);

  // sabcrm_agent: index on applicationId (FK equivalent)
  await db.collection('sabcrm_agent').createIndexes([
    { key: { applicationId: 1 }, sparse: true, name: 'IDX_AGENT_APPLICATION_ID' },
  ]);
};

export const down = async (): Promise<void> => {
  const { db } = await connectToDatabase();

  await db
    .collection('sabcrm_application')
    .dropIndex('IDX_APPLICATION_WORKSPACE_ID')
    .catch(() => undefined);

  await db
    .collection('sabcrm_application')
    .dropIndex('IDX_APPLICATION_STANDARD_ID_WORKSPACE_ID_UNIQUE')
    .catch(() => undefined);

  await db
    .collection('sabcrm_agent')
    .dropIndex('IDX_AGENT_APPLICATION_ID')
    .catch(() => undefined);

  // PORT-NOTE: We do NOT unset applicationId from agent documents here because
  // MongoDB is schema-flexible and the field may be used by application code.
};

export const migrationName =
  'AddApplicationEntityAndRelationships1757491357122';
