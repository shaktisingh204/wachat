// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/blocklist-manager/jobs/blocklist-reimport-calendar-events.job.ts
// BullMQ processor converted to a plain async function.
// TypeORM queries replaced with MongoDB operations.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { resetAndMarkAsCalendarEventListFetchPending } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/services/calendar-channel-sync-status.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlocklistReimportCalendarEventsJobData = {
  workspaceId: string;
  events: Array<{
    properties: {
      before: {
        workspaceMemberId: string;
      };
    };
  }>;
};

// ---------------------------------------------------------------------------
// CalendarChannelSyncStage enum (mirrors twenty-shared/types)
// ---------------------------------------------------------------------------

export const CalendarChannelSyncStage = {
  CALENDAR_EVENT_LIST_FETCH_PENDING: "CALENDAR_EVENT_LIST_FETCH_PENDING",
  CALENDAR_EVENT_LIST_FETCH_SCHEDULED: "CALENDAR_EVENT_LIST_FETCH_SCHEDULED",
} as const;

// ---------------------------------------------------------------------------
// Job handler
// ---------------------------------------------------------------------------

export async function handleBlocklistReimportCalendarEvents(
  data: BlocklistReimportCalendarEventsJobData,
): Promise<void> {
  const { db } = await connectToDatabase();
  const workspaceId = data.workspaceId;

  const calendarChannelCol = db.collection("sabcrm_calendarChannel");

  for (const eventPayload of data.events) {
    const workspaceMemberId =
      eventPayload.properties.before.workspaceMemberId;

    const workspaceMember = await db
      .collection("sabcrm_workspaceMember")
      .findOne({ id: workspaceMemberId, workspaceId });

    if (!workspaceMember) continue;

    const userWorkspace = await db
      .collection("sabcrm_userWorkspace")
      .findOne({ userId: workspaceMember.userId, workspaceId });

    if (!userWorkspace) continue;

    const calendarChannels = await calendarChannelCol
      .find({
        userWorkspaceId: userWorkspace.id,
        syncStage: {
          $ne: CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_PENDING,
        },
        workspaceId,
      })
      .project({ id: 1 })
      .toArray();

    const channelIds = calendarChannels
      .map((c: { id?: string }) => c.id)
      .filter(Boolean) as string[];

    await resetAndMarkAsCalendarEventListFetchPending(channelIds, workspaceId);
  }
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class BlocklistReimportCalendarEventsJob {
  async handle(data: BlocklistReimportCalendarEventsJobData): Promise<void> {
    return handleBlocklistReimportCalendarEvents(data);
  }
}
