/**
 * SabSMS identity graph (V2.10) — `sabsms_identities`.
 *
 * Phone-number-keyed identity docs (architecture decision 9, Attentive
 * Signal pattern): one doc per `{workspaceId, phoneHash}` carrying the
 * consent snapshot, engagement aggregates, a 24-bucket UTC send-time
 * histogram (inbound + click activity), and slots for carrier/RCS
 * capability (filled by V2.11). Written by the events consumer
 * ([`touchIdentity`]); read by smart-send (`./smart-send.ts`), channel
 * selection, and the V2.12 agent.
 *
 * `phoneHash` is sha256 lowercase-hex of the trimmed, lowercased E.164 —
 * the EXACT convention `sabsms_suppressions` and the journeys store use
 * (see `../journeys/triggers.ts`), so the three collections join.
 *
 * Counter semantics: the live `$inc` path is at-least-once (rare replays
 * can over-count); `scripts/sabsms-identity-nightly.mjs` recomputes the
 * 30-day counters from `sabsms_messages` and decays the histogram ×0.95
 * nightly, which keeps everything honest over time.
 *
 * Worker-safe: relative imports only, no `server-only`.
 */

import { createHash } from 'node:crypto';
import { ObjectId, type Db } from 'mongodb';

import type { SabsmsEngineEvent } from '../events/consumer';

export const SABSMS_IDENTITIES_COLLECTION = 'sabsms_identities';

// ─── Shapes ────────────────────────────────────────────────────────────────

export type SabsmsConsentState = 'opted_in' | 'opted_out' | 'unknown';

export interface SabsmsIdentityDoc {
  workspaceId: string;
  /** sha256 hex of the trimmed, lowercased E.164. */
  phoneHash: string;
  /** Last 4 digits for human-readable admin views ("…1234"). */
  e164Last4?: string;
  contactIds: string[];
  carrierCountry?: string;
  rcsCapable?: { capable: boolean; checkedAt: Date };
  consent: { state: SabsmsConsentState; at: Date };
  engagement: {
    lastInboundAt?: Date;
    lastClickAt?: Date;
    lastDeliveredAt?: Date;
    inbound30d: number;
    clicks30d: number;
    delivered30d: number;
  };
  /** 24 UTC-hour buckets of inbound + click activity (decayed nightly). */
  sendTimeHistogram: number[];
  channelAffinity?: { sms: number; rcs: number };
  updatedAt: Date;
}

/** sha256 lowercase hex of the trimmed, lowercased E.164 (shared convention). */
export function phoneHashFor(e164: string): string {
  return createHash('sha256').update(e164.trim().toLowerCase()).digest('hex');
}

export function e164Last4(e164: string): string {
  const digits = e164.replace(/[^\d]/g, '');
  return digits.slice(-4);
}

export function emptyHistogram(): number[] {
  return new Array<number>(24).fill(0);
}

export async function ensureIdentityIndexes(db: Db): Promise<void> {
  const col = db.collection(SABSMS_IDENTITIES_COLLECTION);
  await col.createIndex({ workspaceId: 1, phoneHash: 1 }, { unique: true });
  await col.createIndex({ workspaceId: 1, updatedAt: -1 });
}

// ─── Touch path (events consumer) ─────────────────────────────────────────

/** Narrow db surface so unit tests can stub without a MongoClient. */
export interface IdentityDbLike {
  collection(name: string): {
    updateOne(filter: unknown, update: unknown, options?: unknown): Promise<unknown>;
    findOne(filter: unknown, options?: unknown): Promise<Record<string, unknown> | null>;
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** UTC hour 0-23 for an epoch-ms stamp (invalid → current hour). */
export function utcHourOf(atMs: number): number {
  const t = Number.isFinite(atMs) && atMs > 0 ? atMs : Date.now();
  return new Date(t).getUTCHours();
}

/**
 * Two-step upsert: `$setOnInsert` the zeroed base doc first, THEN apply
 * the touch. (A single upsert can't mix `$setOnInsert` of the full
 * histogram array with `$inc "sendTimeHistogram.<h>"` — Mongo would
 * either conflict on the path or materialise the histogram as an
 * object.) Both steps are individually idempotent-ish and safe to
 * replay; the nightly job is the exactness backstop.
 */
async function ensureBaseDoc(
  db: IdentityDbLike,
  workspaceId: string,
  phoneHash: string,
  phone: string,
  at: Date,
): Promise<void> {
  await db.collection(SABSMS_IDENTITIES_COLLECTION).updateOne(
    { workspaceId, phoneHash },
    {
      $setOnInsert: {
        workspaceId,
        phoneHash,
        ...(phone ? { e164Last4: e164Last4(phone) } : {}),
        contactIds: [],
        consent: { state: 'unknown', at },
        engagement: { inbound30d: 0, clicks30d: 0, delivered30d: 0 },
        sendTimeHistogram: emptyHistogram(),
        updatedAt: at,
      },
    },
    { upsert: true },
  );
}

/**
 * Resolve the phone for events that only carry a `messageId`
 * (`messageDelivered`, `linkClicked`). ONE indexed `_id` read against
 * `sabsms_messages`; returns the `to` (outbound destination) plus the
 * contactId when the message carries one.
 */
async function resolvePhoneViaMessage(
  db: IdentityDbLike,
  messageId: string,
): Promise<{ phone: string; contactId?: string } | null> {
  if (!messageId || !ObjectId.isValid(messageId)) return null;
  const msg = await db.collection('sabsms_messages').findOne(
    { _id: new ObjectId(messageId) },
    { projection: { to: 1, contactId: 1, direction: 1, from: 1 } },
  );
  if (!msg) return null;
  const phone = str(msg.direction === 'inbound' ? msg.from : msg.to);
  if (!phone) return null;
  const contactId = str(msg.contactId);
  return { phone, ...(contactId ? { contactId } : {}) };
}

export interface TouchResult {
  touched: boolean;
  reason?: string;
}

/**
 * Apply one engine event to the identity graph:
 *
 *   - `messageInbound`       → lastInboundAt, inbound30d++, histogram[hour]++
 *   - `linkClicked`          → lastClickAt, clicks30d++, histogram[hour]++
 *                              (phone resolved via messageId → message doc
 *                               when the pseudo-event payload lacks one)
 *   - `messageDelivered`     → lastDeliveredAt, delivered30d++ (phone via
 *                              one indexed messageId read — the payload
 *                              only carries ids)
 *   - `contactUnsubscribed`  → consent { state: 'opted_out' } (payload
 *                              already carries the phoneHash)
 *
 * Every other kind (campaign lifecycle, compliance, routeFailover, and
 * unknown/future kinds like otpSent/fraudBlocked) is a graceful no-op.
 */
export async function touchIdentity(
  db: IdentityDbLike,
  event: SabsmsEngineEvent,
): Promise<TouchResult> {
  const workspaceId = str(event.payload.workspaceId);
  if (!workspaceId) return { touched: false, reason: 'no workspaceId' };
  const at = new Date(event.at > 0 ? event.at : Date.now());
  const col = db.collection(SABSMS_IDENTITIES_COLLECTION);

  switch (event.kind) {
    case 'messageInbound': {
      const phone = str(event.payload.from);
      if (!phone) return { touched: false, reason: 'inbound without phone' };
      const phoneHash = phoneHashFor(phone);
      await ensureBaseDoc(db, workspaceId, phoneHash, phone, at);
      await col.updateOne(
        { workspaceId, phoneHash },
        {
          $inc: {
            'engagement.inbound30d': 1,
            [`sendTimeHistogram.${utcHourOf(event.at)}`]: 1,
          },
          $max: { 'engagement.lastInboundAt': at },
          $set: { updatedAt: at },
        },
      );
      return { touched: true };
    }

    case 'linkClicked': {
      let phone = str(event.payload.phone) || str(event.payload.to);
      let contactId = str(event.payload.contactId);
      if (!phone) {
        const resolved = await resolvePhoneViaMessage(db, str(event.payload.messageId));
        if (!resolved) return { touched: false, reason: 'click unresolvable to a phone' };
        phone = resolved.phone;
        contactId = contactId || (resolved.contactId ?? '');
      }
      const phoneHash = phoneHashFor(phone);
      await ensureBaseDoc(db, workspaceId, phoneHash, phone, at);
      await col.updateOne(
        { workspaceId, phoneHash },
        {
          $inc: {
            'engagement.clicks30d': 1,
            [`sendTimeHistogram.${utcHourOf(event.at)}`]: 1,
          },
          $max: { 'engagement.lastClickAt': at },
          $set: { updatedAt: at },
          ...(contactId ? { $addToSet: { contactIds: contactId } } : {}),
        },
      );
      return { touched: true };
    }

    case 'messageDelivered': {
      // Payload carries only ids — one indexed message read resolves the
      // destination phone (skipped if a future engine adds `to`).
      let phone = str(event.payload.to);
      let contactId = '';
      if (!phone) {
        const resolved = await resolvePhoneViaMessage(db, str(event.payload.messageId));
        if (!resolved) return { touched: false, reason: 'delivery unresolvable to a phone' };
        phone = resolved.phone;
        contactId = resolved.contactId ?? '';
      }
      const phoneHash = phoneHashFor(phone);
      await ensureBaseDoc(db, workspaceId, phoneHash, phone, at);
      await col.updateOne(
        { workspaceId, phoneHash },
        {
          $inc: { 'engagement.delivered30d': 1 },
          $max: { 'engagement.lastDeliveredAt': at },
          $set: { updatedAt: at },
          ...(contactId ? { $addToSet: { contactIds: contactId } } : {}),
        },
      );
      return { touched: true };
    }

    case 'contactUnsubscribed': {
      const phoneHash = str(event.payload.phoneHash);
      if (!phoneHash) return { touched: false, reason: 'unsubscribe without phoneHash' };
      await ensureBaseDoc(db, workspaceId, phoneHash, '', at);
      await col.updateOne(
        { workspaceId, phoneHash },
        { $set: { consent: { state: 'opted_out', at }, updatedAt: at } },
      );
      return { touched: true };
    }

    default:
      return { touched: false, reason: `ignored kind ${event.kind}` };
  }
}
