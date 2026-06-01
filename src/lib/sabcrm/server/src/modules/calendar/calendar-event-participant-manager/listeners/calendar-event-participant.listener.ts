import "server-only";

// server-logic: CalendarEventParticipantListener → plain async handler function.
// PORT-NOTE: NestJS @OnCustomBatchEvent / TimelineActivityRepository / FeatureFlagService dropped.
// In SabNode, call handleCalendarEventParticipantMatchedEvent from your event-dispatch layer.

import { connectToDatabase } from "@/lib/mongodb";
import type { CalendarEventParticipantDoc } from "@/lib/sabcrm/server/src/modules/calendar/common/standard-objects/calendar-event-participant.workspace-entity";

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

type CalendarEventParticipantMatchedEventPayload = {
  workspaceMemberId: string;
  participants: CalendarEventParticipantDoc[];
};

type CustomWorkspaceEventBatch<T> = {
  workspaceId?: string | null;
  events: T[];
};

// Minimal timeline-activity document shape.
interface TimelineActivityInsert {
  id: string;
  name: string;
  properties: Record<string, unknown>;
  objectSingularName: string;
  recordId: string;
  workspaceMemberId: string;
  linkedObjectMetadataId: string;
  linkedRecordId: string;
  linkedRecordCachedName: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

async function upsertTimelineActivities(
  workspaceId: string,
  payloads: Omit<TimelineActivityInsert, "workspaceId" | "createdAt" | "updatedAt">[],
): Promise<void> {
  if (payloads.length === 0) return;

  const { db } = await connectToDatabase();
  const col = db.collection<TimelineActivityInsert>("sabcrm_timeline_activity");
  const now = new Date().toISOString();

  // Upsert by (recordId + linkedRecordId + objectSingularName + linkedObjectMetadataId).
  await Promise.all(
    payloads.map((payload) =>
      col.updateOne(
        {
          workspaceId,
          objectSingularName: payload.objectSingularName,
          recordId: payload.recordId,
          linkedObjectMetadataId: payload.linkedObjectMetadataId,
          linkedRecordId: payload.linkedRecordId,
        },
        {
          $setOnInsert: {
            id: payload.id,
            createdAt: now,
          },
          $set: {
            ...payload,
            workspaceId,
            updatedAt: now,
          },
        },
        { upsert: true },
      ),
    ),
  );
}

async function getCalendarEventObjectMetadataId(
  workspaceId: string,
): Promise<string | null> {
  const { db } = await connectToDatabase();
  const doc = await db
    .collection<{ nameSingular: string; id: string; workspaceId: string }>(
      "sabcrm_object_metadata",
    )
    .findOne({ nameSingular: "calendarEvent", workspaceId });
  return doc?.id ?? null;
}

export async function handleCalendarEventParticipantMatchedEvent(
  batchEvent: CustomWorkspaceEventBatch<CalendarEventParticipantMatchedEventPayload>,
): Promise<void> {
  if (!isDefined(batchEvent.workspaceId)) {
    return;
  }

  const workspaceId = batchEvent.workspaceId;

  const calendarEventObjectMetadataId =
    await getCalendarEventObjectMetadataId(workspaceId);

  if (!calendarEventObjectMetadataId) {
    throw new Error(
      `Object metadata for calendarEvent not found in workspace ${workspaceId}`,
    );
  }

  const { randomUUID } = await import("crypto");

  const timelineActivityPayloads = batchEvent.events.flatMap((event) => {
    const calendarEventParticipants = event.participants ?? [];

    const withPersonId = calendarEventParticipants.filter((participant) =>
      isDefined(participant.personId),
    );

    if (withPersonId.length === 0) {
      return [];
    }

    return withPersonId
      .map((participant) => {
        if (!isDefined(participant.personId)) return undefined;

        return {
          id: randomUUID(),
          name: "message.linked",
          properties: {},
          objectSingularName: "person",
          recordId: participant.personId,
          workspaceMemberId: event.workspaceMemberId,
          linkedObjectMetadataId: calendarEventObjectMetadataId,
          linkedRecordId: participant.calendarEventId,
          linkedRecordCachedName: "",
        };
      })
      .filter(isDefined);
  });

  await upsertTimelineActivities(workspaceId, timelineActivityPayloads);
}
