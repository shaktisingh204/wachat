import "server-only";

// PORT-NOTE: NestJS @Injectable DI removed. Ported as plain exported functions.
// UpgradeCommandRegistryService, RegisteredFastInstanceCommand,
// RegisteredSlowInstanceCommand, RegisteredWorkspaceCommand are imported from
// the ported registry service when available. Until then, shapes are inlined.
// TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS constant is inlined here.

import {
  type UpgradeMigrationStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/upgrade-migration.entity";

// PORT-NOTE: These versions should be kept in sync with
// twenty-server/src/engine/core-modules/upgrade/constants/twenty-cross-upgrade-supported-version.constant.ts
export const TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS: readonly string[] = [
  "0-41-0",
  "0-42-0",
  "0-43-0",
  "0-44-0",
] as const;

// Command shapes (mirrors the NestJS registry types)
export type RegisteredFastInstanceCommand = {
  name: string;
  command: {
    run(): Promise<void>;
  };
};

export type RegisteredSlowInstanceCommand = {
  name: string;
  command: {
    run(options: { skipDataMigration: boolean }): Promise<void>;
  };
};

export type RegisteredWorkspaceCommand = {
  name: string;
  command: {
    runOnWorkspace(options: {
      options: Record<string, unknown>;
      workspaceId: string;
      dataSource: unknown;
      index: number;
      total: number;
    }): Promise<void>;
  };
};

export type VersionBundle = {
  fastInstanceCommands: RegisteredFastInstanceCommand[];
  slowInstanceCommands: RegisteredSlowInstanceCommand[];
  workspaceCommands: RegisteredWorkspaceCommand[];
};

export type FastInstanceUpgradeStep = {
  kind: "fast-instance";
} & RegisteredFastInstanceCommand;

export type SlowInstanceUpgradeStep = {
  kind: "slow-instance";
} & RegisteredSlowInstanceCommand;

export type InstanceUpgradeStep =
  | FastInstanceUpgradeStep
  | SlowInstanceUpgradeStep;

export type WorkspaceUpgradeStep = {
  kind: "workspace";
} & RegisteredWorkspaceCommand;

export type UpgradeStep = InstanceUpgradeStep | WorkspaceUpgradeStep;

// ---------------------------------------------------------------------------
// Sequence builder — callers pass a getBundleForVersion function that maps a
// version string to a VersionBundle.
// ---------------------------------------------------------------------------

export function getUpgradeSequence(
  getBundleForVersion: (version: string) => VersionBundle,
): UpgradeStep[] {
  const sequence: UpgradeStep[] = [];

  for (const version of TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS) {
    const bundle = getBundleForVersion(version);

    for (const command of bundle.fastInstanceCommands) {
      sequence.push({ kind: "fast-instance", ...command });
    }

    for (const command of bundle.slowInstanceCommands) {
      sequence.push({ kind: "slow-instance", ...command });
    }

    for (const command of bundle.workspaceCommands) {
      sequence.push({ kind: "workspace", ...command });
    }
  }

  return sequence;
}

export function locateStepInSequenceOrThrow({
  sequence,
  stepName,
}: {
  sequence: UpgradeStep[];
  stepName: string;
}): number {
  const cursor = sequence.findIndex((step) => step.name === stepName);

  if (cursor === -1) {
    const supportedVersions = TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS.join(", ");

    throw new Error(
      `Step "${stepName}" not found in upgrade sequence. ` +
        `The sequence only covers versions [${supportedVersions}]. ` +
        `Please upgrade to ${TWENTY_CROSS_UPGRADE_SUPPORTED_VERSIONS[0]} first.`,
    );
  }

  return cursor;
}

export function getWorkspaceSegmentBounds({
  sequence,
  workspaceCommand,
}: {
  sequence: UpgradeStep[];
  workspaceCommand: WorkspaceUpgradeStep;
}): { startCursor: number; endCursor: number } {
  const workspaceCommandCursor = locateStepInSequenceOrThrow({
    sequence,
    stepName: workspaceCommand.name,
  });

  let startCursor = workspaceCommandCursor;

  while (startCursor > 0 && sequence[startCursor - 1].kind === "workspace") {
    startCursor--;
  }

  let endCursor = workspaceCommandCursor;

  while (
    endCursor < sequence.length - 1 &&
    sequence[endCursor + 1].kind === "workspace"
  ) {
    endCursor++;
  }

  return { startCursor, endCursor };
}

export function collectWorkspaceCommandsStartingFrom({
  sequence,
  fromWorkspaceCommand,
}: {
  sequence: UpgradeStep[];
  fromWorkspaceCommand: WorkspaceUpgradeStep;
}): WorkspaceUpgradeStep[] {
  const fromCursor = locateStepInSequenceOrThrow({
    sequence,
    stepName: fromWorkspaceCommand.name,
  });

  const slice: WorkspaceUpgradeStep[] = [];

  for (let cursor = fromCursor; cursor < sequence.length; cursor++) {
    const step = sequence[cursor];

    if (step.kind !== "workspace") {
      break;
    }

    slice.push(step);
  }

  return slice;
}

export function getPendingWorkspaceCommands({
  workspaceCommands,
  workspaceCursor,
}: {
  workspaceCommands: WorkspaceUpgradeStep[];
  workspaceCursor: { name: string; status: "completed" | "failed" };
}): WorkspaceUpgradeStep[] {
  const cursorIndex = workspaceCommands.findIndex(
    (command) => command.name === workspaceCursor.name,
  );

  if (cursorIndex === -1) {
    return workspaceCommands;
  }

  return workspaceCursor.status === "completed"
    ? workspaceCommands.slice(cursorIndex + 1)
    : workspaceCommands.slice(cursorIndex);
}

function findLastWorkspaceCommandInSegmentStartingAt(
  sequence: UpgradeStep[],
  firstWorkspaceCommand: WorkspaceUpgradeStep,
): RegisteredWorkspaceCommand {
  const segment = collectWorkspaceCommandsStartingFrom({
    sequence,
    fromWorkspaceCommand: firstWorkspaceCommand,
  });

  return segment[segment.length - 1];
}

export function getInitialCursorForNewWorkspace(
  lastAttemptedInstanceCommand: {
    name: string;
    status: UpgradeMigrationStatus;
  },
  sequence: UpgradeStep[],
): {
  name: string;
  status: UpgradeMigrationStatus;
} {
  const { name, status } = lastAttemptedInstanceCommand;

  const instanceCursor = locateStepInSequenceOrThrow({
    sequence,
    stepName: name,
  });

  if (status === "completed") {
    const nextStep = sequence[instanceCursor + 1];

    if (nextStep != null && nextStep.kind === "workspace") {
      const lastWc = findLastWorkspaceCommandInSegmentStartingAt(
        sequence,
        nextStep,
      );

      return { name: lastWc.name, status: "completed" };
    }
  }

  return { name, status };
}
