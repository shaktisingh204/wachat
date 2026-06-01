import "server-only";

// PORT-NOTE: NestJS @Injectable / @InjectRepository DI removed.
// TypeORM WorkspaceEntity repository replaced by a MongoDB workspace helper.
// CoreEntityCacheService replaced by a simple in-process lookup.
// UpgradeHealthEnum / WorkspaceActivationStatus are inlined until
// twenty-shared is available in SabNode.

import { getUpgradeMigrationCollection } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/upgrade-migration.entity";
import { type UpgradeMigrationStatus } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/upgrade-migration.entity";
import {
  getInferredVersion,
  getLastAttemptedInstanceCommand,
  getWorkspaceLastAttemptedCommandName,
  getWorkspaceLastAttemptedCommandNameOrThrow,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-migration.service";
import {
  type UpgradeStep,
  getUpgradeSequence,
  type VersionBundle,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service";
import {
  getComputedAt,
  getBehindWorkspaceIds,
  getFailedWorkspaceIds,
  getUpToDateWorkspaceCount,
  writeUpgradeStatusCache,
  invalidateUpgradeStatusCache,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status-cache.service";
import { connectToDatabase } from "@/lib/mongodb";

// -- Inlined enums (mirror twenty-shared) ------------------------------------

export enum UpgradeHealthEnum {
  UP_TO_DATE = "UP_TO_DATE",
  BEHIND = "BEHIND",
  FAILED = "FAILED",
}

export enum WorkspaceActivationStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  INACTIVE = "INACTIVE",
  PENDING_CREATION = "PENDING_CREATION",
}

// -- Types -------------------------------------------------------------------

export type LatestUpgradeCommand = {
  name: string;
  status: UpgradeMigrationStatus;
  executedByVersion: string;
  errorMessage: string | null;
  createdAt: Date;
};

export type InstanceUpgradeStatus = {
  inferredVersion: string | null;
  health: UpgradeHealthEnum;
  latestCommand: LatestUpgradeCommand | null;
};

export type WorkspaceUpgradeStatus = {
  workspaceId: string;
  displayName: string | null;
  inferredVersion: string | null;
  health: UpgradeHealthEnum;
  latestCommand: LatestUpgradeCommand | null;
};

export type WorkspaceUpgradeRef = {
  id: string;
  name: string | null;
};

export type InstanceAndAllWorkspacesUpgradeStatus = {
  instanceUpgradeStatus: InstanceUpgradeStatus;
  workspacesBehind: WorkspaceUpgradeRef[];
  workspacesFailed: WorkspaceUpgradeRef[];
  upToDateWorkspaceCount: number;
  computedAt: Date;
};

// -- Helpers -----------------------------------------------------------------

const deriveHealth = (
  migration: { name: string; status: UpgradeMigrationStatus },
  lastExpectedCommandName: string | null,
): UpgradeHealthEnum => {
  if (migration.status === "failed") {
    return UpgradeHealthEnum.FAILED;
  }

  if (
    lastExpectedCommandName !== null &&
    migration.name !== lastExpectedCommandName
  ) {
    return UpgradeHealthEnum.BEHIND;
  }

  return UpgradeHealthEnum.UP_TO_DATE;
};

async function buildCursorStatus(
  migration: LatestUpgradeCommand | null,
  lastExpectedCommandName: string | null,
): Promise<InstanceUpgradeStatus> {
  if (!migration) {
    return {
      inferredVersion: null,
      health: UpgradeHealthEnum.BEHIND,
      latestCommand: null,
    };
  }

  const health = deriveHealth(migration, lastExpectedCommandName);

  return {
    inferredVersion: await getInferredVersion(migration.name),
    health,
    latestCommand: {
      name: migration.name,
      status: migration.status,
      executedByVersion: migration.executedByVersion,
      errorMessage: migration.errorMessage,
      createdAt: migration.createdAt,
    },
  };
}

// -- Workspace data accessor -------------------------------------------------

export type WorkspaceRecord = { id: string; displayName?: string | null };

async function loadActiveOrSuspendedWorkspaces(
  workspaceIds?: string[],
): Promise<WorkspaceRecord[]> {
  // PORT-NOTE: Workspaces are stored in MongoDB collection sabcrm_workspace.
  // This follows the same collection naming convention as other entities.
  const { db } = await connectToDatabase();
  const col = db.collection<WorkspaceRecord>("sabcrm_workspace");

  const filter: Record<string, unknown> = {
    activationStatus: {
      $in: [WorkspaceActivationStatus.ACTIVE, WorkspaceActivationStatus.SUSPENDED],
    },
  };

  if (workspaceIds && workspaceIds.length > 0) {
    filter["id"] = { $in: workspaceIds };
  }

  return col.find(filter, { sort: { id: 1 }, projection: { id: 1, displayName: 1 } }).toArray();
}

async function loadWorkspaceNamesById(
  workspaceIds: string[],
): Promise<Map<string, string | null>> {
  const namesById = new Map<string, string | null>();

  if (workspaceIds.length === 0) {
    return namesById;
  }

  const { db } = await connectToDatabase();
  const col = db.collection<WorkspaceRecord>("sabcrm_workspace");

  const workspaces = await col
    .find({ id: { $in: workspaceIds } }, { projection: { id: 1, displayName: 1 } })
    .toArray();

  for (const workspace of workspaces) {
    if (workspace != null) {
      namesById.set(workspace.id, workspace.displayName ?? null);
    }
  }

  return namesById;
}

function toWorkspaceRefs(
  workspaceIds: string[],
  workspaceNamesById: Map<string, string | null>,
): WorkspaceUpgradeRef[] {
  return workspaceIds.map((workspaceId) => ({
    id: workspaceId,
    name: workspaceNamesById.get(workspaceId) ?? null,
  }));
}

// -- Public API --------------------------------------------------------------

export async function getInstanceStatus(
  sequence: UpgradeStep[],
): Promise<InstanceUpgradeStatus> {
  const migration = await getLastAttemptedInstanceCommand();

  const lastInstanceStep = [...sequence]
    .reverse()
    .find(
      (step) =>
        step.kind === "fast-instance" || step.kind === "slow-instance",
    );

  return buildCursorStatus(migration, lastInstanceStep?.name ?? null);
}

export async function getWorkspaceStatuses(
  sequence: UpgradeStep[],
  filterWorkspaceIds?: string[],
): Promise<WorkspaceUpgradeStatus[]> {
  const workspaces = await loadActiveOrSuspendedWorkspaces(filterWorkspaceIds);

  if (filterWorkspaceIds) {
    const foundIds = new Set(workspaces.map((ws) => ws.id));

    for (const requestedId of filterWorkspaceIds) {
      if (!foundIds.has(requestedId)) {
        console.warn(
          `[UpgradeStatusService] Workspace ${requestedId} not found or not active/suspended`,
        );
      }
    }
  }

  const loadedWorkspaceIds = workspaces.map((ws) => ws.id);
  const cursors = await getWorkspaceLastAttemptedCommandName(loadedWorkspaceIds);

  const lastStepName =
    sequence.length > 0 ? sequence[sequence.length - 1].name : null;

  return Promise.all(
    workspaces.map(async (workspace) => ({
      ...(await buildCursorStatus(
        cursors.get(workspace.id) ?? null,
        lastStepName,
      )),
      workspaceId: workspace.id,
      displayName: workspace.displayName ?? null,
    })),
  );
}

export async function getInstanceAndAllWorkspacesStatus(
  sequence: UpgradeStep[],
): Promise<InstanceAndAllWorkspacesUpgradeStatus> {
  const computedAt = await getComputedAt();

  if (computedAt == null) {
    return refreshInstanceAndAllWorkspacesStatus(sequence);
  }

  const [
    instanceUpgradeStatus,
    behindWorkspaceIds,
    failedWorkspaceIds,
    upToDateWorkspaceCount,
  ] = await Promise.all([
    getInstanceStatus(sequence),
    getBehindWorkspaceIds(),
    getFailedWorkspaceIds(),
    getUpToDateWorkspaceCount(),
  ]);

  const workspaceNamesById = await loadWorkspaceNamesById([
    ...behindWorkspaceIds,
    ...failedWorkspaceIds,
  ]);

  return {
    instanceUpgradeStatus,
    workspacesBehind: toWorkspaceRefs(behindWorkspaceIds, workspaceNamesById),
    workspacesFailed: toWorkspaceRefs(failedWorkspaceIds, workspaceNamesById),
    upToDateWorkspaceCount,
    computedAt,
  };
}

export async function refreshInstanceAndAllWorkspacesStatus(
  sequence: UpgradeStep[],
): Promise<InstanceAndAllWorkspacesUpgradeStatus> {
  console.log("[UpgradeStatusService] Recomputing upgrade status for all workspaces");

  const [instanceUpgradeStatus, workspaceStatuses] = await Promise.all([
    getInstanceStatus(sequence),
    getWorkspaceStatuses(sequence),
  ]);

  const workspacesBehind: WorkspaceUpgradeRef[] = [];
  const workspacesFailed: WorkspaceUpgradeRef[] = [];
  let upToDateWorkspaceCount = 0;

  for (const workspaceStatus of workspaceStatuses) {
    const workspaceRef: WorkspaceUpgradeRef = {
      id: workspaceStatus.workspaceId,
      name: workspaceStatus.displayName,
    };

    if (workspaceStatus.health === UpgradeHealthEnum.BEHIND) {
      workspacesBehind.push(workspaceRef);
    } else if (workspaceStatus.health === UpgradeHealthEnum.FAILED) {
      workspacesFailed.push(workspaceRef);
    } else if (workspaceStatus.health === UpgradeHealthEnum.UP_TO_DATE) {
      upToDateWorkspaceCount++;
    }
  }

  const now = new Date();

  await writeUpgradeStatusCache({
    behindWorkspaceIds: workspacesBehind.map((ws) => ws.id),
    failedWorkspaceIds: workspacesFailed.map((ws) => ws.id),
    upToDateWorkspaceCount,
    computedAt: now,
  });

  return {
    instanceUpgradeStatus,
    workspacesBehind,
    workspacesFailed,
    upToDateWorkspaceCount,
    computedAt: now,
  };
}

export async function invalidateInstanceAndAllWorkspacesStatus(): Promise<void> {
  await invalidateUpgradeStatusCache();
}
