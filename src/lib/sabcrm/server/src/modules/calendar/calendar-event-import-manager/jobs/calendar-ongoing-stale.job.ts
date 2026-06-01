import 'server-only';

// PORT-NOTE: NestJS BullMQ @Processor/@Process decorators removed.
// PORT-NOTE: GlobalWorkspaceOrmManager replaced with a Mongo collection lookup.
// PORT-NOTE: CalendarChannelRepository (TypeORM) replaced with Mongo collection accessor.
// PORT-NOTE: CalendarChannelSyncStatusService injected via deps parameter.
// This function is the job handler — call it from your queue worker or cron handler.

import { CalendarChannelSyncStage } from '@/lib/sabcrm/shared/src/types/CalendarChannelSyncStage';
import { getCalendarChannelCollection } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';

export type CalendarOngoingStaleJobData = {
  workspaceId: string;
};

type SyncStatusService = {
  resetSyncStageStartedAt: (ids: string[], workspaceId: string) => Promise<void>;
  markAsCalendarEventListFetchPending: (ids: string[], workspaceId: string) => Promise<void>;
  markAsCalendarEventsImportPending: (ids: string[], workspaceId: string) => Promise<void>;
};

/** Returns true when the sync stage started more than 30 minutes ago (stale threshold). */
function isSyncStale(syncStageStartedAt: string | null): boolean {
  if (!syncStageStartedAt) return false;
  const STALE_THRESHOLD_MS = 30 * 60 * 1000;
  return Date.now() - new Date(syncStageStartedAt).getTime() > STALE_THRESHOLD_MS;
}

export async function handleCalendarOngoingStaleJob(
  data: CalendarOngoingStaleJobData,
  calendarChannelSyncStatusService: SyncStatusService,
): Promise<void> {
  const { workspaceId } = data;

  const collection = await getCalendarChannelCollection();

  const stageFilter = [
    CalendarChannelSyncStage.CALENDAR_EVENTS_IMPORT_ONGOING,
    CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_ONGOING,
    CalendarChannelSyncStage.CALENDAR_EVENTS_IMPORT_SCHEDULED,
    CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_SCHEDULED,
  ];

  const calendarChannels = await collection
    .find({ syncStage: { $in: stageFilter }, workspaceId })
    .toArray();

  for (const calendarChannel of calendarChannels) {
    const syncStageStartedAt = calendarChannel.syncStageStartedAt;

    if (isSyncStale(syncStageStartedAt?.toISOString() ?? null)) {
      await calendarChannelSyncStatusService.resetSyncStageStartedAt(
        [calendarChannel.id],
        workspaceId,
      );

      switch (calendarChannel.syncStage) {
        case CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_ONGOING:
        case CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_SCHEDULED:
          console.log(
            `Sync for calendar channel ${calendarChannel.id} and workspace ${workspaceId} is stale. Setting sync stage to CALENDAR_EVENT_LIST_FETCH_PENDING`,
          );
          await calendarChannelSyncStatusService.markAsCalendarEventListFetchPending(
            [calendarChannel.id],
            workspaceId,
          );
          break;
        case CalendarChannelSyncStage.CALENDAR_EVENTS_IMPORT_ONGOING:
        case CalendarChannelSyncStage.CALENDAR_EVENTS_IMPORT_SCHEDULED:
          console.log(
            `Sync for calendar channel ${calendarChannel.id} and workspace ${workspaceId} is stale. Setting sync stage to CALENDAR_EVENTS_IMPORT_PENDING`,
          );
          await calendarChannelSyncStatusService.markAsCalendarEventsImportPending(
            [calendarChannel.id],
            workspaceId,
          );
          break;
        default:
          break;
      }
    }
  }
}
