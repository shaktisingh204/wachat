import "server-only";

// PORT-NOTE: NestJS BullMQ @Processor/@Process replaced with plain async functions.
// The cron job logic is preserved: iterate active workspaces, collect
// FAILED/FAILED_UNKNOWN calendar channels, then enqueue a relaunch job per
// channel. Call runCalendarRelaunchFailedCalendarChannelsCronJob() from a
// Vercel Cron handler (e.g. /api/cron/calendar-relaunch-failed-calendar-channels).

import { connectToDatabase } from "@/lib/mongodb";
import {
  CalendarChannelSyncStage,
  CalendarChannelSyncStatus,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/dtos/calendar-channel.dto";
import { WorkspaceActivationStatus } from "@/lib/sabcrm/shared/src/workspace/types/WorkspaceActivationStatus";

export const CALENDAR_RELAUNCH_FAILED_CALENDAR_CHANNELS_CRON_PATTERN =
  "*/30 * * * *";

export type CalendarRelaunchFailedCalendarChannelJobData = {
  workspaceId: string;
  calendarChannelId: string;
};

// ---------------------------------------------------------------------------
// Job stub — called once per failed channel by the cron job
// ---------------------------------------------------------------------------

/**
 * Placeholder hook for the per-channel CalendarRelaunchFailedCalendarChannelJob.
 * Replace with a real queue enqueue (e.g. Inngest, BullMQ, or Vercel Queue)
 * once the queue layer is wired.
 */
async function enqueueCalendarRelaunchFailedCalendarChannelJob(
  data: CalendarRelaunchFailedCalendarChannelJobData,
): Promise<void> {
  // PORT-NOTE: NestJS MessageQueueService replaced with a stub.
  // Enqueue `data` to your queue here.
  console.log(
    "[CalendarRelaunchFailedCalendarChannelsCronJob] enqueue job",
    data,
  );
}

// ---------------------------------------------------------------------------
// Main cron handler
// ---------------------------------------------------------------------------

export async function runCalendarRelaunchFailedCalendarChannelsCronJob(): Promise<void> {
  const db = await connectToDatabase();

  const workspaceCollection = db.collection("sabcrm_workspaces");
  const calendarChannelCollection = db.collection("sabcrm_calendar_channel");

  const activeWorkspaces = await workspaceCollection
    .find({ activationStatus: WorkspaceActivationStatus.ACTIVE })
    .toArray();

  const activeWorkspaceIds = activeWorkspaces.map((ws) => ws.id as string);

  if (activeWorkspaceIds.length === 0) {
    return;
  }

  let failedCalendarChannels: Record<string, unknown>[] = [];

  try {
    failedCalendarChannels = await calendarChannelCollection
      .find({
        syncStage: CalendarChannelSyncStage.FAILED,
        syncStatus: CalendarChannelSyncStatus.FAILED_UNKNOWN,
        workspaceId: { $in: activeWorkspaceIds },
      })
      .toArray();
  } catch (error) {
    console.error(
      "[CalendarRelaunchFailedCalendarChannelsCronJob] Error fetching failed channels",
      error,
    );

    return;
  }

  for (const calendarChannel of failedCalendarChannels) {
    try {
      await enqueueCalendarRelaunchFailedCalendarChannelJob({
        workspaceId: calendarChannel.workspaceId as string,
        calendarChannelId: calendarChannel.id as string,
      });
    } catch (error) {
      console.error(
        `[CalendarRelaunchFailedCalendarChannelsCronJob] Error for channel ${calendarChannel.id} workspace ${calendarChannel.workspaceId}`,
        error,
      );
    }
  }
}
