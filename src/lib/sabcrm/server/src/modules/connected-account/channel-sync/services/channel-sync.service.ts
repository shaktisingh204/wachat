import "server-only";

// service: ChannelSyncService → plain exported functions backed by Mongo queue stubs.
// Business logic: find pending message/calendar channels for a connected account
// and enqueue list-fetch jobs for each.

export type StartChannelSyncInput = {
  connectedAccountId: string;
  workspaceId: string;
};

// ---- shared enums (sourced from twenty-shared/types) ----

export const MessageChannelSyncStage = {
  PENDING_CONFIGURATION: "PENDING_CONFIGURATION",
  FULL_MESSAGE_LIST_FETCH_PENDING: "FULL_MESSAGE_LIST_FETCH_PENDING",
  MESSAGES_LIST_FETCH_SCHEDULED: "MESSAGES_LIST_FETCH_SCHEDULED",
} as const;
export type MessageChannelSyncStage =
  (typeof MessageChannelSyncStage)[keyof typeof MessageChannelSyncStage];

export const MessageChannelType = {
  EMAIL: "EMAIL",
  EMAIL_GROUP: "EMAIL_GROUP",
} as const;
export type MessageChannelType =
  (typeof MessageChannelType)[keyof typeof MessageChannelType];

export const CalendarChannelSyncStage = {
  PENDING_CONFIGURATION: "PENDING_CONFIGURATION",
  CALENDAR_EVENT_LIST_FETCH_SCHEDULED:
    "CALENDAR_EVENT_LIST_FETCH_SCHEDULED",
} as const;
export type CalendarChannelSyncStage =
  (typeof CalendarChannelSyncStage)[keyof typeof CalendarChannelSyncStage];

export const CalendarChannelSyncStatus = {
  ONGOING: "ONGOING",
  ACTIVE: "ACTIVE",
  FAILED: "FAILED",
  NOT_SYNCED: "NOT_SYNCED",
} as const;
export type CalendarChannelSyncStatus =
  (typeof CalendarChannelSyncStatus)[keyof typeof CalendarChannelSyncStatus];

// ---- queue helpers (thin wrappers — real queue implementation provided by SabNode) ----

async function enqueueMessagingListFetch(
  workspaceId: string,
  messageChannelId: string,
): Promise<void> {
  // PORT-NOTE: In Twenty this dispatches to BullMQ (MessageQueue.messagingQueue →
  // MessagingMessageListFetchJob). In SabNode, wire this to the equivalent
  // job dispatcher from src/lib/sabcrm/server/src/modules/messaging/.
  console.info(
    `[channel-sync] enqueue messaging list fetch: workspace=${workspaceId} channel=${messageChannelId}`,
  );
}

async function enqueueCalendarEventListFetch(
  workspaceId: string,
  calendarChannelId: string,
): Promise<void> {
  // PORT-NOTE: In Twenty this dispatches to BullMQ (MessageQueue.calendarQueue →
  // CalendarEventListFetchJob). In SabNode, wire this to the equivalent
  // job dispatcher from src/lib/sabcrm/server/src/modules/calendar/.
  console.info(
    `[channel-sync] enqueue calendar list fetch: workspace=${workspaceId} channel=${calendarChannelId}`,
  );
}

// ---- Mongo collection helpers ----

import { connectToDatabase } from "@/lib/mongodb";

interface MessageChannelDoc {
  _id: string;
  id: string;
  connectedAccountId: string;
  syncStage: MessageChannelSyncStage;
  type: MessageChannelType;
  workspaceId: string;
}

interface CalendarChannelDoc {
  _id: string;
  id: string;
  connectedAccountId: string;
  syncStage: CalendarChannelSyncStage;
  syncStatus: CalendarChannelSyncStatus;
  workspaceId: string;
}

async function getMessageChannelCollection() {
  const { db } = await connectToDatabase();
  return db.collection<MessageChannelDoc>("sabcrm_message_channel");
}

async function getCalendarChannelCollection() {
  const { db } = await connectToDatabase();
  return db.collection<CalendarChannelDoc>("sabcrm_calendar_channel");
}

// ---- core service functions ----

async function startMessageChannelSync(
  connectedAccountId: string,
  workspaceId: string,
): Promise<void> {
  const col = await getMessageChannelCollection();

  const messageChannels = await col
    .find({
      connectedAccountId,
      workspaceId,
      syncStage: MessageChannelSyncStage.PENDING_CONFIGURATION,
      type: { $ne: MessageChannelType.EMAIL_GROUP },
    })
    .toArray();

  for (const messageChannel of messageChannels) {
    // Mark as scheduled before enqueueing.
    await col.updateOne(
      { id: messageChannel.id, workspaceId },
      {
        $set: {
          syncStage:
            MessageChannelSyncStage.MESSAGES_LIST_FETCH_SCHEDULED,
        },
      },
    );

    await enqueueMessagingListFetch(workspaceId, messageChannel.id);
  }
}

async function startCalendarChannelSync(
  connectedAccountId: string,
  workspaceId: string,
): Promise<void> {
  const col = await getCalendarChannelCollection();

  const calendarChannels = await col
    .find({
      connectedAccountId,
      workspaceId,
      syncStage: CalendarChannelSyncStage.PENDING_CONFIGURATION,
    })
    .toArray();

  for (const calendarChannel of calendarChannels) {
    await col.updateOne(
      { id: calendarChannel.id, workspaceId },
      {
        $set: {
          syncStage:
            CalendarChannelSyncStage.CALENDAR_EVENT_LIST_FETCH_SCHEDULED,
          syncStatus: CalendarChannelSyncStatus.ONGOING,
        },
      },
    );

    await enqueueCalendarEventListFetch(workspaceId, calendarChannel.id);
  }
}

export async function startChannelSync(
  input: StartChannelSyncInput,
): Promise<void> {
  const { connectedAccountId, workspaceId } = input;

  await startMessageChannelSync(connectedAccountId, workspaceId);
  await startCalendarChannelSync(connectedAccountId, workspaceId);
}
