import "server-only";

// PORT-NOTE: NestJS @Injectable / Logger removed; replaced with console.*
// NestJS DI removed; all dependencies are passed as parameters.
// UpgradeAwareEntityMetadataAdapter (TypeORM) has no Mongo equivalent; its
// refresh() calls are replaced by no-ops / comments.
// WorkspaceIteratorService / ParsedUpgradeCommandOptions are inlined as
// compatible types below.
// assertUnreachable is inlined.

import {
  type WorkspaceLastAttemptedCommand,
  getLastAttemptedCommandNameOrThrow,
  getWorkspaceLastAttemptedCommandNameOrThrow,
  recordUpgradeMigration,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-migration.service";
import {
  type InstanceUpgradeStep,
  type UpgradeStep,
  type WorkspaceUpgradeStep,
  locateStepInSequenceOrThrow,
  getWorkspaceSegmentBounds,
  collectWorkspaceCommandsStartingFrom,
  getPendingWorkspaceCommands,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service";
import { formatUpgradeLog } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/format-upgrade-log.util";
import { formatUpgradeErrorForStorage } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/format-upgrade-error-for-storage.util";
import {
  invalidateInstanceAndAllWorkspacesStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status.service";

// -- Inlined helper types ----------------------------------------------------

function assertUnreachable(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export type ParsedUpgradeCommandOptions = {
  dryRun?: boolean;
  workspaceIds?: string[];
  startFromWorkspaceId?: string;
  workspaceCountLimit?: number;
};

export type WorkspaceIteratorContext = {
  workspaceId: string;
  index: number;
  total: number;
  dataSource: unknown;
};

export type WorkspaceIteratorReport = {
  success: string[];
  fail: string[];
};

export type UpgradeSequenceRunnerReport = {
  totalSuccesses: number;
  totalFailures: number;
};

// -- Workspace iterator (simplified) -----------------------------------------

async function iterateWorkspaces({
  workspaceIds,
  dryRun,
  callback,
}: {
  workspaceIds: string[];
  dryRun?: boolean;
  callback: (context: WorkspaceIteratorContext) => Promise<void>;
}): Promise<WorkspaceIteratorReport> {
  const success: string[] = [];
  const fail: string[] = [];
  const total = workspaceIds.length;

  for (let i = 0; i < workspaceIds.length; i++) {
    const workspaceId = workspaceIds[i];

    try {
      await callback({
        workspaceId,
        index: i,
        total,
        dataSource: null, // PORT-NOTE: No TypeORM DataSource in Mongo context
      });

      success.push(workspaceId);
    } catch (error) {
      console.error(
        `[UpgradeSequenceRunner] Failed for workspace ${workspaceId}:`,
        error,
      );
      fail.push(workspaceId);
    }
  }

  return { success, fail };
}

// -- Active/suspended workspace ID loader ------------------------------------
// PORT-NOTE: In the original service this came from WorkspaceVersionService.
// Callers must pass this function, or provide the IDs directly.

type GetActiveOrSuspendedWorkspaceIds = () => Promise<string[]>;

// -- Instance command runner -------------------------------------------------

async function runFastInstanceCommand(step: InstanceUpgradeStep & { kind: "fast-instance" }): Promise<void> {
  await step.command.run();
}

async function runSlowInstanceCommand(
  step: InstanceUpgradeStep & { kind: "slow-instance" },
  skipDataMigration: boolean,
): Promise<void> {
  await step.command.run({ skipDataMigration });
}

// -- Main sequence runner ----------------------------------------------------

export async function runUpgradeSequence({
  sequence,
  options,
  getActiveOrSuspendedWorkspaceIds,
  executedByVersion,
}: {
  sequence: UpgradeStep[];
  options: ParsedUpgradeCommandOptions;
  getActiveOrSuspendedWorkspaceIds: GetActiveOrSuspendedWorkspaceIds;
  executedByVersion?: string;
}): Promise<UpgradeSequenceRunnerReport> {
  if (sequence.length === 0) {
    return { totalSuccesses: 0, totalFailures: 0 };
  }

  // PORT-NOTE: upgradeAwareEntityMetadataAdapter.refresh() is a no-op here;
  // MongoDB does not use TypeORM entity metadata.

  return runInner({ sequence, options, getActiveOrSuspendedWorkspaceIds, executedByVersion: executedByVersion ?? "unknown" });
}

async function runInner({
  sequence,
  options,
  getActiveOrSuspendedWorkspaceIds,
  executedByVersion,
}: {
  sequence: UpgradeStep[];
  options: ParsedUpgradeCommandOptions;
  getActiveOrSuspendedWorkspaceIds: GetActiveOrSuspendedWorkspaceIds;
  executedByVersion: string;
}): Promise<UpgradeSequenceRunnerReport> {
  const allActiveOrSuspendedWorkspaceIds = await getActiveOrSuspendedWorkspaceIds();

  const startCursor = await resolveStartCursor({
    sequence,
    allActiveOrSuspendedWorkspaceIds,
  });

  let totalSuccesses = 0;
  let totalFailures = 0;
  let cursor = startCursor;
  let workspaceCursors = await getWorkspaceLastAttemptedCommandNameOrThrow(
    allActiveOrSuspendedWorkspaceIds,
  );

  while (cursor < sequence.length) {
    const step = sequence[cursor];

    if (step.kind === "fast-instance" || step.kind === "slow-instance") {
      if (
        (options.workspaceIds != null && options.workspaceIds.length > 0) ||
        options.startFromWorkspaceId != null ||
        options.workspaceCountLimit != null
      ) {
        console.log(
          formatUpgradeLog({
            humanMessage:
              `Stopping before instance step "${step.name}": ` +
              "upgrade was run with a workspace filter (-w, --start-from-workspace-id, or --workspace-count-limit). " +
              "Instance commands require all workspaces to be aligned.",
            event: "sequence.stopped",
            logFields: {
              before: step.name,
              reason: "workspace-filter-active",
            },
          }),
        );

        break;
      }

      const previousStep = cursor > 0 ? sequence[cursor - 1] : undefined;

      if (previousStep?.kind === "workspace") {
        enforceWorkspacesCompletedPreviousWorkspaceSegment({
          sequence,
          previousWorkspaceStep: previousStep,
          workspaceCursors,
        });
      }

      await runInstanceStep({ instanceStep: step, skipDataMigration: allActiveOrSuspendedWorkspaceIds.length === 0 });

      // PORT-NOTE: upgradeAwareEntityMetadataAdapter.refresh() no-op.

      cursor++;
      continue;
    }

    const workspaceCommandsSegment = collectWorkspaceCommandsStartingFrom({
      sequence,
      fromWorkspaceCommand: step,
    });

    const report = await resumeWorkspaceCommandsFromCursors({
      workspaceCommandsSegment,
      workspaceCursors,
      allActiveOrSuspendedWorkspaceIds,
      options,
      executedByVersion,
    });

    totalSuccesses += report.success.length;
    totalFailures += report.fail.length;

    if (report.fail.length > 0) {
      console.error(
        formatUpgradeLog({
          humanMessage:
            `Workspace steps ended with ${report.fail.length} failure(s). ` +
            "Aborting — cannot proceed to next instance step.",
          event: "sequence.aborted",
          logFields: {
            failures: report.fail.length,
            reason: "workspace-failures",
          },
        }),
      );

      return { totalSuccesses, totalFailures };
    }

    cursor += workspaceCommandsSegment.length;

    workspaceCursors = await getWorkspaceLastAttemptedCommandNameOrThrow(
      allActiveOrSuspendedWorkspaceIds,
    );
  }

  return { totalSuccesses, totalFailures };
}

async function resolveStartCursor({
  sequence,
  allActiveOrSuspendedWorkspaceIds,
}: {
  sequence: UpgradeStep[];
  allActiveOrSuspendedWorkspaceIds: string[];
}): Promise<number> {
  const lastAttempted = await getLastAttemptedCommandNameOrThrow(
    allActiveOrSuspendedWorkspaceIds,
  );

  const lastAttemptedCursor = locateStepInSequenceOrThrow({
    sequence,
    stepName: lastAttempted.name,
  });

  const lastAttemptedStep = sequence[lastAttemptedCursor];

  switch (lastAttemptedStep.kind) {
    case "fast-instance":
    case "slow-instance": {
      return lastAttempted.status === "completed"
        ? lastAttemptedCursor + 1
        : lastAttemptedCursor;
    }
    case "workspace": {
      const workspaceSliceBounds = getWorkspaceSegmentBounds({
        sequence,
        workspaceCommand: lastAttemptedStep,
      });

      await validateWorkspaceCursorsAreInWorkspaceSegment({
        sequence,
        allActiveOrSuspendedWorkspaceIds,
        workspaceSliceBounds,
      });

      return workspaceSliceBounds.startCursor;
    }
    default:
      return assertUnreachable(lastAttemptedStep);
  }
}

async function validateWorkspaceCursorsAreInWorkspaceSegment({
  allActiveOrSuspendedWorkspaceIds,
  sequence,
  workspaceSliceBounds: { startCursor, endCursor },
}: {
  sequence: UpgradeStep[];
  allActiveOrSuspendedWorkspaceIds: string[];
  workspaceSliceBounds: { startCursor: number; endCursor: number };
}): Promise<void> {
  const workspaceCursors = await getWorkspaceLastAttemptedCommandNameOrThrow(
    allActiveOrSuspendedWorkspaceIds,
  );
  const precedingStep =
    startCursor > 0 ? sequence[startCursor - 1] : undefined;

  const invalidWorkspaces: Array<{
    workspaceId: string;
    cursorName: string;
    cursorStatus: string;
  }> = [];

  for (const [workspaceId, workspaceCursor] of workspaceCursors) {
    const cursorPosition = locateStepInSequenceOrThrow({
      sequence,
      stepName: workspaceCursor.name,
    });

    const isWithinSegment =
      cursorPosition >= startCursor && cursorPosition <= endCursor;

    const isAtPrecedingInstanceCommandCompleted =
      precedingStep != null &&
      precedingStep.kind !== "workspace" &&
      cursorPosition === startCursor - 1 &&
      workspaceCursor.status === "completed";

    if (!isWithinSegment && !isAtPrecedingInstanceCommandCompleted) {
      invalidWorkspaces.push({
        workspaceId,
        cursorName: workspaceCursor.name,
        cursorStatus: workspaceCursor.status,
      });
    }
  }

  if (invalidWorkspaces.length > 0) {
    const details = invalidWorkspaces
      .map(
        ({ workspaceId, cursorName, cursorStatus }) =>
          `${workspaceId} at "${cursorName}" (${cursorStatus})`,
      )
      .join(", ");

    throw new Error(
      `${invalidWorkspaces.length} workspace(s) have invalid cursors for ` +
        `workspace segment [${startCursor}..${endCursor}]: ${details}`,
    );
  }
}

async function runInstanceStep({
  instanceStep,
  skipDataMigration,
}: {
  instanceStep: InstanceUpgradeStep;
  skipDataMigration: boolean;
}): Promise<void> {
  switch (instanceStep.kind) {
    case "fast-instance": {
      await runFastInstanceCommand(instanceStep);
      return;
    }
    case "slow-instance": {
      await runSlowInstanceCommand(instanceStep, skipDataMigration);
      return;
    }
    default:
      assertUnreachable(instanceStep);
  }
}

async function resumeWorkspaceCommandsFromCursors({
  workspaceCommandsSegment,
  workspaceCursors,
  allActiveOrSuspendedWorkspaceIds,
  options,
  executedByVersion,
}: {
  workspaceCommandsSegment: WorkspaceUpgradeStep[];
  workspaceCursors: Map<string, WorkspaceLastAttemptedCommand>;
  allActiveOrSuspendedWorkspaceIds: string[];
  options: ParsedUpgradeCommandOptions;
  executedByVersion: string;
}): Promise<WorkspaceIteratorReport> {
  const workspaceIds = deriveWorkspaceIdsToProcess({
    allActiveOrSuspendedWorkspaceIds,
    options,
  });

  return iterateWorkspaces({
    workspaceIds,
    dryRun: options.dryRun,
    callback: async (context) => {
      const workspaceCursor = workspaceCursors.get(context.workspaceId);

      if (!workspaceCursor) {
        throw new Error(
          `No upgrade migration found for workspace ${context.workspaceId}. This should never occur.`,
        );
      }

      const pendingCommands = getPendingWorkspaceCommands({
        workspaceCommands: workspaceCommandsSegment,
        workspaceCursor,
      });

      const dryRunPrefix = options.dryRun ? "(dry run) " : "";

      console.log(
        formatUpgradeLog({
          humanMessage: `${dryRunPrefix}Upgrading workspace ${context.workspaceId} ${context.index + 1}/${context.total}`,
          event: "workspace.start",
          logFields: {
            workspaceId: context.workspaceId,
            index: context.index + 1,
            total: context.total,
            dryRun: options.dryRun ?? false,
          },
        }),
      );

      try {
        for (const command of pendingCommands) {
          try {
            await command.command.runOnWorkspace({
              options: options as Record<string, unknown>,
              workspaceId: context.workspaceId,
              dataSource: context.dataSource,
              index: context.index,
              total: context.total,
            });

            if (!options.dryRun) {
              await recordUpgradeMigration({
                name: command.name,
                workspaceIds: [context.workspaceId],
                isInstance: false,
                status: "completed",
                executedByVersion,
              });
            }
          } catch (error) {
            if (!options.dryRun) {
              await recordUpgradeMigration({
                name: command.name,
                workspaceIds: [context.workspaceId],
                isInstance: false,
                status: "failed",
                executedByVersion,
                error,
              });
            }

            throw error;
          }
        }

        console.log(
          formatUpgradeLog({
            humanMessage: `Upgrade for workspace ${context.workspaceId} completed.`,
            event: "workspace.success",
            logFields: {
              workspaceId: context.workspaceId,
              executedByVersion,
              dryRun: options.dryRun ?? false,
            },
          }),
        );
      } finally {
        if (!options.dryRun) {
          try {
            await invalidateInstanceAndAllWorkspacesStatus();
          } catch (cacheError) {
            const msg = cacheError instanceof Error ? cacheError.message : String(cacheError);

            console.warn(
              formatUpgradeLog({
                humanMessage: `Failed to invalidate upgrade-status cache (triggered by workspace ${context.workspaceId}): ${msg}`,
                event: "cache.invalidate.failed",
                logFields: {
                  scope: "instance-and-all-workspaces",
                  triggeredByWorkspaceId: context.workspaceId,
                },
              }),
            );
          }
        }
      }
    },
  });
}

function deriveWorkspaceIdsToProcess({
  allActiveOrSuspendedWorkspaceIds,
  options,
}: {
  allActiveOrSuspendedWorkspaceIds: string[];
  options: ParsedUpgradeCommandOptions;
}): string[] {
  if (options.workspaceIds != null && options.workspaceIds.length > 0) {
    return options.workspaceIds;
  }

  let workspaceIds = allActiveOrSuspendedWorkspaceIds;

  if (options.startFromWorkspaceId != null) {
    workspaceIds = workspaceIds.filter(
      (id) => id >= options.startFromWorkspaceId!,
    );
  }

  if (options.workspaceCountLimit != null) {
    workspaceIds = workspaceIds.slice(0, options.workspaceCountLimit);
  }

  return workspaceIds;
}

function enforceWorkspacesCompletedPreviousWorkspaceSegment({
  sequence,
  previousWorkspaceStep,
  workspaceCursors,
}: {
  sequence: UpgradeStep[];
  previousWorkspaceStep: WorkspaceUpgradeStep;
  workspaceCursors: Map<string, WorkspaceLastAttemptedCommand>;
}): void {
  const barrierCursor = locateStepInSequenceOrThrow({
    sequence,
    stepName: previousWorkspaceStep.name,
  });

  for (const [workspaceId, workspaceCursor] of workspaceCursors) {
    const cursorPosition = locateStepInSequenceOrThrow({
      sequence,
      stepName: workspaceCursor.name,
    });

    const isAtBarrierAndCompleted =
      cursorPosition === barrierCursor &&
      workspaceCursor.status === "completed";

    if (!isAtBarrierAndCompleted) {
      throw new Error(
        `Cannot run instance step: workspace ${workspaceId} ` +
          `has not completed "${previousWorkspaceStep.name}" ` +
          `(cursor: "${workspaceCursor.name}", status: "${workspaceCursor.status}")`,
      );
    }
  }
}
