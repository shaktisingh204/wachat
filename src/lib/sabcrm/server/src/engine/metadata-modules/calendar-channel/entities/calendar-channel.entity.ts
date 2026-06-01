import 'server-only';

import { Collection, Document, ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import {
  CalendarChannelContactAutoCreationPolicy,
  CalendarChannelSyncStage,
  CalendarChannelSyncStatus,
  CalendarChannelVisibility,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto';

// Mongo document type for the calendarChannel collection.
export type CalendarChannelDocument = {
  _id?: ObjectId;
  /** UUID primary key (mirrors Postgres uuid column) */
  id: string;
  handle: string;
  syncStatus: CalendarChannelSyncStatus;
  syncStage: CalendarChannelSyncStage;
  visibility: CalendarChannelVisibility;
  isContactAutoCreationEnabled: boolean;
  contactAutoCreationPolicy: CalendarChannelContactAutoCreationPolicy;
  isSyncEnabled: boolean;
  syncCursor: string | null;
  syncedAt: Date | null;
  syncStageStartedAt: Date | null;
  throttleFailureCount: number;
  /** Relation id ref to connectedAccount document */
  connectedAccountId: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
};

// Mongo index definitions (translated from TypeORM @Index):
// IDX_CALENDAR_CHANNEL_WORKSPACE_ID_SYNC_ENABLED_SYNC_STAGE:
//   { workspaceId: 1, isSyncEnabled: 1, syncStage: 1 }
// These are created by the db-init/migration scripts — kept here for documentation.

const COLLECTION_NAME = 'sabcrm_calendar_channel';

export async function getCalendarChannelCollection(): Promise<Collection<CalendarChannelDocument & Document>> {
  const db = await connectToDatabase();
  return db.collection<CalendarChannelDocument & Document>(COLLECTION_NAME);
}
