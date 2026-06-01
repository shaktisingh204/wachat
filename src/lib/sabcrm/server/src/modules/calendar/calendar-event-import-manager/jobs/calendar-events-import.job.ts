import 'server-only';

// PORT-NOTE: NestJS BullMQ @Processor/@Process decorators removed.
// PORT-NOTE: GlobalWorkspaceOrmManager replaced with a Mongo collection lookup.
// PORT-NOTE: CalendarChannelRepository (TypeORM) replaced with Mongo collection accessor.
// This function is the job handler — call it from your queue worker or cron handler.

import { CalendarChannelSyncStage } from '@/lib/sabcrm/shared/src/types/CalendarChannelSyncStage';
import { getCalendarChannelCollection } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/entities/calendar-channel.entity';
import { processCalendarEventsImport } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/services/calendar-events-import.service';

export type CalendarEventsImportJobData = {
  calendarChannelId: string;
  workspaceId: string;
};

export async function handleCalendarEventsImportJob(
  data: CalendarEventsImportJobData,
  // Dependencies injected by the call-site (queue worker / cron handler)
  deps: Parameters<typeof processCalendarEventsImport>[2],
): Promise<void> {
  const { calendarChannelId, workspaceId } = data;

  const collection = await getCalendarChannelCollection();

  const calendarChannel = await collection.findOne({
    id: calendarChannelId,
    isSyncEnabled: true,
    workspaceId,
  });

  if (!calendarChannel?.isSyncEnabled) {
    return;
  }

  if (
    calendarChannel.syncStage !==
    CalendarChannelSyncStage.CALENDAR_EVENTS_IMPORT_SCHEDULED
  ) {
    return;
  }

  await processCalendarEventsImport(
    calendarChannel as Parameters<typeof processCalendarEventsImport>[0],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (calendarChannel as any).connectedAccount as Parameters<typeof processCalendarEventsImport>[1],
    deps,
  );
}
