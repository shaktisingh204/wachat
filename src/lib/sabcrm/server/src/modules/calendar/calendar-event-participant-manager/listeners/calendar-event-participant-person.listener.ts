import "server-only";

// server-logic: CalendarEventParticipantPersonListener → plain async handler functions.
// PORT-NOTE: NestJS @OnDatabaseBatchEvent / MessageQueueService dropped.
// In SabNode, call these handlers from your event-dispatch layer (e.g. a Mongo
// change-stream handler or server action) instead of using NestJS event decorators.

import {
  type CalendarEventParticipantMatchParticipantJobData,
  handleCalendarEventParticipantMatchParticipantJob,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/jobs/calendar-event-participant-match-participant.job";

// Minimal event-payload shapes mirroring twenty-shared ObjectRecord*Event.
type PersonEmails = {
  primaryEmail?: string | null;
  additionalEmails?: string[] | null;
};

type PersonAfter = {
  emails: PersonEmails;
  [key: string]: unknown;
};

type PersonBefore = PersonAfter;

type PersonCreateEventPayload = {
  recordId: string;
  properties: { after: PersonAfter };
};

type PersonUpdateEventPayload = {
  recordId: string;
  properties: { before: PersonBefore; after: PersonAfter };
};

type PersonDeleteEventPayload = {
  recordId: string;
  properties: { before: PersonBefore };
};

type WorkspaceEventBatch<T> = {
  workspaceId: string;
  events: T[];
};

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

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

export async function handlePersonCreatedForCalendarParticipants(
  payload: WorkspaceEventBatch<PersonCreateEventPayload>,
): Promise<void> {
  const personWithEmails = payload.events.filter(
    (eventPayload) =>
      isDefined(eventPayload.properties.after.emails?.primaryEmail) ||
      isDefined(eventPayload.properties.after.emails?.additionalEmails),
  );

  const personIds = personWithEmails.map((eventPayload) => eventPayload.recordId);
  const personEmails = personWithEmails
    .flatMap((eventPayload) => [
      eventPayload.properties.after.emails.primaryEmail,
      ...((eventPayload.properties.after.emails?.additionalEmails ?? []) as string[]),
    ])
    .filter(isDefined);

  await enqueueMatchParticipantJob({
    workspaceId: payload.workspaceId,
    participantMatching: {
      personIds,
      personEmails,
      workspaceMemberIds: [],
    },
  });
}

export async function handlePersonUpdatedForCalendarParticipants(
  payload: WorkspaceEventBatch<PersonUpdateEventPayload>,
): Promise<void> {
  const personWithEmails = payload.events.filter((eventPayload) =>
    objectChangedProperties(
      eventPayload.properties.before,
      eventPayload.properties.after,
    ).includes("emails"),
  );

  const personIds = personWithEmails.map((eventPayload) => eventPayload.recordId);
  const personEmails = personWithEmails
    .flatMap((eventPayload) => [
      eventPayload.properties.after.emails.primaryEmail,
      ...((eventPayload.properties.after.emails?.additionalEmails ?? []) as string[]),
    ])
    .filter(isDefined);

  await enqueueMatchParticipantJob({
    workspaceId: payload.workspaceId,
    participantMatching: {
      personIds,
      personEmails,
      workspaceMemberIds: [],
    },
  });
}

export async function handlePersonDestroyedForCalendarParticipants(
  payload: WorkspaceEventBatch<PersonDeleteEventPayload>,
): Promise<void> {
  const peopleHavingEmails = payload.events.filter(
    (eventPayload) =>
      isDefined(eventPayload.properties.before.emails?.primaryEmail) ||
      isDefined(eventPayload.properties.before.emails?.additionalEmails),
  );

  const personEmails = peopleHavingEmails
    .flatMap((eventPayload) => [
      eventPayload.properties.before.emails.primaryEmail,
      ...((eventPayload.properties.before.emails?.additionalEmails ?? []) as string[]),
    ])
    .filter(isDefined);

  await enqueueMatchParticipantJob({
    workspaceId: payload.workspaceId,
    participantMatching: {
      personIds: [],
      personEmails,
      workspaceMemberIds: [],
    },
  });
}
