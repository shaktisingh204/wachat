/**
 * Newsletter — subscriber management + sending hooks.
 *
 * The actual SMTP/transactional send goes through `email-service.ts`. This
 * module models subscribers, double-opt-in tokens, and segmentation.
 */

import 'server-only';

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

import type { Newsletter, NewsletterStatus, NewsletterSubscriber } from './types';

// ── Subscriber lifecycle ─────────────────────────────────────────────────────

export interface SubscribeInput {
  email: string;
  tenantId?: string;
  tags?: string[];
}

export function createSubscriber(input: SubscribeInput): NewsletterSubscriber {
  return {
    email: normalizeEmail(input.email),
    tenantId: input.tenantId,
    status: 'active',
    tags: input.tags ?? [],
    subscribedAt: new Date(),
  };
}

export function unsubscribe(sub: NewsletterSubscriber): NewsletterSubscriber {
  return {
    ...sub,
    status: 'unsubscribed' as NewsletterStatus,
    unsubscribedAt: new Date(),
  };
}

export function markBounced(sub: NewsletterSubscriber): NewsletterSubscriber {
  return { ...sub, status: 'bounced' };
}

// ── Unsubscribe tokens (HMAC-signed, no DB lookup needed) ────────────────────

function getUnsubscribeSecret(): string {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET ?? process.env.JWT_SECRET;
  if (!secret) throw new Error('NEWSLETTER_UNSUBSCRIBE_SECRET (or JWT_SECRET) is not defined.');
  return secret;
}

export function makeUnsubscribeToken(email: string, secret: string = getUnsubscribeSecret()): string {
  const normalized = normalizeEmail(email);
  const sig = createHmac('sha256', secret).update(normalized).digest('hex').slice(0, 32);
  return `${Buffer.from(normalized).toString('base64url')}.${sig}`;
}

export function verifyUnsubscribeToken(token: string, secret: string = getUnsubscribeSecret()): string | null {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(b64, 'base64url').toString('utf-8');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', secret).update(email).digest('hex').slice(0, 32);
  if (sig.length !== expected.length) return null;
  const ok = timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return ok ? email : null;
}

// ── Newsletter campaign helpers ──────────────────────────────────────────────

export interface CreateNewsletterInput {
  subject: string;
  htmlBody: string;
  textBody?: string;
  segments?: string[];
  createdByUserId: string;
}

export function createNewsletter(input: CreateNewsletterInput): Newsletter {
  return {
    newsletterId: randomUUID(),
    subject: input.subject,
    htmlBody: input.htmlBody,
    textBody: input.textBody,
    segments: input.segments ?? [],
    status: 'draft',
    metrics: { sent: 0, opened: 0, clicked: 0, bounced: 0 },
    createdAt: new Date(),
    createdByUserId: input.createdByUserId,
  };
}

export function scheduleNewsletter(n: Newsletter, when: Date): Newsletter {
  return { ...n, status: 'scheduled', scheduledFor: when };
}

/**
 * Filter subscribers down to a campaign's audience based on segment tags.
 * Empty `segments` means "everyone active".
 */
export function audienceFor(
  subscribers: NewsletterSubscriber[],
  segments: string[],
): NewsletterSubscriber[] {
  const set = new Set(segments);
  return subscribers.filter((s) => {
    if (s.status !== 'active') return false;
    if (set.size === 0) return true;
    return s.tags.some((t) => set.has(t));
  });
}

/**
 * Build the canonical send-payload to hand off to `email-service.ts`.
 */
export interface SendPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  unsubscribeToken: string;
  /** "List-Unsubscribe" RFC 8058 header value. */
  listUnsubscribe: string;
}

export function buildSendPayload(
  newsletter: Newsletter,
  subscriber: NewsletterSubscriber,
  unsubscribeBaseUrl: string,
): SendPayload {
  const token = makeUnsubscribeToken(subscriber.email);
  const url = `${unsubscribeBaseUrl}?token=${encodeURIComponent(token)}`;
  return {
    to: subscriber.email,
    subject: newsletter.subject,
    html: newsletter.htmlBody,
    text: newsletter.textBody,
    unsubscribeToken: token,
    listUnsubscribe: `<${url}>, <mailto:unsubscribe@sabnode.app?subject=unsubscribe>`,
  };
}

/** Track a finished send batch into the newsletter's metrics. */
export function recordSendBatch(
  n: Newsletter,
  batch: { sent: number; bounced: number },
): Newsletter {
  return {
    ...n,
    status: 'sending',
    metrics: {
      ...n.metrics,
      sent: n.metrics.sent + batch.sent,
      bounced: n.metrics.bounced + batch.bounced,
    },
  };
}

export function markNewsletterSent(n: Newsletter): Newsletter {
  return { ...n, status: 'sent', sentAt: new Date() };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// `randomBytes` is exported indirectly via `randomUUID`, but expose for tests.
export const __unsafeRandomBytes = randomBytes;
