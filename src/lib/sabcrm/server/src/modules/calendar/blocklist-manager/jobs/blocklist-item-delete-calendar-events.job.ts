// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/blocklist-manager/jobs/blocklist-item-delete-calendar-events.job.ts
// BullMQ processor converted to a plain async function.
// TypeORM queries replaced with MongoDB aggregations / deletes.
// The job can be invoked from a background worker or a Vercel Cron route.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import type { BlocklistDocument } from "@/lib/sabcrm/server/src/modules/blocklist/standard-objects/blocklist.workspace-entity";
import { cleanWorkspaceCalendarEvents } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-cleaner/services/calendar-event-cleaner.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlocklistItemDeleteCalendarEventsJobData = {
  workspaceId: string;
  events: Array<{ recordId: string }>;
};

// ---------------------------------------------------------------------------
// Job handler
// ---------------------------------------------------------------------------

export async function handleBlocklistItemDeleteCalendarEvents(
  data: BlocklistItemDeleteCalendarEventsJobData,
): Promise<void> {
  const { db } = await connectToDatabase();
  const workspaceId = data.workspaceId;

  const blocklistItemIds = data.events.map((e) => e.recordId);

  // Fetch blocklist documents for the given ids
  const blocklist = await db
    .collection<BlocklistDocument>("sabcrm_blocklist")
    .find({ id: { $in: blocklistItemIds }, workspaceId })
    .toArray();

  // Build a map: workspaceMemberId -> handles[]
  const handlesToDeleteByMemberId = new Map<string, string[]>();

  for (const item of blocklist) {
    if (!item.handle) continue;

    const existing = handlesToDeleteByMemberId.get(item.workspaceMemberId) ?? [];
    existing.push(item.handle);
    handlesToDeleteByMemberId.set(item.workspaceMemberId, existing);
  }

  // For each workspace member, find matching calendar channel event associations
  // and delete them.
  // PORT-NOTE: CalendarChannelEntity and CalendarChannelEventAssociation are
  // stored in the metadata DB (Postgres in the original). In SabNode's Mongo
  // stack, these live in sabcrm_calendarChannel / sabcrm_calendarChannelEventAssociation.

  const calendarChannelCol = db.collection("sabcrm_calendarChannel");
  const eventAssocCol = db.collection(
    "sabcrm_calendarChannelEventAssociation",
  );

  for (const [workspaceMemberId, handles] of handlesToDeleteByMemberId) {
    // Resolve userId from workspace-member document
    const workspaceMember = await db
      .collection("sabcrm_workspaceMember")
      .findOne({ id: workspaceMemberId, workspaceId });

    if (!workspaceMember) continue;

    // Resolve user-workspace
    const userWorkspace = await db
      .collection("sabcrm_userWorkspace")
      .findOne({ userId: workspaceMember.userId, workspaceId });

    if (!userWorkspace) continue;

    // Find calendar channels for the user workspace
    const calendarChannels = await calendarChannelCol
      .find({ userWorkspaceId: userWorkspace.id, workspaceId })
      .toArray();

    for (const calendarChannel of calendarChannels) {
      const calendarChannelHandles: string[] = [calendarChannel.handle];

      if (calendarChannel.handleAliases) {
        const raw = calendarChannel.handleAliases as string | string[];
        const aliases = Array.isArray(raw)
          ? raw
          : raw.split(",").map((s: string) => s.trim());
        calendarChannelHandles.push(...aliases);
      }

      // Build participant handle conditions for blocklisted handles
      const handleConditions = handles.map((handle) => {
        if (handle.startsWith("@")) {
          const domain = handle.slice(1);
          return {
            $or: [
              { "calendarEvent.participants.handle": { $regex: `${domain}$`, $options: "i" } },
              { "calendarEvent.participants.handle": { $regex: `\\.${domain}$`, $options: "i" } },
            ],
          };
        }
        return { "calendarEvent.participants.handle": handle };
      });

      // Find associations whose events have a participant that matches a blocklisted handle
      // and is NOT one of the channel's own handles
      const associations = await eventAssocCol
        .find({
          calendarChannelId: calendarChannel.id,
          "calendarEvent.calendarEventParticipants": {
            $elemMatch: {
              handle: { $nin: calendarChannelHandles },
              $or: handles.map((handle) => {
                if (handle.startsWith("@")) {
                  const domain = handle.slice(1);
                  return {
                    $or: [
                      { handle: { $regex: `${domain}$`, $options: "i" } },
                      { handle: { $regex: `\\.${domain}$`, $options: "i" } },
                    ],
                  };
                }
                return { handle };
              }),
            },
          },
        })
        .toArray();

      if (associations.length === 0) continue;

      const assocIds = associations.map((a: { id: string }) => a.id);

      await eventAssocCol.deleteMany({ id: { $in: assocIds }, workspaceId });
    }
  }

  await cleanWorkspaceCalendarEvents(workspaceId);
}

// ---------------------------------------------------------------------------
// Class façade (matches original processor shape)
// ---------------------------------------------------------------------------

export class BlocklistItemDeleteCalendarEventsJob {
  async handle(data: BlocklistItemDeleteCalendarEventsJobData): Promise<void> {
    return handleBlocklistItemDeleteCalendarEvents(data);
  }
}
