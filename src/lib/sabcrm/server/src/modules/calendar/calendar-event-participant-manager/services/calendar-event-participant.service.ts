import "server-only";

// service: CalendarEventParticipantService → plain exported functions backed by Mongo.
// Business logic: upsert/delete calendar-event participants per event, enqueue contact
// creation, and match participants to people / workspace members.

import { v4 as uuid } from "uuid";

import { connectToDatabase } from "@/lib/mongodb";
import type { CalendarChannelDoc } from "@/lib/sabcrm/server/src/modules/calendar/common/standard-objects/calendar-channel.workspace-entity";
import type { CalendarEventParticipantDoc } from "@/lib/sabcrm/server/src/modules/calendar/common/standard-objects/calendar-event-participant.workspace-entity";
import type { FetchedCalendarEventParticipant } from "@/lib/sabcrm/server/src/modules/calendar/common/types/fetched-calendar-event";

// ---- types ----

export type ConnectedAccountRef = {
  id: string;
  isContactAutoCreationEnabled?: boolean;
  [key: string]: unknown;
};

type FetchedParticipantWithEventId = FetchedCalendarEventParticipant & {
  calendarEventId: string;
};

type FetchedParticipantWithEventIdAndExistingId =
  FetchedParticipantWithEventId & { id: string };

// ---- queue stubs ----

async function enqueueCreateCompanyAndContact(
  workspaceId: string,
  connectedAccount: ConnectedAccountRef,
  contactsToCreate: { handle: string; displayName: string }[],
): Promise<void> {
  // PORT-NOTE: In Twenty this dispatches to BullMQ (CreateCompanyAndContactJob).
  // Wire this to SabNode's contact-creation queue once that module is ported.
  // src/lib/sabcrm/server/src/modules/contact-creation-manager/
  console.info(
    `[calendar-participant] enqueue contact creation: workspace=${workspaceId} contacts=${contactsToCreate.length}`,
  );
}

async function matchParticipants(
  participants: CalendarEventParticipantDoc[],
  workspaceId: string,
): Promise<void> {
  // PORT-NOTE: Delegates to MatchParticipantService once that module is ported.
  // src/lib/sabcrm/server/src/modules/match-participant/match-participant.service.ts
  console.info(
    `[calendar-participant] match participants: workspace=${workspaceId} count=${participants.length}`,
  );
}

// ---- Mongo collection helper ----

async function getParticipantCollection() {
  const { db } = await connectToDatabase();
  return db.collection<CalendarEventParticipantDoc>(
    "sabcrm_calendar_event_participant",
  );
}

// ---- core function ----

export async function upsertAndDeleteCalendarEventParticipants({
  participantsToCreate,
  participantsToUpdate,
  calendarChannel,
  connectedAccount,
  workspaceId,
}: {
  participantsToCreate: FetchedParticipantWithEventId[];
  participantsToUpdate: FetchedParticipantWithEventId[];
  calendarChannel: CalendarChannelDoc;
  connectedAccount: ConnectedAccountRef;
  workspaceId: string;
}): Promise<void> {
  const col = await getParticipantCollection();

  const CHUNK_SIZE = 200;
  const allParticipantsToCreate = [...participantsToCreate];

  // Process existing-event participants in chunks.
  for (let i = 0; i < participantsToUpdate.length; i += CHUNK_SIZE) {
    const chunk = participantsToUpdate.slice(i, i + CHUNK_SIZE);

    const calendarEventIds = [
      ...new Set(chunk.map((p) => p.calendarEventId).filter(Boolean)),
    ];

    const existingParticipants = await col
      .find({
        workspaceId,
        calendarEventId: { $in: calendarEventIds },
      })
      .toArray();

    const toUpdate: FetchedParticipantWithEventIdAndExistingId[] = [];
    const newFromChunk: FetchedParticipantWithEventId[] = [];

    for (const participant of chunk) {
      const existing = existingParticipants.find(
        (ep) =>
          ep.handle === participant.handle &&
          ep.calendarEventId === participant.calendarEventId,
      );

      if (existing) {
        toUpdate.push({ ...participant, id: existing.id });
      } else {
        newFromChunk.push(participant);
      }
    }

    // Delete participants no longer present.
    const toDelete = existingParticipants.filter(
      (ep) =>
        !chunk.some(
          (p) =>
            p.handle === ep.handle && p.calendarEventId === ep.calendarEventId,
        ),
    );

    if (toDelete.length > 0) {
      await col.deleteMany({
        workspaceId,
        id: { $in: toDelete.map((ep) => ep.id) },
      });
    }

    // Update existing participants.
    await Promise.all(
      toUpdate.map((participant) =>
        col.updateOne(
          { id: participant.id, workspaceId },
          {
            $set: {
              handle: participant.handle,
              displayName: participant.displayName,
              isOrganizer: participant.isOrganizer,
              responseStatus: participant.responseStatus,
              updatedAt: new Date().toISOString(),
            },
          },
        ),
      ),
    );

    // Queue newly discovered participants from this chunk for creation.
    allParticipantsToCreate.push(...newFromChunk);
  }

  // Insert all new participants in chunks.
  const savedParticipants: CalendarEventParticipantDoc[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < allParticipantsToCreate.length; i += CHUNK_SIZE) {
    const chunk = allParticipantsToCreate.slice(i, i + CHUNK_SIZE);

    const docs: CalendarEventParticipantDoc[] = chunk.map((participant) => ({
      id: uuid(),
      workspaceId,
      handle: participant.handle,
      displayName: participant.displayName,
      isOrganizer: participant.isOrganizer,
      responseStatus: participant.responseStatus,
      calendarEventId: participant.calendarEventId,
      personId: null,
      workspaceMemberId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }));

    if (docs.length > 0) {
      await col.insertMany(docs);
      savedParticipants.push(...docs);
    }
  }

  // Enqueue contact creation if the channel has auto-creation enabled.
  if (calendarChannel.isContactAutoCreationEnabled && savedParticipants.length > 0) {
    await enqueueCreateCompanyAndContact(
      workspaceId,
      connectedAccount,
      savedParticipants.map((participant) => ({
        handle: participant.handle ?? "",
        displayName: participant.displayName ?? participant.handle ?? "",
      })),
    );
  }

  // Match participants against people and workspace members.
  if (savedParticipants.length > 0) {
    await matchParticipants(savedParticipants, workspaceId);
  }
}
