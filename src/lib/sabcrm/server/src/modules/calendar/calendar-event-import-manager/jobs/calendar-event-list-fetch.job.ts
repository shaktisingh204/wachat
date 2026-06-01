import 'server-only';

// PORT-NOTE: NestJS BullMQ @Processor/@Process decorators removed.
// PORT-NOTE: GlobalWorkspaceOrmManager replaced with a Mongo collection lookup.
// PORT-NOTE: CalendarChannelRepository (TypeORM) replaced with Mongo collection accessor.
// This function is the job handler — call it from your queue worker or cron handler.

import { CalendarChannelSyncStage } from '@/lib/sabcrm/shared/src/types/CalendarChannelSyncStage';
import { getCalendarChannelCollection } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';
import { fetchCalendarEvents } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/services/calendar-fetch-events.service';

export type CalendarEventListFetchJobData = {
  calendarChannelId: string;
  workspaceId: string;
};

export async function handleCalendarEventListFetchJob(
  data: CalendarEventListFetchJobData,
  // Dependencies injected by the call-site (queue worker / cron handler)
  deps: Parameters<typeof fetchCalendarEvents>[2],
): Promise<void> {
  const { workspaceId, calendarChannelId } = data;

  const collection = await getCalendarChannelCollection();

  const calendarChannel = await collection.findOne({
    id: calendarChannelId,
    isSyncEnabled: true,
    workspaceId,
  });

  if (!calendarChannel) {
    return;
  }

  if (
    calendarChannel.syncStage !==
    CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_SCHEDULED
  ) {
    return;
  }

  // connectedAccount is embedded on the channel or fetched by the call-site.
  // PORT-NOTE: relation loading (`relations: ['connectedAccount']`) must be done
  // by the call-site before passing the channel here when connectedAccount is separate.
  await fetchCalendarEvents(
    calendarChannel as Parameters<typeof fetchCalendarEvents>[0],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (calendarChannel as any).connectedAccount as Parameters<typeof fetchCalendarEvents>[1],
    deps,
  );
}
