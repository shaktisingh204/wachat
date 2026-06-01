import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that created
// compound indexes on `messageChannel` and `calendarChannel` tables:
//   (workspaceId, isSyncEnabled, syncStage)
// These indexes accelerate the channel sync worker queries.
//
// In MongoDB we create equivalent compound indexes on sabcrm_messagechannel
// and sabcrm_calendarchannel.

export const VERSION = '2.6.0';
export const TIMESTAMP = 1798000010000;

const MESSAGE_CHANNEL_INDEX_NAME =
  'IDX_MESSAGE_CHANNEL_WORKSPACE_ID_SYNC_ENABLED_SYNC_STAGE';
const CALENDAR_CHANNEL_INDEX_NAME =
  'IDX_CALENDAR_CHANNEL_WORKSPACE_ID_SYNC_ENABLED_SYNC_STAGE';

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  await db.collection('sabcrm_messagechannel').createIndex(
    { workspaceId: 1, isSyncEnabled: 1, syncStage: 1 },
    { name: MESSAGE_CHANNEL_INDEX_NAME },
  );

  await db.collection('sabcrm_calendarchannel').createIndex(
    { workspaceId: 1, isSyncEnabled: 1, syncStage: 1 },
    { name: CALENDAR_CHANNEL_INDEX_NAME },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection('sabcrm_calendarchannel')
    .dropIndex(CALENDAR_CHANNEL_INDEX_NAME)
    .catch(() => {});

  await db
    .collection('sabcrm_messagechannel')
    .dropIndex(MESSAGE_CHANNEL_INDEX_NAME)
    .catch(() => {});
}
