import "server-only";

import { randomUUID } from "crypto";

import { Filter, Sort } from "mongodb";

import {
  type UpgradeMigrationDocument,
  type UpgradeMigrationStatus,
  getUpgradeMigrationCollection,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/upgrade-migration.entity";
import { extractVersionFromCommandName } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/extract-version-from-command-name.util";
import { formatUpgradeErrorForStorage } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/format-upgrade-error-for-storage.util";

// PORT-NOTE: NestJS DI (@Injectable, @InjectRepository) removed.
// TypeORM QueryRunner is replaced by a no-op option (Mongo is session-based).
// TypeORM-specific SQL subqueries are replaced with Mongo aggregations.

const UPGRADE_MIGRATION_SAVE_BATCH_SIZE = 1000;

export type WorkspaceLastAttemptedCommand = {
  workspaceId: string;
  name: string;
  status: UpgradeMigrationStatus;
  executedByVersion: string;
  errorMessage: string | null;
  createdAt: Date;
  isInitial: boolean;
};

async function chunkSave(
  docs: Omit<UpgradeMigrationDocument, "_id">[],
): Promise<void> {
  const col = await getUpgradeMigrationCollection();

  for (let i = 0; i < docs.length; i += UPGRADE_MIGRATION_SAVE_BATCH_SIZE) {
    const batch = docs.slice(i, i + UPGRADE_MIGRATION_SAVE_BATCH_SIZE);
    await col.insertMany(batch as UpgradeMigrationDocument[]);
  }
}

async function countWhere(
  filter: Filter<UpgradeMigrationDocument>,
): Promise<number> {
  const col = await getUpgradeMigrationCollection();
  return col.countDocuments(filter);
}

// ---------------------------------------------------------------------------

export async function getInferredVersion(
  commandName?: string,
): Promise<string | null> {
  if (commandName != null) {
    return extractVersionFromCommandName(commandName);
  }

  const migration = await getLastAttemptedInstanceCommand();

  return migration != null
    ? extractVersionFromCommandName(migration.name)
    : null;
}

export async function isLastAttemptCompleted({
  name,
  workspaceId,
}: {
  name: string;
  workspaceId: string | null;
}): Promise<boolean> {
  const col = await getUpgradeMigrationCollection();

  const filter: Filter<UpgradeMigrationDocument> = {
    name,
    workspaceId: workspaceId === null ? null : workspaceId,
  };

  const latestAttempt = await col.findOne(filter, {
    sort: { attempt: -1 } as Sort,
  });

  return latestAttempt != null && latestAttempt.status === "completed";
}

export async function recordUpgradeMigration(
  params:
    | {
        name: string;
        workspaceIds: string[];
        isInstance: boolean;
        status: "completed";
        executedByVersion: string;
      }
    | {
        name: string;
        workspaceIds: string[];
        isInstance: boolean;
        status: "failed";
        executedByVersion: string;
        error: unknown;
      },
): Promise<void> {
  const { name, workspaceIds, isInstance, status, executedByVersion } = params;

  const errorMessage =
    params.status === "failed"
      ? formatUpgradeErrorForStorage(params.error)
      : null;

  if (isInstance) {
    const previousAttempts = await countWhere({
      name,
      workspaceId: null,
    });

    const instanceRows: Omit<UpgradeMigrationDocument, "_id">[] = [
      {
        id: randomUUID(),
        name,
        status,
        attempt: previousAttempts + 1,
        executedByVersion,
        workspaceId: null,
        errorMessage,
        isInitial: false,
        createdAt: new Date(),
      },
      ...workspaceIds.map((workspaceId) => ({
        id: randomUUID(),
        name,
        status,
        attempt: previousAttempts + 1,
        executedByVersion,
        workspaceId,
        errorMessage,
        isInitial: false,
        createdAt: new Date(),
      })),
    ];

    await chunkSave(instanceRows);
    return;
  }

  const rows: Omit<UpgradeMigrationDocument, "_id">[] = [];

  for (const workspaceId of workspaceIds) {
    const previousAttempts = await countWhere({ name, workspaceId });

    rows.push({
      id: randomUUID(),
      name,
      status,
      attempt: previousAttempts + 1,
      executedByVersion,
      workspaceId,
      errorMessage,
      isInitial: false,
      createdAt: new Date(),
    });
  }

  await chunkSave(rows);
}

export async function markAsWorkspaceInitial({
  name,
  workspaceId,
  executedByVersion,
  status,
}: {
  name: string;
  workspaceId: string;
  executedByVersion: string;
  status: UpgradeMigrationStatus;
}): Promise<void> {
  const col = await getUpgradeMigrationCollection();

  await col.insertOne({
    id: randomUUID(),
    name,
    status,
    isInitial: true,
    attempt: 1,
    executedByVersion,
    workspaceId,
    errorMessage: null,
    createdAt: new Date(),
  });
}

// Returns the most recently attempted command (by createdAt) across instance
// and active-workspace scopes. isInitial records are excluded.
export async function getLastAttemptedCommandNameOrThrow(
  allActiveOrSuspendedWorkspaceIds: string[],
): Promise<{ name: string; status: UpgradeMigrationStatus }> {
  const col = await getUpgradeMigrationCollection();

  // Build match stage
  const workspaceMatch =
    allActiveOrSuspendedWorkspaceIds.length > 0
      ? {
          $or: [
            { workspaceId: null },
            { workspaceId: { $in: allActiveOrSuspendedWorkspaceIds } },
          ],
        }
      : { workspaceId: null };

  // We need the record with the highest attempt per (name, workspaceId), then
  // sort by createdAt DESC and return the first.
  const pipeline = [
    { $match: { isInitial: false, ...workspaceMatch } },
    {
      $sort: { name: 1, workspaceId: 1, attempt: -1 } as Sort,
    },
    {
      $group: {
        _id: { name: "$name", workspaceId: "$workspaceId" },
        name: { $first: "$name" },
        status: { $first: "$status" },
        createdAt: { $first: "$createdAt" },
      },
    },
    { $sort: { createdAt: -1 } as Sort },
    { $limit: 1 },
  ];

  const results = await col.aggregate<{ name: string; status: UpgradeMigrationStatus }>(pipeline).toArray();

  if (results.length === 0) {
    throw new Error(
      "No upgrade migration found — the database may not have been initialized",
    );
  }

  return { name: results[0].name, status: results[0].status };
}

export async function getWorkspaceLastAttemptedCommandName(
  workspaceIds: string[],
): Promise<Map<string, WorkspaceLastAttemptedCommand>> {
  if (workspaceIds.length === 0) {
    return new Map();
  }

  const col = await getUpgradeMigrationCollection();

  // For each workspace: find the most recent record by createdAt (last attempt per name, then latest by createdAt).
  const pipeline = [
    { $match: { workspaceId: { $in: workspaceIds } } },
    // Get max attempt per (workspaceId, name)
    {
      $sort: { workspaceId: 1, name: 1, attempt: -1 } as Sort,
    },
    {
      $group: {
        _id: { workspaceId: "$workspaceId", name: "$name" },
        workspaceId: { $first: "$workspaceId" },
        name: { $first: "$name" },
        status: { $first: "$status" },
        executedByVersion: { $first: "$executedByVersion" },
        errorMessage: { $first: "$errorMessage" },
        createdAt: { $first: "$createdAt" },
        isInitial: { $first: "$isInitial" },
      },
    },
    // Per workspace, pick the latest by createdAt
    { $sort: { workspaceId: 1, createdAt: -1 } as Sort },
    {
      $group: {
        _id: "$workspaceId",
        workspaceId: { $first: "$workspaceId" },
        name: { $first: "$name" },
        status: { $first: "$status" },
        executedByVersion: { $first: "$executedByVersion" },
        errorMessage: { $first: "$errorMessage" },
        createdAt: { $first: "$createdAt" },
        isInitial: { $first: "$isInitial" },
      },
    },
  ];

  const rows = await col
    .aggregate<WorkspaceLastAttemptedCommand & { _id: string }>(pipeline)
    .toArray();

  const cursors = new Map<string, WorkspaceLastAttemptedCommand>();

  for (const row of rows) {
    cursors.set(row.workspaceId, {
      workspaceId: row.workspaceId,
      name: row.name,
      status: row.status,
      executedByVersion: row.executedByVersion,
      errorMessage: row.errorMessage,
      createdAt: row.createdAt,
      isInitial: row.isInitial,
    });
  }

  return cursors;
}

export async function getWorkspaceLastAttemptedCommandNameOrThrow(
  workspaceIds: string[],
): Promise<Map<string, WorkspaceLastAttemptedCommand>> {
  const cursors = await getWorkspaceLastAttemptedCommandName(workspaceIds);

  const missingWorkspaceIds = workspaceIds.filter(
    (workspaceId) => !cursors.has(workspaceId),
  );

  if (missingWorkspaceIds.length > 0) {
    throw new Error(
      `No upgrade migration found for workspace(s): ${missingWorkspaceIds.join(", ")}`,
    );
  }

  return cursors;
}

export async function areAllWorkspacesAtCommand({
  commandName,
  workspaceIds,
}: {
  commandName: string;
  workspaceIds: string[];
}): Promise<boolean> {
  if (workspaceIds.length === 0) {
    return true;
  }

  const col = await getUpgradeMigrationCollection();

  // Count workspaces whose latest attempt for commandName is completed.
  const pipeline = [
    {
      $match: {
        name: commandName,
        workspaceId: { $in: workspaceIds },
      },
    },
    { $sort: { workspaceId: 1, attempt: -1 } as Sort },
    {
      $group: {
        _id: "$workspaceId",
        status: { $first: "$status" },
      },
    },
    { $match: { status: "completed" } },
    { $count: "count" },
  ];

  const results = await col.aggregate<{ count: number }>(pipeline).toArray();
  const completedCount = results[0]?.count ?? 0;

  return completedCount === workspaceIds.length;
}

export async function getLastAttemptedInstanceCommand(): Promise<{
  name: string;
  status: UpgradeMigrationStatus;
  executedByVersion: string;
  errorMessage: string | null;
  createdAt: Date;
} | null> {
  const col = await getUpgradeMigrationCollection();

  const pipeline = [
    {
      $match: { workspaceId: null, isInitial: false },
    },
    { $sort: { name: 1, attempt: -1 } as Sort },
    {
      $group: {
        _id: "$name",
        name: { $first: "$name" },
        status: { $first: "$status" },
        executedByVersion: { $first: "$executedByVersion" },
        errorMessage: { $first: "$errorMessage" },
        createdAt: { $first: "$createdAt" },
      },
    },
    { $sort: { createdAt: -1 } as Sort },
    { $limit: 1 },
  ];

  const results = await col
    .aggregate<{
      name: string;
      status: UpgradeMigrationStatus;
      executedByVersion: string;
      errorMessage: string | null;
      createdAt: Date;
    }>(pipeline)
    .toArray();

  if (results.length === 0) {
    return null;
  }

  return {
    name: results[0].name,
    status: results[0].status,
    executedByVersion: results[0].executedByVersion,
    errorMessage: results[0].errorMessage,
    createdAt: results[0].createdAt,
  };
}

export async function getLastAttemptedInstanceCommandOrThrow(): Promise<{
  name: string;
  status: UpgradeMigrationStatus;
}> {
  const result = await getLastAttemptedInstanceCommand();

  if (!result) {
    throw new Error(
      "No instance command found — the database may not have been initialized",
    );
  }

  return result;
}
