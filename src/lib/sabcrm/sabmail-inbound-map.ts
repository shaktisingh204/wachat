/**
 * Pure mapping from a SabMail inbound envelope → the `InboundSabcrmEmail`
 * shape consumed by `routeInboundSabcrmEmail`.
 *
 * Kept in its OWN module (no `server-only`, no DB) so it is unit-testable in
 * isolation (`npx tsx --test`) and importable from both the server bridge and
 * tests without dragging in Mongo / the Rust client.
 */

import type { InboundSabcrmEmail } from './email-inbound';

/** The raw envelope the SabMail inbound webhook has already normalized. */
export interface SabmailInboundRaw {
  /** The opaque SabMail tenant key (the `kind:'mail'` project `_id` string). */
  workspaceId: string;
  /** Sender address (matched against record EMAIL / EMAILS fields). */
  from: string;
  fromName?: string;
  /** Recipient — may be a single address or a comma-joined header string. */
  to: string;
  cc?: string;
  subject?: string;
  bodyText?: string;
  bodyHtml?: string;
  messageId?: string;
  receivedAt?: Date | string | number;
}

/** Clean a single address out of a `"Name <addr@host>"` / bare-address string. */
export function cleanAddress(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const angled = trimmed.match(/<([^>]+)>/);
  return (angled ? angled[1] : trimmed).trim().toLowerCase();
}

/**
 * First address from a header value that may carry several comma-separated
 * addresses (`"a@x.com, b@y.com"`). `routeInboundSabcrmEmail` keys tenant
 * resolution off a single recipient, so we pick the first.
 */
export function firstAddress(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const head = raw.split(',')[0];
  return cleanAddress(head);
}

/** Coerce an unknown receivedAt into a `Date` (or `undefined` when unusable). */
function toDate(value: SabmailInboundRaw['receivedAt']): Date | undefined {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

/**
 * Map a SabMail inbound envelope to the `InboundSabcrmEmail` shape. Pure:
 * no I/O, no throws. Normalizes addresses (lowercased, header-stripped) and
 * carries `messageId` through for idempotent downstream handling.
 */
export function mapSabmailInboundToCrmEmail(raw: SabmailInboundRaw): InboundSabcrmEmail {
  const subject = (raw.subject ?? '').trim() || '(no subject)';
  const email: InboundSabcrmEmail = {
    to: firstAddress(raw.to),
    from: cleanAddress(raw.from),
    subject,
  };
  const fromName = (raw.fromName ?? '').trim();
  if (fromName) email.fromName = fromName;
  if (raw.bodyText?.trim()) email.bodyText = raw.bodyText;
  if (raw.bodyHtml?.trim()) email.bodyHtml = raw.bodyHtml;
  const messageId = (raw.messageId ?? '').trim();
  if (messageId) email.messageId = messageId;
  const receivedAt = toDate(raw.receivedAt);
  if (receivedAt) email.receivedAt = receivedAt;
  return email;
}
