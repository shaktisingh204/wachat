import "server-only";

// server-logic: CalendarEventParticipantWorkspaceMemberListener → plain async handlers.
// PORT-NOTE: NestJS @OnDatabaseBatchEvent / MessageQueueService dropped.
// Call these from your event-dispatch layer instead of NestJS event decorators.

import {
  type CalendarEventParticipantMatchParticipantJobData,
  handleCalendarEventParticipantMatchParticipantJob,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/jobs/calendar-event-participant-match-participant.job";

type WorkspaceMemberAfter = {
  userEmail?: string | null;
  [key: string]: unknown;
};

type WorkspaceMemberBefore = WorkspaceMemberAfter;

type WorkspaceMemberCreateEventPayload = {
  recordId: string;
  properties: { after: WorkspaceMemberAfter };
};

type WorkspaceMemberUpdateEventPayload = {
  recordId: string;
  properties: { before: WorkspaceMemberBefore; after: WorkspaceMemberAfter };
};

type WorkspaceEventBatch<T> = {
  workspaceId: string;
  events: T[];
};

function objectChangedProperties<T extends Record<string, unknown>>(
  before: T,
  after: T,
): (keyof T)[] {
  return (Object.keys(after) as (keyof T)[]).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

async function enqueueMatchParticipantJob(
  data: CalendarEventParticipantMatchParticipantJobData,
): Promise<void> {
  // PORT-NOTE: In Twenty this adds to BullMQ. In SabNode, invoke directly or
  // push into your own queue primitive.
  await handleCalendarEventParticipantMatchParticipantJob(data);
}

export async function handleWorkspaceMemberCreatedForCalendarParticipants(
  payload: WorkspaceEventBatch<WorkspaceMemberCreateEventPayload>,
): Promise<void> {
  for (const eventPayload of payload.events) {
    if (!eventPayload.properties.after.userEmail) {
      continue;
    }

    await enqueueMatchParticipantJob({
      workspaceId: payload.workspaceId,
      participantMatching: {
        personIds: [],
        personEmails: [],
        workspaceMemberIds: [eventPayload.recordId],
      },
    });
  }
}

export async function handleWorkspaceMemberUpdatedForCalendarParticipants(
  payload: WorkspaceEventBatch<WorkspaceMemberUpdateEventPayload>,
): Promise<void> {
  for (const eventPayload of payload.events) {
    if (
      objectChangedProperties<WorkspaceMemberAfter>(
        eventPayload.properties.before,
        eventPayload.properties.after,
      ).includes("userEmail")
    ) {
      await enqueueMatchParticipantJob({
        workspaceId: payload.workspaceId,
        participantMatching: {
          personIds: [],
          personEmails: [],
          workspaceMemberIds: [eventPayload.recordId],
        },
      });
    }
  }
}
