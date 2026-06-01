// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/calendar-event-cleaner/jobs/delete-connected-account-associated-calendar-data.job.ts
// BullMQ processor converted to a plain async function.

import "server-only";

import { cleanWorkspaceCalendarEvents } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-cleaner/services/calendar-event-cleaner.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeleteConnectedAccountAssociatedCalendarDataJobData = {
  workspaceId: string;
  connectedAccountId: string;
};

// ---------------------------------------------------------------------------
// Job handler
// ---------------------------------------------------------------------------

export async function handleDeleteConnectedAccountAssociatedCalendarData(
  data: DeleteConnectedAccountAssociatedCalendarDataJobData,
): Promise<void> {
  await cleanWorkspaceCalendarEvents(data.workspaceId);
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class DeleteConnectedAccountAssociatedCalendarDataJob {
  async handle(
    data: DeleteConnectedAccountAssociatedCalendarDataJobData,
  ): Promise<void> {
    return handleDeleteConnectedAccountAssociatedCalendarData(data);
  }
}
