import 'server-only';

/**
 * In-process CRM event bus (CRM_REBUILD_PLAN §7.6 prep).
 *
 * Action layers call `emitCrmEvent({ kind, ... })` from inside their
 * mutation paths. Registered subscribers (notifications fan-out,
 * automations engine, webhook dispatcher) react asynchronously.
 *
 * The bus is intentionally **in-process** and **fire-and-forget**:
 *
 *   - Subscribers run with `void` so emitters don't await them.
 *   - Subscriber errors are caught and logged — never propagate.
 *   - Order is undefined; subscribers MUST be idempotent.
 *
 * A future iteration may swap to a durable queue (Vercel Queues per the
 * §0 knowledge-update) without changing the call sites — the public
 * `emitCrmEvent` / `subscribeCrmEvent` surface stays the same.
 */

import type { CrmResourceType } from '@/lib/notifications/crm';

export type CrmEventKind =
  | 'lead.created'
  | 'lead.updated'
  | 'lead.assigned'
  | 'lead.converted'
  | 'lead.deleted'
  | 'deal.created'
  | 'deal.updated'
  | 'deal.stage_changed'
  | 'deal.won'
  | 'deal.lost'
  | 'task.created'
  | 'task.assigned'
  | 'task.completed'
  | 'ticket.created'
  | 'ticket.assigned'
  | 'ticket.status_changed'
  | 'ticket.sla_breach'
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid'
  | 'invoice.overdue'
  | 'subscription.created'
  | 'subscription.renewed'
  | 'subscription.failed'
  | 'subscription.cancelled'
  | 'contract.signed'
  | 'contract.expiring_soon';

export interface CrmEvent<TPayload = Record<string, unknown>> {
  /** Stable event identifier — e.g. "lead.assigned". */
  kind: CrmEventKind;
  /** Tenant user id ("userId" on every CRM doc). */
  tenantUserId: string;
  /** Actor user id (often equal to tenantUserId today). */
  actorId?: string;
  /** What entity was acted on, when applicable. */
  resourceType?: CrmResourceType | string;
  /** Mongo `_id` of the entity, as a hex string. */
  resourceId?: string;
  /** ISO timestamp the event was emitted (auto-stamped). */
  emittedAt: string;
  /** Free-form payload — shape is per-`kind`. Subscribers narrow as needed. */
  payload: TPayload;
}

export type CrmEventHandler = (event: CrmEvent) => void | Promise<void>;

interface Subscription {
  id: number;
  kinds: Set<CrmEventKind> | '*';
  handler: CrmEventHandler;
}

// Per-process singleton. Resets on cold start.
const subscriptions: Subscription[] = [];
let nextId = 1;

/**
 * Register a handler. Pass `kind: '*'` to listen to every event.
 * Returns an `unsubscribe` function.
 */
export function subscribeCrmEvent(
  kind: CrmEventKind | CrmEventKind[] | '*',
  handler: CrmEventHandler,
): () => void {
  const sub: Subscription = {
    id: nextId++,
    kinds:
      kind === '*'
        ? '*'
        : new Set(Array.isArray(kind) ? kind : [kind]),
    handler,
  };
  subscriptions.push(sub);
  return () => {
    const i = subscriptions.findIndex((s) => s.id === sub.id);
    if (i >= 0) subscriptions.splice(i, 1);
  };
}

/**
 * Fire an event. Non-blocking — subscribers run asynchronously and
 * errors are logged but not propagated.
 */
export function emitCrmEvent<TPayload = Record<string, unknown>>(
  partial: Omit<CrmEvent<TPayload>, 'emittedAt'> & { emittedAt?: string },
): void {
  const event: CrmEvent<TPayload> = {
    ...partial,
    emittedAt: partial.emittedAt ?? new Date().toISOString(),
  } as CrmEvent<TPayload>;

  for (const sub of subscriptions) {
    if (sub.kinds !== '*' && !sub.kinds.has(event.kind)) continue;
    // Fire-and-forget: don't await; subscribers must be idempotent.
    Promise.resolve()
      .then(() => sub.handler(event as CrmEvent))
      .catch((e) => {
        console.error(
          JSON.stringify({
            event: 'crm_event_handler_error',
            kind: event.kind,
            subId: sub.id,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
      });
  }
}

/**
 * Test-only helper. Wait for all currently-pending handlers to settle.
 * Returns a promise that resolves after a microtask flush.
 */
export async function _flushCrmEventBus(): Promise<void> {
  await Promise.resolve();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

/** Test-only helper. Drop every subscription. */
export function _resetCrmEventBus(): void {
  subscriptions.length = 0;
}

/** Test-only helper. Returns count for assertions. */
export function _crmEventSubscriberCount(): number {
  return subscriptions.length;
}
