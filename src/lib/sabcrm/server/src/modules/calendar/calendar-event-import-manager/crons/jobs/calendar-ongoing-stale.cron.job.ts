import "server-only";

// PORT-NOTE: NestJS BullMQ @Processor/@Process replaced with plain async functions.
// The cron job logic is preserved: iterate active workspaces, enqueue a
// CalendarOngoingStaleJob per workspace. Call runCalendarOngoingStaleCronJob()
// from a Vercel Cron handler (e.g. /api/cron/calendar-ongoing-stale).

import { connectToDatabase } from "@/lib/mongodb";
import { WorkspaceActivationStatus } from "@/lib/sabcrm/shared/src/workspace/types/WorkspaceActivationStatus";

export const CALENDAR_ONGOING_STALE_CRON_PATTERN = "0 * * * *";

export type CalendarOngoingStaleJobData = {
  workspaceId: string;
};

// ---------------------------------------------------------------------------
// Job stub — called once per workspace by the cron job
// ---------------------------------------------------------------------------

/**
 * Placeholder hook for the per-workspace CalendarOngoingStaleJob.
 * Replace with a real queue enqueue (e.g. Inngest, BullMQ, or Vercel Queue)
 * once the queue layer is wired.
 */
async function enqueueCalendarOngoingStaleJob(
  data: CalendarOngoingStaleJobData,
): Promise<void> {
  // PORT-NOTE: NestJS MessageQueueService replaced with a stub.
  // Enqueue `data` to your queue here.
  console.log("[CalendarOngoingStaleCronJob] enqueue job", data);
}

// ---------------------------------------------------------------------------
// Main cron handler
// ---------------------------------------------------------------------------

export async function runCalendarOngoingStaleCronJob(): Promise<void> {
  const db = await connectToDatabase();

  const workspaceCollection = db.collection("sabcrm_workspaces");

  const activeWorkspaces = await workspaceCollection
    .find({ activationStatus: WorkspaceActivationStatus.ACTIVE })
    .toArray();

  for (const activeWorkspace of activeWorkspaces) {
    try {
      await enqueueCalendarOngoingStaleJob({
        workspaceId: activeWorkspace.id as string,
      });
    } catch (error) {
      console.error(
        `[CalendarOngoingStaleCronJob] Error for workspace ${activeWorkspace.id}`,
        error,
      );
    }
  }
}
