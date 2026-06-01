// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/calendar-event-import-manager/commands/calendar-trigger-event-list-fetch.command.ts
// nest-commander CLI command converted to a plain exported async function.
// In SabNode this can be invoked from a Vercel Cron route handler or a CLI
// script (e.g. tsx src/lib/sabcrm/server/src/modules/calendar/.../calendar-trigger-event-list-fetch.command.ts).

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import {
  CalendarChannelSyncStage,
  resetAndMarkAsCalendarEventListFetchPending,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/services/calendar-channel-sync-status.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CalendarTriggerEventListFetchOptions = {
  workspaceId: string;
  calendarChannelId?: string;
};

export type CalendarEventListFetchJobData = {
  calendarChannelId: string;
  workspaceId: string;
};

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

export async function triggerCalendarEventListFetch(
  options: CalendarTriggerEventListFetchOptions,
  /** Optional job-enqueue callback — defaults to a no-op (caller enqueues). */
  enqueueJob?: (data: CalendarEventListFetchJobData) => Promise<void>,
): Promise<void> {
  const { workspaceId, calendarChannelId } = options;
  const { db } = await connectToDatabase();

  const filter: Record<string, unknown> = {
    isSyncEnabled: true,
    syncStage: CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_PENDING,
    workspaceId,
  };

  if (calendarChannelId) {
    filter["id"] = calendarChannelId;
  }

  const calendarChannels = await db
    .collection("sabcrm_calendarChannel")
    .find(filter)
    .toArray();

  if (calendarChannels.length === 0) {
    return;
  }

  for (const calendarChannel of calendarChannels) {
    const channelId = calendarChannel.id as string;

    // Advance sync stage to scheduled
    await db.collection("sabcrm_calendarChannel").updateOne(
      { id: channelId, workspaceId },
      {
        $set: {
          syncStage:
            CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_SCHEDULED,
          syncStageStartedAt: new Date().toISOString(),
        },
      },
    );

    if (enqueueJob) {
      await enqueueJob({ calendarChannelId: channelId, workspaceId });
    }
  }
}

// ---------------------------------------------------------------------------
// Class façade (mirrors the original CommandRunner structure)
// ---------------------------------------------------------------------------

export class CalendarTriggerEventListFetchCommand {
  async run(
    _passedParam: string[],
    options: CalendarTriggerEventListFetchOptions,
    enqueueJob?: (data: CalendarEventListFetchJobData) => Promise<void>,
  ): Promise<void> {
    return triggerCalendarEventListFetch(options, enqueueJob);
  }
}
