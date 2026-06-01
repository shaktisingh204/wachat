import "server-only";

// PORT-NOTE: service — NestJS @Injectable / @InjectDataSource DI removed.
// TypeORM DataSource / QueryRunner replaced by the Mongo upgrade-migration service.
// WorkspaceVersionService replaced by a direct MongoDB query for active/suspended workspace IDs.
// The fast/slow distinction is preserved; QueryRunner.up/down signatures are
// adapted to the Next.js interface (no QueryRunner arg — see interfaces/).

import {
  isLastAttemptCompleted,
  recordUpgradeMigration,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-migration.service";
import {
  invalidateInstanceAndAllWorkspacesStatus,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status.service";
import { type FastInstanceCommand } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/interfaces/fast-instance-command.interface";
import { type SlowInstanceCommand } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/interfaces/slow-instance-command.interface";
import { connectToDatabase } from "@/lib/mongodb";

type RunSingleMigrationResult =
  | { status: "success" }
  | { status: "already-executed" }
  | { status: "failed"; error: unknown };

async function getActiveOrSuspendedWorkspaceIds(): Promise<string[]> {
  const { db } = await connectToDatabase();
  const col = db.collection<{ id: string; activationStatus: string }>(
    "sabcrm_workspace",
  );
  const workspaces = await col
    .find(
      { activationStatus: { $in: ["ACTIVE", "SUSPENDED"] } },
      { projection: { id: 1 } },
    )
    .toArray();
  return workspaces.map((ws) => ws.id);
}

async function safeInvalidateUpgradeStatusCache(): Promise<void> {
  try {
    await invalidateInstanceAndAllWorkspacesStatus();
  } catch (error) {
    console.warn(
      `[InstanceCommandRunnerService] Failed to invalidate upgrade-status cache: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export async function runFastInstanceCommand({
  command,
  name,
  executedByVersion,
}: {
  command: FastInstanceCommand;
  name: string;
  executedByVersion?: string;
}): Promise<RunSingleMigrationResult> {
  const appVersion = executedByVersion ?? process.env.APP_VERSION ?? "unknown";

  const isAlreadyCompleted = await isLastAttemptCompleted({
    name,
    workspaceId: null,
  });

  if (isAlreadyCompleted) {
    console.log(`[InstanceCommandRunnerService] ${name} already executed, skipping`);
    return { status: "already-executed" };
  }

  try {
    await command.up();

    const workspaceIds = await getActiveOrSuspendedWorkspaceIds();

    await recordUpgradeMigration({
      name,
      workspaceIds,
      isInstance: true,
      status: "completed",
      executedByVersion: appVersion,
    });

    console.log(`[InstanceCommandRunnerService] ${name} executed successfully`);

    return { status: "success" };
  } catch (error) {
    const workspaceIds = await getActiveOrSuspendedWorkspaceIds();

    await recordUpgradeMigration({
      name,
      workspaceIds,
      isInstance: true,
      status: "failed",
      executedByVersion: appVersion,
      error,
    });

    console.error(
      `[InstanceCommandRunnerService] ${name} failed`,
      error instanceof Error ? error.stack : String(error),
    );

    return { status: "failed", error };
  } finally {
    await safeInvalidateUpgradeStatusCache();
  }
}

export async function runSlowInstanceCommand({
  command,
  name,
  skipDataMigration,
  executedByVersion,
}: {
  command: SlowInstanceCommand;
  name: string;
  skipDataMigration?: boolean;
  executedByVersion?: string;
}): Promise<RunSingleMigrationResult> {
  const appVersion = executedByVersion ?? process.env.APP_VERSION ?? "unknown";

  const isAlreadyCompleted = await isLastAttemptCompleted({
    name,
    workspaceId: null,
  });

  if (isAlreadyCompleted) {
    console.log(`[InstanceCommandRunnerService] ${name} already executed, skipping`);
    return { status: "already-executed" };
  }

  if (!skipDataMigration) {
    try {
      console.log(`[InstanceCommandRunnerService] ${name} starting data migration...`);
      await command.runDataMigration();
      console.log(`[InstanceCommandRunnerService] ${name} data migration completed`);
    } catch (error) {
      const workspaceIds = await getActiveOrSuspendedWorkspaceIds();

      await recordUpgradeMigration({
        name,
        workspaceIds,
        isInstance: true,
        status: "failed",
        executedByVersion: appVersion,
        error,
      });

      console.error(
        `[InstanceCommandRunnerService] ${name} data migration failed`,
        error instanceof Error ? error.stack : String(error),
      );

      await safeInvalidateUpgradeStatusCache();

      return { status: "failed", error };
    }
  }

  return runFastInstanceCommand({ command, name, executedByVersion: appVersion });
}
