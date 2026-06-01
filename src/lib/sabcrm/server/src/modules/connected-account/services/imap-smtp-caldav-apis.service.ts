import "server-only";

// PORT-NOTE: Ported from NestJS ImapSmtpCalDavAPIService.
// NestJS DI, TypeORM, EntityManager, and BullMQ queue injection removed.
// All Mongo operations use connectToDatabase from @/lib/mongodb.
// Transaction semantics approximated with sequential Mongo writes (no session by default).
// CreateCalendarChannelService, CreateMessageChannelService, SyncMessageFoldersService,
// AccountsToReconnectService, MessageChannelSyncStatusService, CalendarChannelSyncStatusService,
// and ConnectedAccountTokenEncryptionService are injected at call-site.

import { connectToDatabase } from "@/lib/mongodb";
import { v4 } from "uuid";

// Sync stage enumerations (mirrored from twenty-shared/types)
export const MessageChannelSyncStage = {
  PENDING_CONFIGURATION: "PENDING_CONFIGURATION",
  MESSAGE_LIST_FETCH_PENDING: "MESSAGE_LIST_FETCH_PENDING",
  PARTIAL_MESSAGE_LIST_FETCH_PENDING: "PARTIAL_MESSAGE_LIST_FETCH_PENDING",
  MESSAGE_LIST_FETCH_ONGOING: "MESSAGE_LIST_FETCH_ONGOING",
  MESSAGE_IMPORT_PENDING: "MESSAGE_IMPORT_PENDING",
  MESSAGE_IMPORT_ONGOING: "MESSAGE_IMPORT_ONGOING",
  FAILED: "FAILED",
} as const;

export const CalendarChannelSyncStage = {
  PENDING_CONFIGURATION: "PENDING_CONFIGURATION",
  CALENDAR_EVENT_LIST_FETCH_PENDING: "CALENDAR_EVENT_LIST_FETCH_PENDING",
  FULL_CALENDAR_EVENT_LIST_FETCH_PENDING:
    "FULL_CALENDAR_EVENT_LIST_FETCH_PENDING",
  CALENDAR_EVENT_LIST_FETCH_ONGOING: "CALENDAR_EVENT_LIST_FETCH_ONGOING",
  CALENDAR_EVENT_IMPORT_PENDING: "CALENDAR_EVENT_IMPORT_PENDING",
  CALENDAR_EVENT_IMPORT_ONGOING: "CALENDAR_EVENT_IMPORT_ONGOING",
  FAILED: "FAILED",
} as const;

export const ConnectedAccountProvider = {
  IMAP_SMTP_CALDAV: "IMAP_SMTP_CALDAV",
} as const;

// Plaintext IMAP/SMTP/CalDAV connection parameters
export type PlaintextConnectionParameters = {
  host: string;
  port: number;
  username?: string;
  secure?: boolean;
  password: string;
};

export type PlaintextImapSmtpCaldavParams = {
  IMAP?: PlaintextConnectionParameters;
  SMTP?: PlaintextConnectionParameters;
  CALDAV?: PlaintextConnectionParameters;
};

// Minimal document types for referenced collections
export type ConnectedAccountDoc = {
  id: string;
  handle: string;
  provider: string;
  userWorkspaceId: string;
  workspaceId: string;
  authFailedAt?: Date | null;
  connectionParameters?: unknown;
};

export type MessageChannelDoc = {
  id: string;
  connectedAccountId: string;
  workspaceId: string;
  syncStage: string;
};

export type CalendarChannelDoc = {
  id: string;
  connectedAccountId: string;
  workspaceId: string;
  syncStage: string;
};

export type UserWorkspaceDoc = {
  id: string;
  userId: string;
  workspaceId: string;
};

// Service interfaces for injected dependencies
interface CreateMessageChannelServiceLike {
  createMessageChannel(opts: {
    workspaceId: string;
    connectedAccountId: string;
    handle: string;
  }): Promise<void>;
}

interface CreateCalendarChannelServiceLike {
  createCalendarChannel(opts: {
    workspaceId: string;
    connectedAccountId: string;
    handle: string;
  }): Promise<void>;
}

interface SyncMessageFoldersServiceLike {
  syncMessageFolders(opts: {
    messageChannel: MessageChannelDoc;
    workspaceId: string;
  }): Promise<void>;
}

interface AccountsToReconnectServiceLike {
  removeAccountToReconnect(
    userId: string,
    workspaceId: string,
    connectedAccountId: string,
  ): Promise<void>;
}

interface MessageChannelSyncStatusServiceLike {
  resetAndMarkAsMessagesListFetchPending(
    channelIds: string[],
    workspaceId: string,
  ): Promise<void>;
}

interface CalendarChannelSyncStatusServiceLike {
  resetAndMarkAsCalendarEventListFetchPending(
    channelIds: string[],
    workspaceId: string,
  ): Promise<void>;
}

interface ConnectedAccountTokenEncryptionServiceLike {
  encryptConnectionParameters(opts: {
    connectionParameters: PlaintextImapSmtpCaldavParams;
    workspaceId: string;
  }): unknown;
}

// Queue job payload types
export type MessagingMessageListFetchJobData = {
  workspaceId: string;
  messageChannelId: string;
};

export type CalendarEventListFetchJobData = {
  workspaceId: string;
  calendarChannelId: string;
};

interface QueueServiceLike {
  add<T>(jobName: string, data: T): Promise<void>;
}

export function createImapSmtpCalDavAPIService(deps: {
  createMessageChannelService: CreateMessageChannelServiceLike;
  createCalendarChannelService: CreateCalendarChannelServiceLike;
  syncMessageFoldersService: SyncMessageFoldersServiceLike;
  accountsToReconnectService: AccountsToReconnectServiceLike;
  messagingChannelSyncStatusService: MessageChannelSyncStatusServiceLike;
  calendarChannelSyncStatusService: CalendarChannelSyncStatusServiceLike;
  connectedAccountTokenEncryptionService: ConnectedAccountTokenEncryptionServiceLike;
  messageQueueService: QueueServiceLike;
  calendarQueueService: QueueServiceLike;
}) {
  const {
    createMessageChannelService,
    createCalendarChannelService,
    syncMessageFoldersService,
    accountsToReconnectService,
    messagingChannelSyncStatusService,
    calendarChannelSyncStatusService,
    connectedAccountTokenEncryptionService,
    messageQueueService,
    calendarQueueService,
  } = deps;

  async function upsertConnectedAccount(input: {
    handle: string;
    userWorkspaceId: string;
    workspaceId: string;
    connectionParameters: PlaintextImapSmtpCaldavParams;
    existingAccount?: ConnectedAccountDoc | null;
  }): Promise<string> {
    const { handle, workspaceId, userWorkspaceId } = input;

    const { db } = await connectToDatabase();

    const userWorkspace = await db
      .collection<UserWorkspaceDoc>("sabcrm_user_workspace")
      .findOne({ id: userWorkspaceId, workspaceId });

    if (!userWorkspace) {
      throw new Error(
        `UserWorkspace with id ${userWorkspaceId} not found in workspace ${workspaceId}`,
      );
    }

    const existingAccount =
      input.existingAccount ??
      (await db
        .collection<ConnectedAccountDoc>("sabcrm_connected_account")
        .findOne({ handle, userWorkspaceId, workspaceId }));

    const newOrExistingAccountId = existingAccount?.id ?? v4();

    const existingMessageChannel = existingAccount
      ? await db
          .collection<MessageChannelDoc>("sabcrm_message_channel")
          .findOne({
            connectedAccountId: existingAccount.id,
            workspaceId,
          })
      : null;

    const existingCalendarChannel = existingAccount
      ? await db
          .collection<CalendarChannelDoc>("sabcrm_calendar_channel")
          .findOne({
            connectedAccountId: existingAccount.id,
            workspaceId,
          })
      : null;

    const shouldCreateMessageChannel =
      !existingMessageChannel && Boolean(input.connectionParameters.IMAP);

    const shouldCreateCalendarChannel =
      !existingCalendarChannel && Boolean(input.connectionParameters.CALDAV);

    const encryptedConnectionParameters =
      connectedAccountTokenEncryptionService.encryptConnectionParameters({
        connectionParameters: input.connectionParameters,
        workspaceId,
      });

    // Upsert the connected account
    await db
      .collection<ConnectedAccountDoc>("sabcrm_connected_account")
      .updateOne(
        { id: newOrExistingAccountId },
        {
          $set: {
            id: newOrExistingAccountId,
            handle,
            provider: ConnectedAccountProvider.IMAP_SMTP_CALDAV,
            connectionParameters: encryptedConnectionParameters,
            userWorkspaceId,
            workspaceId,
            authFailedAt: null,
          },
        },
        { upsert: true },
      );

    if (shouldCreateMessageChannel) {
      await createMessageChannelService.createMessageChannel({
        workspaceId,
        connectedAccountId: newOrExistingAccountId,
        handle,
      });
    }

    if (shouldCreateCalendarChannel) {
      await createCalendarChannelService.createCalendarChannel({
        workspaceId,
        connectedAccountId: newOrExistingAccountId,
        handle,
      });
    }

    if (existingAccount) {
      await accountsToReconnectService.removeAccountToReconnect(
        userWorkspace.userId,
        workspaceId,
        newOrExistingAccountId,
      );
    }

    if (shouldCreateMessageChannel) {
      const newMessageChannel = await db
        .collection<MessageChannelDoc>("sabcrm_message_channel")
        .findOne({ connectedAccountId: newOrExistingAccountId, workspaceId });

      if (newMessageChannel) {
        try {
          await syncMessageFoldersService.syncMessageFolders({
            messageChannel: newMessageChannel,
            workspaceId,
          });
        } catch (error) {
          const err = error as Error;
          console.warn(
            `Initial folder sync failed for account ${newOrExistingAccountId}, will retry on next scheduled sync: ${err?.message}`,
          );
        }
      }
    }

    if (
      existingMessageChannel &&
      input.connectionParameters.IMAP &&
      existingMessageChannel.syncStage !==
        MessageChannelSyncStage.PENDING_CONFIGURATION
    ) {
      await messagingChannelSyncStatusService.resetAndMarkAsMessagesListFetchPending(
        [existingMessageChannel.id],
        workspaceId,
      );

      await messageQueueService.add<MessagingMessageListFetchJobData>(
        "MessagingMessageListFetchJob",
        { workspaceId, messageChannelId: existingMessageChannel.id },
      );
    }

    if (
      existingCalendarChannel &&
      input.connectionParameters.CALDAV &&
      existingCalendarChannel.syncStage !==
        CalendarChannelSyncStage.PENDING_CONFIGURATION
    ) {
      await calendarChannelSyncStatusService.resetAndMarkAsCalendarEventListFetchPending(
        [existingCalendarChannel.id],
        workspaceId,
      );

      await calendarQueueService.add<CalendarEventListFetchJobData>(
        "CalendarEventListFetchJob",
        { workspaceId, calendarChannelId: existingCalendarChannel.id },
      );
    }

    return newOrExistingAccountId;
  }

  return {
    upsertConnectedAccount,
  };
}
