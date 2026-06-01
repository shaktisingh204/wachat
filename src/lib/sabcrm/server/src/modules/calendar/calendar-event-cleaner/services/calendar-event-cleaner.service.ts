// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/calendar-event-cleaner/services/calendar-event-cleaner.service.ts
// NestJS service converted to plain exported functions backed by MongoDB.
// TypeORM/TypeORM transaction helpers replaced with Mongo sessions where appropriate.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// deleteCalendarChannelEventAssociationsByChannelId
// ---------------------------------------------------------------------------

export async function deleteCalendarChannelEventAssociationsByChannelId({
  workspaceId,
  calendarChannelId,
}: {
  workspaceId: string;
  calendarChannelId: string;
}): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_calendarChannelEventAssociation");

  // Delete in batches to avoid large single writes
  let deleted = 0;

  do {
    const batch = await col
      .find({ calendarChannelId, workspaceId })
      .limit(BATCH_SIZE)
      .project({ id: 1 })
      .toArray();

    if (batch.length === 0) break;

    const ids = batch.map((doc: { id?: string; _id?: unknown }) => doc.id).filter(Boolean);

    const result = await col.deleteMany({ id: { $in: ids }, workspaceId });
    deleted = result.deletedCount ?? 0;
  } while (deleted >= BATCH_SIZE);
}

// ---------------------------------------------------------------------------
// cleanWorkspaceCalendarEvents
// ---------------------------------------------------------------------------

export async function cleanWorkspaceCalendarEvents(
  workspaceId: string,
): Promise<void> {
  const { db } = await connectToDatabase();
  const calendarEventCol = db.collection("sabcrm_calendarEvent");
  const assocCol = db.collection("sabcrm_calendarChannelEventAssociation");

  // Delete calendar events that have no associated channel-event-associations.
  // We do this in batches.

  let deleted = 0;

  do {
    // Find event ids that have no associations
    const allAssociatedEventIds = await assocCol
      .distinct("calendarEventId", { workspaceId });

    const orphanedEvents = await calendarEventCol
      .find({
        workspaceId,
        id: { $nin: allAssociatedEventIds },
      })
      .limit(BATCH_SIZE)
      .project({ id: 1 })
      .toArray();

    if (orphanedEvents.length === 0) break;

    const ids = orphanedEvents
      .map((doc: { id?: string }) => doc.id)
      .filter(Boolean);

    const result = await calendarEventCol.deleteMany({
      id: { $in: ids },
      workspaceId,
    });
    deleted = result.deletedCount ?? 0;
  } while (deleted >= BATCH_SIZE);
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class CalendarEventCleanerService {
  async deleteCalendarChannelEventAssociationsByChannelId(args: {
    workspaceId: string;
    calendarChannelId: string;
  }) {
    return deleteCalendarChannelEventAssociationsByChannelId(args);
  }

  async cleanWorkspaceCalendarEvents(workspaceId: string) {
    return cleanWorkspaceCalendarEvents(workspaceId);
  }
}
