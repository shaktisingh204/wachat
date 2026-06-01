// PORT-NOTE: Stub service — referenced by blocklist-reimport-calendar-events.job.ts
// Corresponds to CalendarChannelSyncStatusService from the original.
// Full port will be completed when that service's source is included in a
// later batch. For now the exported function signature is established so
// imports in this batch compile correctly.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const CalendarChannelSyncStage = {
  CALENDAR_EVENT_LIST_FETCH_PENDING: "CALENDAR_EVENT_LIST_FETCH_PENDING",
  CALENDAR_EVENT_LIST_FETCH_SCHEDULED: "CALENDAR_EVENT_LIST_FETCH_SCHEDULED",
  CALENDAR_EVENTS_IMPORT_PENDING: "CALENDAR_EVENTS_IMPORT_PENDING",
  CALENDAR_EVENTS_IMPORT_ONGOING: "CALENDAR_EVENTS_IMPORT_ONGOING",
  FAILED: "FAILED",
  FINISHED: "FINISHED",
} as const;

export type CalendarChannelSyncStageValue =
  (typeof CalendarChannelSyncStage)[keyof typeof CalendarChannelSyncStage];

export async function resetAndMarkAsCalendarEventListFetchPending(
  calendarChannelIds: string[],
  workspaceId: string,
): Promise<void> {
  if (calendarChannelIds.length === 0) return;

  const { db } = await connectToDatabase();

  await db.collection("sabcrm_calendarChannel").updateMany(
    { id: { $in: calendarChannelIds }, workspaceId },
    {
      $set: {
        syncStage: CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_PENDING,
        syncStageStartedAt: new Date().toISOString(),
      },
    },
  );
}

export class CalendarChannelSyncStatusService {
  async resetAndMarkAsCalendarEventListFetchPending(
    calendarChannelIds: string[],
    workspaceId: string,
  ): Promise<void> {
    return resetAndMarkAsCalendarEventListFetchPending(
      calendarChannelIds,
      workspaceId,
    );
  }
}
