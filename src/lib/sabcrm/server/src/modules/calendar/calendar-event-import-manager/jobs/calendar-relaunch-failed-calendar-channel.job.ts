import 'server-only';

// PORT-NOTE: NestJS BullMQ @Processor/@Process decorators removed.
// PORT-NOTE: GlobalWorkspaceOrmManager replaced with a Mongo collection lookup + update.
// PORT-NOTE: CalendarChannelRepository (TypeORM) replaced with Mongo collection accessor.
// This function is the job handler — call it from your queue worker or cron handler.

import {
  CalendarChannelSyncStage,
} from '@/lib/sabcrm/shared/src/types/CalendarChannelSyncStage';
import { CalendarChannelSyncStatus } from '@/lib/sabcrm/shared/src/types/CalendarChannelSyncStatus';
import { getCalendarChannelCollection } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';

export type CalendarRelaunchFailedCalendarChannelJobData = {
  workspaceId: string;
  calendarChannelId: string;
};

export async function handleCalendarRelaunchFailedCalendarChannelJob(
  data: CalendarRelaunchFailedCalendarChannelJobData,
): Promise<void> {
  const { workspaceId, calendarChannelId } = data;

  const collection = await getCalendarChannelCollection();

  const calendarChannel = await collection.findOne({
    id: calendarChannelId,
    workspaceId,
  });

  if (
    !calendarChannel ||
    calendarChannel.syncStage !== CalendarChannelSyncStage.FAILED ||
    calendarChannel.syncStatus !== CalendarChannelSyncStatus.FAILED_UNKNOWN
  ) {
    return;
  }

  await collection.updateOne(
    { id: calendarChannelId, workspaceId },
    {
      $set: {
        syncStage: CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_PENDING,
        syncStatus: CalendarChannelSyncStatus.ACTIVE,
        throttleFailureCount: 0,
        syncStageStartedAt: null,
        updatedAt: new Date(),
      },
    },
  );
}
