// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/calendar-event-cleaner/listeners/calendar-event-cleaner-connected-account.listener.ts
// NestJS event listener converted to plain exported functions.

import "server-only";

import {
  handleDeleteConnectedAccountAssociatedCalendarData,
  type DeleteConnectedAccountAssociatedCalendarDataJobData,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-cleaner/jobs/delete-connected-account-associated-calendar-data.job";

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

export async function onConnectedAccountDestroyed(
  payload: WorkspaceEventBatch<ObjectRecordDeleteEvent>,
): Promise<void> {
  await Promise.all(
    payload.events.map((eventPayload) => {
      const jobData: DeleteConnectedAccountAssociatedCalendarDataJobData = {
        workspaceId: payload.workspaceId,
        connectedAccountId: eventPayload.recordId,
      };
      return handleDeleteConnectedAccountAssociatedCalendarData(jobData);
    }),
  );
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class CalendarEventCleanerConnectedAccountListener {
  async handleDestroyedEvent(
    payload: WorkspaceEventBatch<ObjectRecordDeleteEvent>,
  ) {
    return onConnectedAccountDestroyed(payload);
  }
}
