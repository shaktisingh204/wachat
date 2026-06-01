import "server-only";

// PORT-NOTE: NestJS @Injectable / @OnCustomBatchEvent decorators replaced with a
// plain exported function. Callers that previously relied on the NestJS event
// emitter should invoke handleUsageRecordedEvent() directly (or wire it into
// their own event bus adapter).

import { writeToClickHouse } from "@/lib/sabcrm/server/src/engine/core-modules/usage/services/usage-event-writer.service";
import { type UsageEvent } from "@/lib/sabcrm/server/src/engine/core-modules/usage/types/usage-event.type";

export type CustomWorkspaceEventBatch<TEvent> = {
  workspaceId: string | undefined;
  events: TEvent[];
};

export function handleUsageRecordedEvent(
  payload: CustomWorkspaceEventBatch<UsageEvent>,
): void {
  if (!payload.workspaceId) {
    return;
  }

  writeToClickHouse(payload.workspaceId, payload.events);
}
