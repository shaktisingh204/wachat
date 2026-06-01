import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.21.0', 1775500012000)
// Ported to plain async functions backed by MongoDB.
// Original: backfills connectedAccount, messageChannel, calendarChannel, and messageFolder
// from workspace-scoped Postgres tables into a global core schema.
// In Mongo there is a single collection per entity (sabcrm_*) with workspaceId discrimination.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Types (preserved from source)
// ---------------------------------------------------------------------------

type LegacyConnectedAccountWorkspaceEntity = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  handle: string | null;
  provider: string;
  accessToken: string | null;
  refreshToken: string | null;
  lastSyncHistoryId: string | null;
  lastCredentialsRefreshedAt: Date | null;
  authFailedAt: Date | null;
  accountOwnerId: string;
  handleAliases: string | null;
  scopes: string[] | null;
  connectionParameters: Record<string, unknown> | null;
};

type WorkspaceMemberDoc = {
  _id: string;
  userId: string;
  workspaceId: string;
};

type UserWorkspaceDoc = {
  _id: string;
  userId: string;
  workspaceId: string;
};

type ConnectedAccountDoc = {
  _id: string;
  workspaceId: string;
  [key: string]: unknown;
};

type MessageChannelDoc = {
  _id: string;
  workspaceId: string;
  connectedAccountId: string;
  [key: string]: unknown;
};

type CalendarChannelDoc = {
  _id: string;
  workspaceId: string;
  connectedAccountId: string;
  [key: string]: unknown;
};

type MessageFolderDoc = {
  _id: string;
  workspaceId: string;
  messageChannelId: string;
  externalId: string;
  parentFolderId: string | null;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

async function buildWorkspaceMemberIdToUserWorkspaceIdMap(
  db: Awaited<ReturnType<typeof connectToDatabase>>["db"],
  workspaceId: string,
): Promise<Map<string, string>> {
  const workspaceMembers = await db
    .collection<WorkspaceMemberDoc>("sabcrm_workspaceMember")
    .find({ workspaceId })
    .toArray();

  const userWorkspaces = await db
    .collection<UserWorkspaceDoc>("sabcrm_userWorkspace")
    .find({ workspaceId }, { projection: { _id: 1, userId: 1 } })
    .toArray();

  const userWorkspaceIdByUserId = new Map(
    userWorkspaces.map((uw) => [uw.userId, uw._id]),
  );

  const result = new Map<string, string>();
  for (const member of workspaceMembers) {
    const userWorkspaceId = userWorkspaceIdByUserId.get(member.userId);
    if (userWorkspaceId) {
      result.set(member._id, userWorkspaceId);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function migrateMessagingInfrastructureToMetadata(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const { db } = await connectToDatabase();

  // Check if already migrated (feature flag analogue: a doc in sabcrm_featureFlag)
  const featureFlagDoc = await db
    .collection("sabcrm_featureFlag")
    .findOne({ key: "IS_CONNECTED_ACCOUNT_MIGRATED", workspaceId });

  if (featureFlagDoc?.isEnabled) {
    console.log(
      `Messaging infrastructure migration already completed for workspace ${workspaceId}. Skipping.`,
    );
    return;
  }

  const isDryRun = options.dryRun ?? false;

  // Load workspace-scoped legacy data
  const connectedAccounts = await db
    .collection<LegacyConnectedAccountWorkspaceEntity & { workspaceId: string }>(
      "sabcrm_connectedAccount_workspace",
    )
    .find({ workspaceId })
    .toArray();

  const messageChannels = await db
    .collection<MessageChannelDoc>("sabcrm_messageChannel_workspace")
    .find({ workspaceId })
    .toArray();

  const calendarChannels = await db
    .collection<CalendarChannelDoc>("sabcrm_calendarChannel_workspace")
    .find({ workspaceId })
    .toArray();

  const messageFolders = await db
    .collection<MessageFolderDoc>("sabcrm_messageFolder_workspace")
    .find({ workspaceId })
    .toArray();

  const workspaceMemberIdToUserWorkspaceIdMap =
    await buildWorkspaceMemberIdToUserWorkspaceIdMap(db, workspaceId);

  const connectedAccountsWithMissingHandle = connectedAccounts.filter(
    (account) => !account.handle,
  );
  const connectedAccountsWithUnresolvedOwner = connectedAccounts.filter(
    (account) =>
      !workspaceMemberIdToUserWorkspaceIdMap.has(account.accountOwnerId),
  );
  const messageChannelsWithMissingHandle = messageChannels.filter(
    (channel) => !(channel as { handle?: string }).handle,
  );
  const calendarChannelsWithMissingHandle = calendarChannels.filter(
    (channel) => !(channel as { handle?: string }).handle,
  );

  if (isDryRun) {
    console.log(
      `[DRY RUN] Workspace ${workspaceId}: ` +
        `${connectedAccounts.length} connected accounts, ` +
        `${messageChannels.length} message channels, ` +
        `${calendarChannels.length} calendar channels, ` +
        `${messageFolders.length} message folders`,
    );
    if (connectedAccountsWithMissingHandle.length > 0) {
      console.warn(
        `[DRY RUN] ${connectedAccountsWithMissingHandle.length} connected accounts have empty handle`,
      );
    }
    if (connectedAccountsWithUnresolvedOwner.length > 0) {
      console.warn(
        `[DRY RUN] ${connectedAccountsWithUnresolvedOwner.length} connected accounts have unresolvable accountOwnerId`,
      );
    }
    if (messageChannelsWithMissingHandle.length > 0) {
      console.warn(
        `[DRY RUN] ${messageChannelsWithMissingHandle.length} message channels have empty handle`,
      );
    }
    if (calendarChannelsWithMissingHandle.length > 0) {
      console.warn(
        `[DRY RUN] ${calendarChannelsWithMissingHandle.length} calendar channels have empty handle`,
      );
    }
    return;
  }

  // --- Migrate connected accounts ---
  let migratedConnectedAccountIds = new Set<string>();
  let migratedMessageChannelIds = new Set<string>();

  if (connectedAccounts.length > 0) {
    const coreConnectedAccounts = connectedAccounts
      .filter((account) => {
        const userWorkspaceId = workspaceMemberIdToUserWorkspaceIdMap.get(
          account.accountOwnerId,
        );
        if (!userWorkspaceId) {
          console.warn(
            `Skipping connected account ${account.id}: no userWorkspace found for workspaceMember ${account.accountOwnerId}`,
          );
          return false;
        }
        return true;
      })
      .map((account) => {
        const handleAliases = isNonEmptyString(account.handleAliases)
          ? account.handleAliases.split(",").map((a) => a.trim())
          : null;

        return {
          _id: account.id,
          handle: account.handle ?? "",
          provider: account.provider,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          lastCredentialsRefreshedAt: account.lastCredentialsRefreshedAt,
          authFailedAt: account.authFailedAt,
          handleAliases,
          scopes: account.scopes,
          connectionParameters: account.connectionParameters ?? null,
          userWorkspaceId: workspaceMemberIdToUserWorkspaceIdMap.get(
            account.accountOwnerId,
          )!,
          workspaceId,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        };
      });

    if (coreConnectedAccounts.length > 0) {
      for (const doc of coreConnectedAccounts) {
        await db
          .collection("sabcrm_connectedAccount")
          .updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
      }
      console.log(
        `Migrated ${coreConnectedAccounts.length} connected accounts for workspace ${workspaceId}`,
      );
    }

    migratedConnectedAccountIds = new Set(
      coreConnectedAccounts.map((a) => a._id),
    );
  }

  // --- Migrate message channels ---
  if (messageChannels.length > 0) {
    const coreMessageChannels = messageChannels
      .filter((channel) =>
        migratedConnectedAccountIds.has(
          (channel as { connectedAccountId: string }).connectedAccountId,
        ),
      )
      .map((channel) => ({
        _id: channel._id,
        ...channel,
        handle: (channel as { handle?: string }).handle ?? "",
        syncStatus: (channel as { syncStatus?: string }).syncStatus ?? "NOT_SYNCED",
        workspaceId,
      }));

    if (coreMessageChannels.length > 0) {
      for (const doc of coreMessageChannels) {
        await db
          .collection("sabcrm_messageChannel")
          .updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
      }
      console.log(
        `Migrated ${coreMessageChannels.length} message channels for workspace ${workspaceId}`,
      );
    }

    migratedMessageChannelIds = new Set(coreMessageChannels.map((c) => c._id));
  }

  // --- Migrate calendar channels ---
  if (calendarChannels.length > 0) {
    const coreCalendarChannels = calendarChannels
      .filter((channel) =>
        migratedConnectedAccountIds.has(channel.connectedAccountId),
      )
      .map((channel) => ({
        _id: channel._id,
        ...channel,
        handle: (channel as { handle?: string }).handle ?? "",
        syncStatus: (channel as { syncStatus?: string }).syncStatus ?? "NOT_SYNCED",
        workspaceId,
      }));

    for (const doc of coreCalendarChannels) {
      await db
        .collection("sabcrm_calendarChannel")
        .updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
    }
    console.log(
      `Migrated ${coreCalendarChannels.length} calendar channels for workspace ${workspaceId}`,
    );
  }

  // --- Migrate message folders ---
  if (messageFolders.length > 0) {
    const externalIdToFolderIdMap = new Map(
      messageFolders.map((folder) => [folder.externalId, folder._id]),
    );

    const coreMessageFolders = messageFolders
      .filter((folder) =>
        migratedMessageChannelIds.has(folder.messageChannelId),
      )
      .map((folder) => {
        let resolvedParentFolderId: string | null = null;

        if (isNonEmptyString(folder.parentFolderId)) {
          resolvedParentFolderId =
            externalIdToFolderIdMap.get(folder.parentFolderId) ?? null;
          if (!resolvedParentFolderId) {
            console.warn(
              `Message folder ${folder._id}: could not resolve parentFolderId externalId "${folder.parentFolderId}" to a UUID`,
            );
          }
        }

        return {
          _id: folder._id,
          ...folder,
          parentFolderId: resolvedParentFolderId,
          workspaceId,
        };
      });

    for (const doc of coreMessageFolders) {
      await db
        .collection("sabcrm_messageFolder")
        .updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
    }
    console.log(
      `Migrated ${coreMessageFolders.length} message folders for workspace ${workspaceId}`,
    );
  }
}
