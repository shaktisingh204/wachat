// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/calendar-event-cleaner/jobs/calendar-channel-deletion-cleanup.job.ts
// BullMQ processor converted to a plain async function.

import "server-only";

import {
  deleteCalendarChannelEventAssociationsByChannelId,
  cleanWorkspaceCalendarEvents,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-cleaner/services/calendar-event-cleaner.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarChannelDeletionCleanupJobData = {
  workspaceId: string;
  calendarChannelId: string;
};

// ---------------------------------------------------------------------------
// Job handler
// ---------------------------------------------------------------------------

export async function handleCalendarChannelDeletionCleanup(
  data: CalendarChannelDeletionCleanupJobData,
): Promise<void> {
  await deleteCalendarChannelEventAssociationsByChannelId({
    workspaceId: data.workspaceId,
    calendarChannelId: data.calendarChannelId,
  });

  await cleanWorkspaceCalendarEvents(data.workspaceId);
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class CalendarChannelDeletionCleanupJob {
  async handle(data: CalendarChannelDeletionCleanupJobData): Promise<void> {
    return handleCalendarChannelDeletionCleanup(data);
  }
}
