import "server-only";

// PORT-NOTE: NestJS CommandRunner -> plain exported async function.
// DataSource (TypeORM) is replaced by a note; Mongo has no equivalent "pending migrations" list.
// UpgradeCommandRegistryService, UpgradeSequenceReaderService, InstanceCommandRunnerService,
// UpgradeMigrationService and WorkspaceVersionService are all ported separately under server/.
// This module exposes runInstanceCommands() as a server-only utility.

import { TWENTY_PREVIOUS_VERSIONS } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/constants/twenty-previous-versions.constant";
import { getActiveOrSuspendedWorkspaceIds } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-version/services/workspace-version.service";
import { getUpgradeSequence } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service";
import { runFastInstanceCommand, runSlowInstanceCommand } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/instance-command-runner.service";
import { getLastWorkspaceCommandForVersion } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-command-registry.service";
import { areAllWorkspacesAtCommand } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-migration.service";

export type RunInstanceCommandsOptions = {
  force?: boolean;
  includeSlow?: boolean;
};

/**
 * Run all registered instance commands (fast + optionally slow).
 * Equivalent to the Twenty RunInstanceCommandsCommand NestJS CLI command.
 */
export async function runInstanceCommands(
  options: RunInstanceCommandsOptions = {},
): Promise<void> {
  await checkWorkspaceVersionSafety(options);
  // PORT-NOTE: TypeORM "runMigrations" has no Mongo analogue — skipped.
  // If SabNode uses a migration runner, invoke it here.

  const activeOrSuspendedWorkspaceIds = await getActiveOrSuspendedWorkspaceIds();
  const sequence = getUpgradeSequence();

  for (const step of sequence) {
    if (step.kind === "fast-instance") {
      const result = await runFastInstanceCommand({
        command: step.command,
        name: step.name,
      });

      if (result.status === "failed") {
        throw result.error;
      }
    }

    if (step.kind === "slow-instance" && options.includeSlow) {
      const result = await runSlowInstanceCommand({
        command: step.command,
        name: step.name,
        skipDataMigration: activeOrSuspendedWorkspaceIds.length === 0,
      });

      if (result.status === "failed") {
        throw result.error;
      }
    }
  }
}

async function checkWorkspaceVersionSafety(
  options: RunInstanceCommandsOptions,
): Promise<void> {
  if (options.force) {
    return;
  }

  const activeOrSuspendedWorkspaceIds = await getActiveOrSuspendedWorkspaceIds();

  if (activeOrSuspendedWorkspaceIds.length === 0) {
    return;
  }

  const previousVersion =
    TWENTY_PREVIOUS_VERSIONS[TWENTY_PREVIOUS_VERSIONS.length - 1];

  const lastWorkspaceCommand = getLastWorkspaceCommandForVersion(previousVersion);

  if (!lastWorkspaceCommand) {
    return;
  }

  const allAtPreviousVersion = await areAllWorkspacesAtCommand({
    commandName: lastWorkspaceCommand.name,
    workspaceIds: activeOrSuspendedWorkspaceIds,
  });

  if (!allAtPreviousVersion) {
    throw new Error(
      "Unable to run instance commands. Some workspace(s) have not completed " +
        `the last workspace command for ${previousVersion} ("${lastWorkspaceCommand.name}").\n` +
        "Please ensure all workspaces are upgraded to at least the previous version before running migrations.\n" +
        "Use --force to bypass this check (not recommended).",
    );
  }
}
