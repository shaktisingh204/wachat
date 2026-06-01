import "server-only";

// PORT-NOTE: NestJS BullMQ @Processor/@Process replaced with plain async functions.
// The cron job logic is preserved: iterate active workspaces, find pending
// calendar channels that are not throttled, transition them to SCHEDULED, then
// enqueue a per-channel job. Call runCalendarEventListFetchCronJob() from a
// Vercel Cron handler (e.g. /api/cron/calendar-event-list-fetch).

import { connectToDatabase } from "@/lib/mongodb";
import {
  CalendarChannelSyncStage,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto";
import { WorkspaceActivationStatus } from "@/lib/sabcrm/shared/src/workspace/types/WorkspaceActivationStatus";

export const CALENDAR_EVENT_LIST_FETCH_CRON_PATTERN = "*/5 * * * *";

export type CalendarEventListFetchJobData = {
  calendarChannelId: string;
  workspaceId: string;
};

// ---------------------------------------------------------------------------
// Throttle helper (inline — is-throttled not yet ported)
// ---------------------------------------------------------------------------

const THROTTLE_BASE_MS = 60_000; // 1 minute base

function isThrottled(
  syncStageStartedAt: string | null,
  throttleFailureCount: number,
): boolean {
  if (!syncStageStartedAt || throttleFailureCount === 0) return false;

  const pauseUntil = new Date(
    new Date(syncStageStartedAt).getTime() +
      THROTTLE_BASE_MS * Math.pow(2, throttleFailureCount - 1),
  );

  return pauseUntil > new Date();
}

// ---------------------------------------------------------------------------
// Job stub — called once per channel by the cron job
// ---------------------------------------------------------------------------

/**
 * Placeholder hook for the per-channel CalendarEventListFetchJob.
 * Replace with a real queue enqueue (e.g. Inngest, BullMQ, or Vercel Queue)
 * once the queue layer is wired.
 */
async function enqueueCalendarEventListFetchJob(
  data: CalendarEventListFetchJobData,
): Promise<void> {
  // PORT-NOTE: NestJS MessageQueueService replaced with a stub.
  // Enqueue `data` to your queue here.
  console.log("[CalendarEventListFetchCronJob] enqueue job", data);
}

// ---------------------------------------------------------------------------
// Main cron handler
// ---------------------------------------------------------------------------

export async function runCalendarEventListFetchCronJob(): Promise<void> {
  const db = await connectToDatabase();

  const workspaceCollection = db.collection("sabcrm_workspaces");
  const calendarChannelCollection = db.collection("sabcrm_calendar_channel");

  const activeWorkspaces = await workspaceCollection
    .find({ activationStatus: WorkspaceActivationStatus.ACTIVE })
    .toArray();

  for (const activeWorkspace of activeWorkspaces) {
    try {
      const pendingCalendarChannels = await calendarChannelCollection
        .find({
          workspaceId: activeWorkspace.id as string,
          isSyncEnabled: true,
          syncStage:
            CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_PENDING,
        })
        .toArray();

      const calendarChannelsToSchedule = pendingCalendarChannels.filter(
        (ch) =>
          !isThrottled(
            ch.syncStageStartedAt
              ? new Date(ch.syncStageStartedAt as Date).toISOString()
              : null,
            (ch.throttleFailureCount as number) ?? 0,
          ),
      );

      const throttledCount =
        pendingCalendarChannels.length - calendarChannelsToSchedule.length;

      if (throttledCount > 0) {
        console.log(
          `[CalendarEventListFetchCronJob] Skipped ${throttledCount} throttled calendar channels for workspace ${activeWorkspace.id}`,
        );
      }

      if (calendarChannelsToSchedule.length === 0) {
        continue;
      }

      const idsToSchedule = calendarChannelsToSchedule.map((ch) => ch.id as string);

      // Atomically transition to SCHEDULED only channels still in PENDING stage
      const updatedIds: string[] = [];

      for (const id of idsToSchedule) {
        const result = await calendarChannelCollection.findOneAndUpdate(
          {
            id,
            workspaceId: activeWorkspace.id,
            isSyncEnabled: true,
            syncStage:
              CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_PENDING,
          },
          {
            $set: {
              syncStage:
                CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_SCHEDULED,
              syncStageStartedAt: new Date(),
            },
          },
          { returnDocument: "after" },
        );

        if (result) {
          updatedIds.push(id);
        }
      }

      for (const calendarChannelId of updatedIds) {
        await enqueueCalendarEventListFetchJob({
          calendarChannelId,
          workspaceId: activeWorkspace.id as string,
        });
      }
    } catch (error) {
      console.error(
        `[CalendarEventListFetchCronJob] Error for workspace ${activeWorkspace.id}`,
        error,
      );
    }
  }
}
