import "server-only";

import { WorkspaceActivationStatus } from "@/lib/sabcrm/shared/workspace/workspace-activation-status.enum";

import { connectToDatabase } from "@/lib/mongodb";
import { getWorkspaceCollection } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.entity";

// PORT-NOTE: NestJS OnModuleInit + injectable metrics gauge registration is
// not applicable in Next.js. Gauge logic is preserved as plain async functions
// that can be called from a monitoring route/cron. MetricsService gauge
// registration (OpenTelemetry observable gauges) has no direct Next.js
// equivalent — wire these into your metrics collection layer manually.

/**
 * Returns the count of workspaces with the given activation status
 * (soft-deleted records excluded).
 */
export async function getWorkspaceCountByStatus(
  status: WorkspaceActivationStatus,
): Promise<number> {
  const client = await connectToDatabase();
  const collection = getWorkspaceCollection(client);

  try {
    return await collection.countDocuments({
      activationStatus: status,
      deletedAt: null,
    });
  } catch (error) {
    console.error(`Failed to count workspaces with status ${status}`, error);
    return 0;
  }
}

/**
 * Returns the total count of soft-deleted workspaces.
 */
export async function getDeletedWorkspacesCount(): Promise<number> {
  const client = await connectToDatabase();
  const collection = getWorkspaceCollection(client);

  try {
    return await collection.countDocuments({
      deletedAt: { $ne: null },
    });
  } catch (error) {
    console.error("Failed to count deleted workspaces", error);
    return 0;
  }
}

/**
 * Registers all workspace gauges — call this from a metrics initialisation
 * module (e.g., a Next.js instrumentation hook).
 *
 * @param metricsService - supply your own metrics adapter with createObservableGauge.
 */
export function registerWorkspaceGauges(metricsService: {
  createObservableGauge: (opts: {
    metricName: string;
    options: { description: string };
    callback: () => Promise<number>;
    cacheValue: boolean;
  }) => void;
}) {
  for (const status of Object.values(WorkspaceActivationStatus)) {
    metricsService.createObservableGauge({
      metricName: `twenty_workspaces_by_status_${status.toLowerCase()}`,
      options: {
        description: `Number of workspaces with activation status ${status}`,
      },
      callback: () => getWorkspaceCountByStatus(status),
      cacheValue: true,
    });
  }

  metricsService.createObservableGauge({
    metricName: "twenty_workspaces_deleted_total",
    options: {
      description: "Total number of soft-deleted workspaces",
    },
    callback: getDeletedWorkspacesCount,
    cacheValue: true,
  });
}
