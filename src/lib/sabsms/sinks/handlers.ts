/**
 * SabSMS v3.7 — wire sink delivery into the events worker.
 *
 * Registers a wildcard handler that streams every engine event to the
 * workspace's configured sinks (the sink's own `events` filter decides
 * what it actually receives). Mirrors `registerWebhookOutEventHandlers`.
 * No-ops fast when the workspace has no sinks (indexed empty query).
 */

import { ALL_KINDS, eventWorkspaceId, type SabsmsEventRouter } from '../events/consumer';
import { deliverEventToSinks } from './consume';

export function registerSinkEventHandlers(router: SabsmsEventRouter): void {
  router.on(ALL_KINDS, async (event, ctx) => {
    const workspaceId = eventWorkspaceId(event);
    if (!workspaceId) return;
    try {
      await deliverEventToSinks({
        id: ctx.entryId,
        kind: event.kind,
        workspaceId,
        at: event.at,
        payload: event.payload,
      });
    } catch (err) {
      ctx.log('sink delivery failed', {
        workspaceId,
        kind: event.kind,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
