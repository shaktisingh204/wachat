import "server-only";

// service: CalendarSaveEventsService → plain exported functions backed by Mongo.
// Saves / updates calendar events, channel-event associations, and participants.

import { v4 as uuid } from "uuid";

import { connectToDatabase } from "@/lib/mongodb";
import type { CalendarChannelDoc } from "@/lib/sabcrm/server/src/modules/calendar/common/standard-objects/calendar-channel.workspace-entity";
import type { CalendarChannelEventAssociationDoc } from "@/lib/sabcrm/server/src/modules/calendar/common/standard-objects/calendar-channel-event-association.workspace-entity";
import type { CalendarEventDoc } from "@/lib/sabcrm/server/src/modules/calendar/common/standard-objects/calendar-event.workspace-entity";
import type { FetchedCalendarEvent } from "@/lib/sabcrm/server/src/modules/calendar/common/types/fetched-calendar-event";
import { upsertAndDeleteCalendarEventParticipants } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/services/calendar-event-participant.service";

// ---- ConnectedAccount minimal type ----
export type ConnectedAccountRef = {
  id: string;
  isContactAutoCreationEnabled?: boolean;
  [key: string]: unknown;
};

type FetchedCalendarEventWithDBEvent = {
  fetchedCalendarEvent: FetchedCalendarEvent;
  existingCalendarEvent: Pick<CalendarEventDoc, "id"> | null;
  newlyCreatedCalendarEvent: Pick<CalendarEventDoc, "id"> | null;
};

async function getCollections(workspaceId: string) {
  const { db } = await connectToDatabase();
  const calendarEvents =
    db.collection<CalendarEventDoc>("sabcrm_calendar_event");
  const associations =
    db.collection<CalendarChannelEventAssociationDoc>(
      "sabcrm_calendar_channel_event_association",
    );
  return { calendarEvents, associations, workspaceId };
}

export async function saveCalendarEventsAndEnqueueContactCreationJob(
  fetchedCalendarEvents: FetchedCalendarEvent[],
  calendarChannel: CalendarChannelDoc,
  connectedAccount: ConnectedAccountRef,
  workspaceId: string,
): Promise<void> {
  const { calendarEvents, associations } = await getCollections(workspaceId);

  // Find existing associations for these external IDs in this channel.
  const externalIds = fetchedCalendarEvents.map((e) => e.id);

  const existingAssociations = await associations
    .find({
      workspaceId,
      calendarChannelId: calendarChannel.id,
      eventExternalId: { $in: externalIds },
    })
    .toArray();

  const existingCalendarEventIdByExternalId = new Map(
    existingAssociations.map((a) => [a.eventExternalId, a.calendarEventId]),
  );
  const existingAssociationIdByExternalId = new Map(
    existingAssociations.map((a) => [a.eventExternalId, a.id]),
  );

  // Partition into new vs existing events.
  const fetchedWithDB: FetchedCalendarEventWithDBEvent[] =
    fetchedCalendarEvents.map((event) => {
      const existingId = existingCalendarEventIdByExternalId.get(event.id);
      return {
        fetchedCalendarEvent: event,
        existingCalendarEvent: existingId ? { id: existingId } : null,
        newlyCreatedCalendarEvent: null,
      };
    });

  // Insert new calendar events.
  const newCalendarEventIdByExternalId = new Map<string, string>();

  const newEventsToInsert = fetchedWithDB
    .filter(({ existingCalendarEvent }) => existingCalendarEvent === null)
    .map(({ fetchedCalendarEvent }) => {
      const calendarEventId = uuid();
      newCalendarEventIdByExternalId.set(fetchedCalendarEvent.id, calendarEventId);

      return {
        id: calendarEventId,
        workspaceId,
        iCalUid: fetchedCalendarEvent.iCalUid,
        title: fetchedCalendarEvent.title,
        description: fetchedCalendarEvent.description,
        startsAt: fetchedCalendarEvent.startsAt,
        endsAt: fetchedCalendarEvent.endsAt,
        location: fetchedCalendarEvent.location,
        isFullDay: fetchedCalendarEvent.isFullDay,
        isCanceled: fetchedCalendarEvent.isCanceled,
        conferenceSolution: fetchedCalendarEvent.conferenceSolution,
        conferenceLink: {
          primaryLinkLabel: fetchedCalendarEvent.conferenceLinkLabel,
          primaryLinkUrl: fetchedCalendarEvent.conferenceLinkUrl,
          secondaryLinks: [] as { label: string; url: string }[],
        },
        externalCreatedAt: fetchedCalendarEvent.externalCreatedAt,
        externalUpdatedAt: fetchedCalendarEvent.externalUpdatedAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      } satisfies CalendarEventDoc;
    });

  if (newEventsToInsert.length > 0) {
    await calendarEvents.insertMany(newEventsToInsert);
  }

  // Enrich with newly created IDs.
  const enriched: FetchedCalendarEventWithDBEvent[] = fetchedWithDB.map(
    ({ fetchedCalendarEvent, existingCalendarEvent }) => ({
      fetchedCalendarEvent,
      existingCalendarEvent,
      newlyCreatedCalendarEvent:
        newCalendarEventIdByExternalId.get(fetchedCalendarEvent.id) != null
          ? { id: newCalendarEventIdByExternalId.get(fetchedCalendarEvent.id)! }
          : null,
    }),
  );

  // Update existing events.
  const existingToUpdate = enriched.filter(
    ({ existingCalendarEvent }) => existingCalendarEvent !== null,
  );

  for (const { fetchedCalendarEvent, existingCalendarEvent } of existingToUpdate) {
    if (!existingCalendarEvent) continue;
    await calendarEvents.updateOne(
      { id: existingCalendarEvent.id, workspaceId },
      {
        $set: {
          iCalUid: fetchedCalendarEvent.iCalUid,
          title: fetchedCalendarEvent.title,
          description: fetchedCalendarEvent.description,
          startsAt: fetchedCalendarEvent.startsAt,
          endsAt: fetchedCalendarEvent.endsAt,
          location: fetchedCalendarEvent.location,
          isFullDay: fetchedCalendarEvent.isFullDay,
          isCanceled: fetchedCalendarEvent.isCanceled,
          conferenceSolution: fetchedCalendarEvent.conferenceSolution,
          conferenceLink: {
            primaryLinkLabel: fetchedCalendarEvent.conferenceLinkLabel,
            primaryLinkUrl: fetchedCalendarEvent.conferenceLinkUrl,
            secondaryLinks: [],
          },
          externalCreatedAt: fetchedCalendarEvent.externalCreatedAt,
          externalUpdatedAt: fetchedCalendarEvent.externalUpdatedAt,
          updatedAt: new Date().toISOString(),
        },
      },
    );
  }

  // Insert new channel-event associations.
  const newAssociations = enriched
    .filter(({ newlyCreatedCalendarEvent }) => newlyCreatedCalendarEvent !== null)
    .map(({ fetchedCalendarEvent, newlyCreatedCalendarEvent }) => {
      if (!newlyCreatedCalendarEvent?.id) {
        throw new Error(
          `Calendar event id not found for event with iCalUid ${fetchedCalendarEvent.iCalUid} - should never happen`,
        );
      }
      return {
        id: uuid(),
        workspaceId,
        calendarEventId: newlyCreatedCalendarEvent.id,
        eventExternalId: fetchedCalendarEvent.id,
        calendarChannelId: calendarChannel.id,
        recurringEventExternalId:
          fetchedCalendarEvent.recurringEventExternalId ?? "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      } satisfies CalendarChannelEventAssociationDoc;
    });

  if (newAssociations.length > 0) {
    await associations.insertMany(newAssociations);
  }

  // Update existing associations' recurringEventExternalId.
  const existingAssocToUpdate = enriched.filter(
    ({ existingCalendarEvent }) => existingCalendarEvent !== null,
  );

  for (const { fetchedCalendarEvent } of existingAssocToUpdate) {
    const associationId = existingAssociationIdByExternalId.get(
      fetchedCalendarEvent.id,
    );
    if (!associationId) continue;
    await associations.updateOne(
      { id: associationId, workspaceId },
      {
        $set: {
          recurringEventExternalId:
            fetchedCalendarEvent.recurringEventExternalId ?? "",
          updatedAt: new Date().toISOString(),
        },
      },
    );
  }

  // Resolve participants to create and update.
  const participantsToCreate = enriched
    .filter(({ newlyCreatedCalendarEvent }) => newlyCreatedCalendarEvent !== null)
    .flatMap(({ newlyCreatedCalendarEvent, fetchedCalendarEvent }) => {
      if (!newlyCreatedCalendarEvent?.id) {
        throw new Error(
          `Newly created calendar event with iCalUid ${fetchedCalendarEvent.iCalUid} not found - should never happen`,
        );
      }
      return fetchedCalendarEvent.participants.map((participant) => ({
        ...participant,
        calendarEventId: newlyCreatedCalendarEvent.id,
      }));
    });

  const participantsToUpdate = enriched
    .filter(({ existingCalendarEvent }) => existingCalendarEvent !== null)
    .flatMap(({ fetchedCalendarEvent, existingCalendarEvent }) => {
      if (!existingCalendarEvent?.id) {
        throw new Error(
          `Existing calendar event with iCalUid ${fetchedCalendarEvent.iCalUid} not found - should never happen`,
        );
      }
      return fetchedCalendarEvent.participants.map((participant) => ({
        ...participant,
        calendarEventId: existingCalendarEvent.id,
      }));
    });

  await upsertAndDeleteCalendarEventParticipants({
    participantsToCreate,
    participantsToUpdate,
    calendarChannel,
    connectedAccount,
    workspaceId,
  });
}
