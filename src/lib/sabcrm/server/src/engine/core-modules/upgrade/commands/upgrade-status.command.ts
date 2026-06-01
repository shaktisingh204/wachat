// PORT-NOTE: server-logic — NestJS CLI Command (nest-commander) ported to a
// plain async function. The "command runner" pattern (nest-commander) has no
// Next.js equivalent; this module exports a runUpgradeStatusCommand() function
// that reproduces the same logic and can be invoked from a script or API route.
// chalk is kept for terminal output formatting.

import chalk from "chalk";
import { UpgradeHealthEnum } from "@/lib/sabcrm/shared/src/types/UpgradeHealthEnum";
import { formatUpgradeCommandName } from "@/lib/sabcrm/shared/src/utils/upgrade/formatUpgradeCommandName";

import {
  getInstanceStatus,
  getWorkspaceStatuses,
  invalidateInstanceAndAllWorkspacesStatus,
  type InstanceUpgradeStatus,
  type WorkspaceUpgradeStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status.service";
import { getUpgradeSequence } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service";

type UpgradeStatusOptions = {
  workspaceIds?: string[];
  failedOnly?: boolean;
  appVersion?: string;
};

type GroupedWorkspaceUpgradeStatuses = {
  upToDate: WorkspaceUpgradeStatus[];
  behind: WorkspaceUpgradeStatus[];
  failed: WorkspaceUpgradeStatus[];
};

const HEALTH_LABELS: Record<UpgradeHealthEnum, string> = {
  [UpgradeHealthEnum.UP_TO_DATE]: chalk.green("Up to date"),
  [UpgradeHealthEnum.BEHIND]: chalk.yellow("Behind"),
  [UpgradeHealthEnum.FAILED]: chalk.red("Failed"),
};

function formatHeader(appVersion: string): string[] {
  return ["", chalk.bold(`APP_VERSION: ${appVersion}`), ""];
}

function formatCursorStatus(
  status: InstanceUpgradeStatus,
  indent = "  ",
): string[] {
  if (!status.latestCommand) {
    return [`${indent}Status:           ${HEALTH_LABELS[status.health]}`];
  }

  const { latestCommand } = status;

  const lines: string[] = [
    `${indent}Inferred version: ${status.inferredVersion ?? chalk.dim("unknown")}`,
    `${indent}Latest command:   ${formatUpgradeCommandName(latestCommand.name)}`,
    `${indent}Status:           ${HEALTH_LABELS[status.health]}`,
    `${indent}Executed by:      ${latestCommand.executedByVersion}`,
    `${indent}At:               ${latestCommand.createdAt.toISOString()}`,
  ];

  if (latestCommand.status === "failed" && latestCommand.errorMessage) {
    lines.push(
      chalk.red(`${indent}Error:            ${latestCommand.errorMessage}`),
    );
  }

  return lines;
}

function formatInstanceStatus(status: InstanceUpgradeStatus): string[] {
  return [
    chalk.bold.underline("Instance"),
    ...formatCursorStatus(status),
    "",
  ];
}

function formatWorkspaceUpgradeStatus(
  status: WorkspaceUpgradeStatus,
  nested = false,
): string[] {
  const baseIndent = nested ? "    " : "  ";
  const detailIndent = nested ? "      " : "    ";
  const label = status.displayName
    ? `${status.displayName} (${status.workspaceId})`
    : status.workspaceId;

  return [
    chalk.bold(`${baseIndent}${label}`),
    ...formatCursorStatus(status, detailIndent),
    "",
  ];
}

function formatWorkspaceUpgradeStatuses(
  { upToDate, behind, failed }: GroupedWorkspaceUpgradeStatuses,
  failedOnly?: boolean,
): string[] {
  const lines: string[] = [chalk.bold.underline("Workspace")];

  if (upToDate.length === 0 && behind.length === 0 && failed.length === 0) {
    lines.push(chalk.dim("  No active/suspended workspaces found"));
    return lines;
  }

  if (!failedOnly) {
    for (const workspaceStatus of upToDate) {
      lines.push(...formatWorkspaceUpgradeStatus(workspaceStatus));
    }
  }

  for (const workspaceStatus of behind) {
    lines.push(...formatWorkspaceUpgradeStatus(workspaceStatus));
  }

  if (failed.length > 0) {
    const groupedByCommand = new Map<string | null, WorkspaceUpgradeStatus[]>();

    for (const workspaceStatus of failed) {
      const commandName = workspaceStatus.latestCommand?.name ?? null;
      if (!groupedByCommand.has(commandName)) {
        groupedByCommand.set(commandName, []);
      }
      groupedByCommand.get(commandName)!.push(workspaceStatus);
    }

    for (const [commandName, statuses] of groupedByCommand) {
      const formattedCommandName = commandName
        ? formatUpgradeCommandName(commandName)
        : "unknown";

      lines.push(chalk.red.bold(`  Failed at: ${formattedCommandName}`));

      for (const workspaceStatus of statuses) {
        lines.push(...formatWorkspaceUpgradeStatus(workspaceStatus, true));
      }
    }
  }

  return lines;
}

function formatSummary(
  instanceStatus: InstanceUpgradeStatus,
  { upToDate, behind, failed }: GroupedWorkspaceUpgradeStatuses,
): string[] {
  const lines: string[] = [chalk.bold.underline("Summary")];
  const totalCount = upToDate.length + behind.length + failed.length;

  lines.push(`  Instance: ${HEALTH_LABELS[instanceStatus.health]}`);

  if (totalCount === 0) {
    lines.push(chalk.dim("  No workspaces"));
    return lines;
  }

  const parts = [
    chalk.green(`${upToDate.length} up to date`),
    chalk.yellow(`${behind.length} behind`),
    chalk.red(`${failed.length} failed`),
  ];

  lines.push(`  Workspaces: ${parts.join(", ")} (${totalCount} total)`);

  if (behind.length > 0) {
    const behindCounts = new Map<string | null, number>();
    for (const status of behind) {
      const commandName = status.latestCommand?.name ?? null;
      behindCounts.set(commandName, (behindCounts.get(commandName) ?? 0) + 1);
    }
    for (const [commandName, count] of behindCounts) {
      const formattedCommandName = commandName
        ? formatUpgradeCommandName(commandName)
        : "no commands";
      lines.push(chalk.yellow(`    ${count} behind at: ${formattedCommandName}`));
    }
  }

  if (failed.length > 0) {
    const failureCounts = new Map<string | null, number>();
    for (const status of failed) {
      const commandName = status.latestCommand?.name ?? null;
      failureCounts.set(commandName, (failureCounts.get(commandName) ?? 0) + 1);
    }
    for (const [commandName, count] of failureCounts) {
      const formattedCommandName = commandName
        ? formatUpgradeCommandName(commandName)
        : "unknown";
      lines.push(chalk.red(`    ${count} failed at: ${formattedCommandName}`));
    }
  }

  lines.push("");
  return lines;
}

function groupWorkspaceUpgradeStatusesByHealth(
  workspaceStatuses: WorkspaceUpgradeStatus[],
): GroupedWorkspaceUpgradeStatuses {
  const upToDate: WorkspaceUpgradeStatus[] = [];
  const behind: WorkspaceUpgradeStatus[] = [];
  const failed: WorkspaceUpgradeStatus[] = [];

  for (const status of workspaceStatuses) {
    switch (status.health) {
      case UpgradeHealthEnum.UP_TO_DATE:
        upToDate.push(status);
        break;
      case UpgradeHealthEnum.BEHIND:
        behind.push(status);
        break;
      case UpgradeHealthEnum.FAILED:
        failed.push(status);
        break;
    }
  }

  return { upToDate, behind, failed };
}

export async function runUpgradeStatusCommand(
  options: UpgradeStatusOptions = {},
): Promise<void> {
  try {
    const appVersion = options.appVersion ?? process.env.APP_VERSION ?? "unknown";
    const lines: string[] = formatHeader(appVersion);

    const sequence = await getUpgradeSequence();

    const instanceStatus = await getInstanceStatus(sequence);
    lines.push(...formatInstanceStatus(instanceStatus));

    const workspaceStatuses = await getWorkspaceStatuses(
      sequence,
      options.workspaceIds,
    );
    const grouped = groupWorkspaceUpgradeStatusesByHealth(workspaceStatuses);

    lines.push(...formatWorkspaceUpgradeStatuses(grouped, options.failedOnly));
    lines.push(...formatSummary(instanceStatus, grouped));

    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  } catch (error) {
    console.error(
      chalk.red(
        `Failed to retrieve upgrade status: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
  }
}

export { invalidateInstanceAndAllWorkspacesStatus };
