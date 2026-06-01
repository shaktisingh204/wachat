import "server-only";

// PORT-NOTE: NestJS @Injectable / Logger / OnModuleInit removed.
// MetricsService (OpenTelemetry gauge registration) has no direct Next.js
// equivalent. The gauge registration calls are replaced by a plain cached
// status holder with an exported getter. Callers can wire this into any
// observability layer (Prometheus, Datadog, etc.) by polling
// getCachedUpgradeGaugeValues().

import {
  type InstanceAndAllWorkspacesUpgradeStatus,
  getInstanceAndAllWorkspacesStatus,
  UpgradeHealthEnum,
} from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-status.service";
import { type UpgradeStep } from "@/lib/sabcrm/server/src/engine/core-modules/upgrade/services/upgrade-sequence-reader.service";

const HEALTH_TO_GAUGE_VALUE: Record<UpgradeHealthEnum, number> = {
  [UpgradeHealthEnum.UP_TO_DATE]: 1,
  [UpgradeHealthEnum.BEHIND]: 0,
  [UpgradeHealthEnum.FAILED]: -1,
};

const HEALTH_UNKNOWN = -2;
const UPGRADE_STATUS_TTL_MS = 60_000;

// -- In-process cache --------------------------------------------------------

let cachedUpgradeStatus: InstanceAndAllWorkspacesUpgradeStatus | null = null;
let cachedUpgradeStatusExpiresAt = 0;
let inflightUpgradeStatusPromise: Promise<InstanceAndAllWorkspacesUpgradeStatus> | null = null;

export async function getCachedUpgradeStatus(
  sequence: UpgradeStep[],
): Promise<InstanceAndAllWorkspacesUpgradeStatus | null> {
  if (cachedUpgradeStatus && Date.now() < cachedUpgradeStatusExpiresAt) {
    return cachedUpgradeStatus;
  }

  if (inflightUpgradeStatusPromise) {
    return inflightUpgradeStatusPromise.catch(() => null);
  }

  inflightUpgradeStatusPromise = getInstanceAndAllWorkspacesStatus(sequence);

  try {
    cachedUpgradeStatus = await inflightUpgradeStatusPromise;
    cachedUpgradeStatusExpiresAt = Date.now() + UPGRADE_STATUS_TTL_MS;

    return cachedUpgradeStatus;
  } catch (error) {
    console.error("[UpgradeGaugeService] Failed to fetch upgrade status for gauges", error);
    return null;
  } finally {
    inflightUpgradeStatusPromise = null;
  }
}

/** Returns the current gauge values for external observability scraping. */
export async function getUpgradeGaugeValues(sequence: UpgradeStep[]): Promise<{
  instanceHealth: number;
  workspacesBehindTotal: number;
  workspacesFailedTotal: number;
  workspacesUpToDateTotal: number;
  inferredVersion: string;
}> {
  const upgradeStatus = await getCachedUpgradeStatus(sequence);

  return {
    instanceHealth:
      upgradeStatus != null
        ? (HEALTH_TO_GAUGE_VALUE[upgradeStatus.instanceUpgradeStatus.health] ??
          HEALTH_UNKNOWN)
        : HEALTH_UNKNOWN,
    workspacesBehindTotal: upgradeStatus?.workspacesBehind.length ?? 0,
    workspacesFailedTotal: upgradeStatus?.workspacesFailed.length ?? 0,
    workspacesUpToDateTotal: upgradeStatus?.upToDateWorkspaceCount ?? 0,
    inferredVersion:
      upgradeStatus?.instanceUpgradeStatus.inferredVersion ?? "unknown",
  };
}
