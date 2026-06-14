/**
 * Pure (I/O-free) helpers for the SabCRM → SabMail send bridge.
 *
 * Split out of `sabmail-bridge.server.ts` (which is `server-only`) so the
 * address/envelope logic is unit-testable with `tsx --test` without dragging
 * in the server runtime. The server bridge re-exports these.
 */

/**
 * Recipient descriptor (structurally identical to the mailbox transport's
 * `MailAddressDescriptor`). Declared locally so this pure module pulls in NO
 * `@/`-aliased imports and stays runnable under `tsx --test` with zero
 * resolver config.
 */
export interface MailAddressDescriptor {
  name?: string;
  email: string;
}

/** Loose-but-practical email shape check (mirrors email-core's). */
export function isEmailLike(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Normalize a recipient input (a single address or an array, possibly with
 * blanks/dupes/whitespace/casing noise) to a clean, de-duplicated address
 * list. Drops anything that doesn't look like an email. Comparison is
 * case-insensitive (first spelling wins); order is preserved.
 */
export function normalizeAddressList(
  input: string | string[] | undefined | null,
): string[] {
  const raw = Array.isArray(input) ? input : input == null ? [] : [input];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    for (const part of item.split(',')) {
      const addr = part.trim();
      if (!addr || !isEmailLike(addr)) continue;
      const key = addr.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(addr);
    }
  }
  return out;
}

/** A resolved SabMail-ish recipient set the engine/transport calls share. */
export interface NormalizedRecipients {
  to: string[];
  cc?: string[];
  bcc?: string[];
}

/**
 * Build the normalized recipient set for a send. Returns `null` when there is
 * no deliverable `to` address after cleaning (the caller should NOT attempt a
 * SabMail send in that case).
 */
export function buildRecipients(input: {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
}): NormalizedRecipients | null {
  const to = normalizeAddressList(input.to);
  if (to.length === 0) return null;
  const cc = normalizeAddressList(input.cc);
  const bcc = normalizeAddressList(input.bcc);
  const result: NormalizedRecipients = { to };
  if (cc.length) result.cc = cc;
  if (bcc.length) result.bcc = bcc;
  return result;
}

/** Map a clean address list to the transport's `MailAddressDescriptor[]`. */
export function toAddressDescriptors(
  addresses: string[],
): MailAddressDescriptor[] {
  return addresses.map((email) => ({ email }));
}

/**
 * Normalize a `references` header value into a clean, de-duplicated string
 * array (RFC 5322 message-ids are whitespace-separated). Always returns an
 * array (possibly empty) so the envelope shape stays stable. The In-Reply-To
 * id is appended last (RFC 5322: it is the last entry of References).
 */
export function normalizeReferences(
  references: string | string[] | undefined | null,
  inReplyTo?: string,
): string[] {
  const raw = Array.isArray(references)
    ? references
    : references == null
      ? []
      : references.split(/\s+/);
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (v: unknown) => {
    if (typeof v !== 'string') return;
    const id = v.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const r of raw) push(r);
  push(inReplyTo);
  return out;
}
