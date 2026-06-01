import "server-only";

import { type UsageEvent } from "@/lib/sabcrm/server/src/engine/core-modules/usage/types/usage-event.type";
import { type ClickHouseClient } from "@/lib/sabcrm/server/src/engine/core-modules/usage/services/usage-analytics.service";

// Simple DateTime formatter matching ClickHouse expectations
function formatDateTimeForClickHouse(date: Date): string {
  return date.toISOString().replace("T", " ").substring(0, 19);
}

// PORT-NOTE: In SabNode there is no global TwentyConfigService. The ClickHouse
// URL check is replaced by a runtime guard — callers should pass null when
// ClickHouse is not configured.

export function writeToClickHouse(
  workspaceId: string,
  usageEvents: UsageEvent[],
  client?: ClickHouseClient | null,
): void {
  if (!client) {
    // ClickHouse not configured — skip silently
    return;
  }

  const now = formatDateTimeForClickHouse(new Date());

  const rows = usageEvents.map((usageEvent) => ({
    timestamp: now,
    workspaceId,
    periodStart: usageEvent.periodStart
      ? formatDateTimeForClickHouse(usageEvent.periodStart)
      : undefined,
    userWorkspaceId: usageEvent.userWorkspaceId ?? "",
    resourceType: usageEvent.resourceType,
    operationType: usageEvent.operationType,
    quantity: usageEvent.quantity,
    unit: usageEvent.unit,
    creditsUsedMicro: usageEvent.creditsUsedMicro,
    resourceId: usageEvent.resourceId ?? "",
    resourceContext: usageEvent.resourceContext ?? "",
    metadata: {},
  }));

  client.insert("usageEvent", rows).catch((error: unknown) => {
    console.error("Failed to write usage events to ClickHouse", error);
  });
}
