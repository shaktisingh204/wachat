// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/calendar-event-cleaner/listeners/calendar-event-cleaner-calendar-channel.listener.ts
// NestJS event listener converted to plain exported functions.

import "server-only";

import {
  handleCalendarChannelDeletionCleanup,
  type CalendarChannelDeletionCleanupJobData,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-cleaner/jobs/calendar-channel-deletion-cleanup.job";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ObjectRecordDeleteEvent = {
  recordId: string;
};

export type WorkspaceEventBatch<T> = {
  workspaceId: string;
  events: T[];
};

// ---------------------------------------------------------------------------
// Listener function
// ---------------------------------------------------------------------------

export async function onCalendarChannelDestroyed(
  payload: WorkspaceEventBatch<ObjectRecordDeleteEvent>,
): Promise<void> {
  await Promise.all(
    payload.events.map((eventPayload) => {
      const jobData: CalendarChannelDeletionCleanupJobData = {
        workspaceId: payload.workspaceId,
        calendarChannelId: eventPayload.recordId,
      };
      return handleCalendarChannelDeletionCleanup(jobData);
    }),
  );
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class CalendarEventCleanerCalendarChannelListener {
  async handleDestroyedEvent(
    payload: WorkspaceEventBatch<ObjectRecordDeleteEvent>,
  ) {
    return onCalendarChannelDestroyed(payload);
  }
}
