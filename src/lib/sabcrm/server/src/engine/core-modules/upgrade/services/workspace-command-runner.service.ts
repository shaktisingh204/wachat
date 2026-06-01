import "server-only";

// PORT-NOTE: NestJS @Injectable / Logger removed.
// TwentyConfigService replaced with process.env.APP_VERSION.
// WorkspaceIteratorContext / ParsedUpgradeCommandOptions imported from the
// ported sequence runner (which inlines them).
// Dependencies injected via explicit function parameters instead of DI.

import {
  recordUpgradeMigration,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-migration.service";
import {
  invalidateInstanceAndAllWorkspacesStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status.service";
import {
  type ParsedUpgradeCommandOptions,
  type WorkspaceIteratorContext,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-runner.service";
import { formatUpgradeLog } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/utils/format-upgrade-log.util";

type WorkspaceCommandEntry = {
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

export type RunWorkspaceCommandsArgs = {
  iteratorContext: WorkspaceIteratorContext;
  options: ParsedUpgradeCommandOptions;
  workspaceCommands: WorkspaceCommandEntry[];
};

export async function runWorkspaceCommands({
  iteratorContext,
  options,
  workspaceCommands,
}: RunWorkspaceCommandsArgs): Promise<void> {
  const { workspaceId, index, total } = iteratorContext;

  const dryRunPrefix = options.dryRun ? "(dry run) " : "";

  console.log(
    formatUpgradeLog({
      humanMessage: `${dryRunPrefix}Upgrading workspace ${workspaceId} ${index + 1}/${total}`,
      event: "workspace.start",
      logFields: {
        workspaceId,
        index: index + 1,
        total,
        dryRun: options.dryRun ?? false,
      },
    }),
  );

  const executedByVersion = process.env.APP_VERSION ?? "unknown";

  try {
    for (const workspaceCommandEntry of workspaceCommands) {
      await runSingleWorkspaceCommandOrThrow({
        workspaceCommandEntry,
        workspaceId,
        executedByVersion,
        options,
        iteratorContext,
      });
    }

    console.log(
      formatUpgradeLog({
        humanMessage: `Upgrade for workspace ${workspaceId} completed.`,
        event: "workspace.success",
        logFields: {
          workspaceId,
          executedByVersion,
          dryRun: options.dryRun ?? false,
        },
      }),
    );
  } finally {
    if (!options.dryRun) {
      await safeInvalidateWorkspace(workspaceId);
    }
  }
}

async function safeInvalidateWorkspace(workspaceId: string): Promise<void> {
  try {
    await invalidateInstanceAndAllWorkspacesStatus();
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.warn(
      formatUpgradeLog({
        humanMessage: `Failed to invalidate upgrade-status cache (triggered by workspace ${workspaceId}): ${errorMessage}`,
        event: "cache.invalidate.failed",
        logFields: {
          scope: "instance-and-all-workspaces",
          triggeredByWorkspaceId: workspaceId,
        },
      }),
    );
  }
}

async function runSingleWorkspaceCommandOrThrow({
  workspaceCommandEntry,
  workspaceId,
  executedByVersion,
  options,
  iteratorContext,
}: {
  workspaceCommandEntry: WorkspaceCommandEntry;
  workspaceId: string;
  executedByVersion: string;
  options: ParsedUpgradeCommandOptions;
  iteratorContext: WorkspaceIteratorContext;
}): Promise<void> {
  const { name, command: workspaceCommand } = workspaceCommandEntry;

  try {
    await workspaceCommand.runOnWorkspace({
      options: options as Record<string, unknown>,
      workspaceId,
      dataSource: iteratorContext.dataSource,
      index: iteratorContext.index,
      total: iteratorContext.total,
    });

    if (!options.dryRun) {
      await recordUpgradeMigration({
        name,
        workspaceIds: [workspaceId],
        isInstance: false,
        status: "completed",
        executedByVersion,
      });
    }
  } catch (error) {
    if (!options.dryRun) {
      await recordUpgradeMigration({
        name,
        workspaceIds: [workspaceId],
        isInstance: false,
        status: "failed",
        executedByVersion,
        error,
      });
    }

    throw error;
  }
}
