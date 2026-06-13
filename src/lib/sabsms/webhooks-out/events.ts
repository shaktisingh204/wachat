/**
 * SabSMS outbound webhooks — event naming + filtering + URL rules.
 *
 * CLIENT-SAFE module (no Node APIs): the webhooks dashboard imports the
 * subscribable-event catalogue from here, while the signing/backoff
 * half (which needs `node:crypto`) stays in `./core` — which re-exports
 * this module so server/worker code keeps a single import surface.
 */

/**
 * Engine event kinds (camelCase serde tags) → public dotted webhook
 * event names. `ping` is the synthetic test-fire event.
 */
export const PUBLIC_EVENT_NAMES: Record<string, string> = {
  messageQueued: 'message.queued',
  messageSent: 'message.sent',
  messageDelivered: 'message.delivered',
  messageFailed: 'message.failed',
  messageInbound: 'message.inbound',
  contactUnsubscribed: 'contact.unsubscribed',
  complianceBlocked: 'compliance.blocked',
  complianceRescheduled: 'compliance.rescheduled',
  linkClicked: 'link.clicked',
  ping: 'ping',
};

/** Every subscribable public event name (for the endpoint editor). */
export const SUBSCRIBABLE_EVENTS: string[] = Object.values(PUBLIC_EVENT_NAMES).filter(
  (e) => e !== 'ping',
);

/** Public dotted name for an engine kind; null = not webhook-exposed. */
export function publicEventName(engineKind: string): string | null {
  return PUBLIC_EVENT_NAMES[engineKind] ?? null;
}

/**
 * True when an endpoint subscribed to `eventFilter` should receive
 * `publicEvent`. Empty filter = everything. `ping` always matches
 * (test-fires must reach the endpoint regardless of its filter).
 */
export function eventMatchesFilter(
  publicEvent: string,
  eventFilter: readonly string[] | undefined,
): boolean {
  if (publicEvent === 'ping') return true;
  if (!eventFilter || eventFilter.length === 0) return true;
  return eventFilter.includes(publicEvent);
}

/** Endpoint URLs must be https (no plaintext webhook traffic). */
export function validateWebhookUrl(url: string): { ok: true } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'Enter a valid URL' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Webhook endpoints must use https://' };
  }
  if (!parsed.hostname || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    return { ok: false, error: 'Webhook endpoints must be publicly reachable' };
  }
  return { ok: true };
}
