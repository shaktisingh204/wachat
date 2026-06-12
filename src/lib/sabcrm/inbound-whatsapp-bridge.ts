/**
 * SabCRM — inbound WhatsApp → CRM activity bridge (server-side only).
 *
 * Called fire-and-forget from WaChat's webhook ingest
 * (`handleSingleMessageEvent` in `src/lib/webhook-processor.ts`) right after
 * the `incoming_messages` insert. For every SabCRM record of the tenant whose
 * phone matches the sender's WhatsApp id, it logs a `WHATSAPP` activity on the
 * record's timeline THROUGH the Rust engine (`POST /v1/sabcrm/activities`,
 * authenticated with a freshly minted Rust JWT — mirroring
 * `forwardLeadGenToRust` in `src/app/api/webhooks/meta/route.ts`). The engine
 * owns `_id` / timestamps; this module never writes `sabcrm_activities`
 * directly.
 *
 * Matching is a direct Mongo READ of `sabcrm_records` (Next and the engine
 * share `MONGODB_URI` + `MONGODB_DB`). Verified against the engine source
 * (`rust/crates/sabcrm-records/src/handlers.rs` — `scope()` /
 * `create_record`): `projectId` is stored as a STRING (not ObjectId), `_id`
 * is an ObjectId, `object` is the slug string. v1 limitation: `$regex` only
 * matches STRING-typed `data.phone|phones|whatsapp` values — PHONES composite
 * objects are not matched (see the polish spec's risk list).
 *
 * Idempotency: the upstream `wamid` dedup in `handleSingleMessageEvent` means
 * this hook only runs on a message's FIRST delivery. Belt-and-braces, the
 * `wamid` is appended to the activity body tail (`[wamid:…]`).
 *
 * Kill-switch: `SABCRM_INBOUND_WA_BRIDGE=0` disables the bridge (default on).
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { digitsOnly, digitTolerantRegex } from '@/lib/sabcrm/phone';

/** Objects whose records an inbound message is matched against. */
const CRM_PHONE_OBJECTS = ['people', 'leads', 'companies'];

/** Hard cap on how many records one inbound message may be logged on. */
const MAX_MATCHES = 5;

/** Max characters of message text quoted in the activity title. */
const TITLE_TEXT_MAX = 120;

const LOG_PREFIX = '[CRM bridge]';

export interface InboundWhatsappEvent {
  /** SabNode tenant — the WaChat project's `userId` (Mongo ObjectId hex). */
  tenantId: string;
  /** Sender's WhatsApp id — Meta sends E.164 digits without the `+`. */
  waId: string;
  /** Sender's display name from the webhook contact profile. */
  senderName: string;
  /** Readable message text (caption / placeholder for media types). */
  text: string;
  /** Meta's globally unique message id — the idempotency anchor. */
  wamid: string;
  /**
   * Message timestamp. Informational only: the engine stamps the activity's
   * `createdAt` server-side at log time (≈ delivery time).
   */
  at?: Date;
}

/**
 * Log one inbound WhatsApp message as a `WHATSAPP` activity on every matching
 * SabCRM record of the tenant (best-effort, capped at {@link MAX_MATCHES}).
 * Never throws on bad input — the caller treats this as fire-and-forget; only
 * infrastructure errors (Mongo/fetch) propagate to the caller's `.catch`.
 */
export async function logInboundWhatsappToCrm(
  evt: InboundWhatsappEvent,
): Promise<void> {
  if (process.env.SABCRM_INBOUND_WA_BRIDGE === '0') return;
  if (!evt?.tenantId || !evt.waId || !evt.wamid) return;

  const digits = digitsOnly(evt.waId);
  if (digits.length < 8) return;

  let tenantOid: ObjectId;
  try {
    tenantOid = new ObjectId(evt.tenantId);
  } catch {
    return; // malformed tenant id — nothing to match
  }

  const { db } = await connectToDatabase();

  // 1. The tenant's project ids — CRM projects are plain `projects` docs
  //    (see `listSabcrmProjectsTw`); `sabcrm_records.projectId` stores the
  //    project's ObjectId HEX as a string.
  const projects = await db
    .collection('projects')
    .find({ userId: tenantOid }, { projection: { _id: 1 } })
    .toArray();
  const projectIds = projects.map((p) => String(p._id));
  if (projectIds.length === 0) return;

  // 2. Phone match — digit-tolerant regex anchored on the last 10 digits so
  //    "+91 98765 43210" / "098765-43210" / "9876543210" all match the waId.
  const pattern = digitTolerantRegex(digits);
  const matches = await db
    .collection('sabcrm_records')
    .find(
      {
        projectId: { $in: projectIds },
        object: { $in: CRM_PHONE_OBJECTS },
        deletedAt: { $exists: false },
        $or: [
          { 'data.phone': { $regex: pattern, $options: 'i' } },
          { 'data.phones': { $regex: pattern, $options: 'i' } },
          { 'data.whatsapp': { $regex: pattern, $options: 'i' } },
        ],
      },
      { projection: { _id: 1, projectId: 1, object: 1 } },
    )
    .limit(MAX_MATCHES)
    .toArray();
  if (matches.length === 0) return;

  // 3. Create the activities THROUGH the engine (never direct Mongo writes —
  //    it owns `_id`/timestamps). Token shape mirrors `forwardLeadGenToRust`.
  const { issueRustJwt } = await import('@/lib/jwt-for-rust');
  const token = await issueRustJwt({
    userId: evt.tenantId,
    tenantId: evt.tenantId,
    roles: [],
  });
  const rustBase = process.env.RUST_API_URL || 'http://localhost:8080';

  const text = (evt.text || '').trim() || '[message]';
  const sender = (evt.senderName || '').trim() || evt.waId;
  const title = `WhatsApp from ${sender}: ${text.slice(0, TITLE_TEXT_MAX)}`;
  // wamid tail = belt-and-braces idempotency marker (upstream dedup already
  // guarantees single delivery).
  const body = `${text}\n\n[wamid:${evt.wamid}]`;

  for (const rec of matches) {
    try {
      const res = await fetch(`${rustBase}/v1/sabcrm/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: String(rec.projectId),
          type: 'WHATSAPP',
          title,
          body,
          targetObject: String(rec.object),
          targetRecordId: String(rec._id),
          // Sentinel author — rendered as "WhatsApp" by the timeline (the
          // engine stores authorId verbatim; it is NOT ObjectId-validated,
          // verified in rust/crates/sabcrm-activities/src/handlers.rs).
          authorId: 'system:whatsapp-inbound',
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(
          `${LOG_PREFIX} engine rejected activity for ${rec.object}/${String(rec._id)}: ${res.status} ${detail}`,
        );
      }
    } catch (e: unknown) {
      console.error(
        `${LOG_PREFIX} activity create failed for ${rec.object}/${String(rec._id)}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }
}
