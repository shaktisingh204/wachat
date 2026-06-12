import 'server-only';

/**
 * SabCRM inbound email routing — maps an inbound message (its FROM address)
 * onto the SabCRM record(s) carrying that address in an EMAIL / EMAILS field
 * and logs an `EMAIL` activity on each, so replies land on the record
 * Timeline next to the sends from the Email tab.
 *
 * This is a plain server helper, NOT a `'use server'` action — exposing it
 * as an action would let any browser invoke tenant-impersonating writes.
 * It is wired additively into the platform inbound-email webhook
 * (`src/app/api/webhooks/email-inbound/route.ts`), the same ingest point the
 * CRM ticket-email binding consumes; any future SabMail inbound receiver can
 * call it with an explicit identity instead.
 *
 * Tenant resolution (when the caller passes no identity):
 *   1. the SabMail account owning the recipient address
 *      (`sabmail_accounts.emailAddress`, the same store
 *      `mailbox.actions.ts` fronts);
 *   2. fallback: the CRM ticket-email binding for the recipient
 *      (`findTenantByTicketInbox`) — covers tenants who route inbound mail
 *      through that integration but keep records in SabCRM.
 *
 * All Rust-engine reads/writes go through `rustFetchAs(userId, …)` because
 * webhooks carry no session cookie.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { findTenantByTicketInbox } from '@/lib/crm/module-connections.server';
import { rustFetchAs } from '@/lib/rust-client/fetcher';
import { unenrollSabcrmSequencesForRecord } from '@/lib/sabcrm/sequences.server';
import type { SabcrmRustActivity } from '@/lib/rust-client/sabcrm-activities';
import type { ObjectMetadata } from '@/lib/sabcrm/types';

/** Parsed inbound envelope — same shape the email-inbound webhook receives. */
export interface InboundSabcrmEmail {
  /** Recipient (the tenant-owned address the mail arrived on). */
  to: string;
  /** Sender — the address matched against record EMAIL / EMAILS fields. */
  from: string;
  fromName?: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  messageId?: string;
  receivedAt?: Date;
}

/** Explicit identity, for callers that already know the tenant. */
export interface InboundSabcrmIdentity {
  userId: string;
  /** Defaults to the user's first project when omitted. */
  projectId?: string;
}

export interface RouteInboundSabcrmEmailResult {
  /** True when at least one activity was logged. */
  routed: boolean;
  /** Records the from-address matched. */
  matchedRecords: number;
  /** Activities actually created (≤ matchedRecords on partial failures). */
  activitiesLogged: number;
  /**
   * Sequence enrollments auto-stopped because this inbound message counts as
   * a reply from the record (`unenrollSabcrmSequencesForRecord`, cause
   * `reply` — gated per sequence by `settings.unenrollOnReply`).
   */
  sequencesUnenrolled: number;
  /** Why nothing was routed (`no-tenant`, `no-project`, `no-match`, …). */
  reason?: string;
}

/** Hard cap on activities per inbound message (multi-object fan-out guard). */
const MAX_ACTIVITIES = 10;
/** Per-object record match cap. */
const PER_OBJECT_LIMIT = 5;

interface ObjectsEnvelope {
  objects: ObjectMetadata[];
}

interface RecordsEnvelope {
  records: Array<{ _id?: string; id?: string }>;
  total: number;
}

interface ActivityEnvelope {
  activity: SabcrmRustActivity;
}

/** Best-effort plain text from an inbound body (text wins over HTML). */
function inboundBodyText(email: InboundSabcrmEmail): string {
  if (email.bodyText?.trim()) return email.bodyText.trim();
  if (email.bodyHtml?.trim()) {
    return email.bodyHtml
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
  }
  return '';
}

/** Resolve `{ userId }` from the recipient address (see module doc). */
async function resolveTenant(to: string): Promise<string | null> {
  const address = to.trim().toLowerCase();
  if (!address) return null;
  try {
    const { db } = await connectToDatabase();
    const account = await db
      .collection('sabmail_accounts')
      .findOne(
        { emailAddress: address },
        { projection: { userId: 1 } },
      );
    if (account?.userId) return String(account.userId);
  } catch {
    /* fall through to the ticket-email binding */
  }
  try {
    const binding = await findTenantByTicketInbox(address);
    if (binding?.userId) return binding.userId;
  } catch {
    /* no binding */
  }
  return null;
}

/** The user's first project id (mirrors the actions' default-project pick). */
async function resolveProject(userId: string): Promise<string | null> {
  try {
    const { db } = await connectToDatabase();
    const project = await db
      .collection('projects')
      .findOne(
        { userId: new ObjectId(userId) },
        { projection: { _id: 1 }, sort: { createdAt: 1 } },
      );
    return project ? String(project._id) : null;
  } catch {
    return null;
  }
}

/**
 * Route one inbound email onto SabCRM records. Never throws — failures
 * degrade to `{ routed: false, reason }` so the webhook stays healthy.
 */
export async function routeInboundSabcrmEmail(
  email: InboundSabcrmEmail,
  identity?: InboundSabcrmIdentity,
): Promise<RouteInboundSabcrmEmailResult> {
  const none = (reason: string): RouteInboundSabcrmEmailResult => ({
    routed: false,
    matchedRecords: 0,
    activitiesLogged: 0,
    sequencesUnenrolled: 0,
    reason,
  });

  const from = (email.from ?? '').trim().toLowerCase();
  if (!from || !from.includes('@')) return none('invalid-from');

  try {
    // 1. tenant + project
    const userId = identity?.userId ?? (await resolveTenant(email.to));
    if (!userId) return none('no-tenant');
    const projectId =
      identity?.projectId ?? (await resolveProject(userId));
    if (!projectId) return none('no-project');

    // 2. objects that can hold an email
    const { objects } = await rustFetchAs<ObjectsEnvelope>(
      userId,
      `/v1/sabcrm/objects?projectId=${encodeURIComponent(projectId)}`,
    );
    const emailObjects = (objects ?? [])
      .map((o) => ({
        slug: o.slug,
        keys: (o.fields ?? [])
          .filter((f) => f.type === 'EMAIL' || f.type === 'EMAILS')
          .map((f) => f.key),
      }))
      .filter((o) => o.keys.length > 0);
    if (emailObjects.length === 0) return none('no-email-objects');

    // 3. match records per object (OR over its email keys, plus the
    //    `primaryEmail` sub-path for EMAILS composites)
    const matches: Array<{ object: string; recordId: string }> = [];
    for (const obj of emailObjects) {
      if (matches.length >= MAX_ACTIVITIES) break;
      const conditions = obj.keys.flatMap((k) => [
        { field: k, operator: 'contains', value: from },
        { field: `${k}.primaryEmail`, operator: 'contains', value: from },
      ]);
      const filters = { op: 'or', conditions };
      try {
        const res = await rustFetchAs<RecordsEnvelope>(
          userId,
          `/v1/sabcrm/records/${encodeURIComponent(obj.slug)}?projectId=${encodeURIComponent(projectId)}&limit=${PER_OBJECT_LIMIT}&filters=${encodeURIComponent(JSON.stringify(filters))}`,
        );
        for (const r of res.records ?? []) {
          const id = String(r._id ?? r.id ?? '');
          if (id) matches.push({ object: obj.slug, recordId: id });
        }
      } catch {
        /* one object failing must not sink the rest */
      }
    }
    if (matches.length === 0) return none('no-match');

    // 4. log an EMAIL activity per matched record
    const subject = email.subject?.trim() || '(no subject)';
    const body = inboundBodyText(email);
    let logged = 0;
    for (const m of matches.slice(0, MAX_ACTIVITIES)) {
      try {
        await rustFetchAs<ActivityEnvelope>(userId, '/v1/sabcrm/activities', {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            type: 'EMAIL',
            title: `Email from ${email.fromName ?? from}: ${subject}`,
            body,
            targetObject: m.object,
            targetRecordId: m.recordId,
            authorId: userId,
          }),
        });
        logged += 1;
      } catch {
        /* non-fatal per record */
      }
    }

    // 5. a reply from the record auto-unenrolls its active sequence
    //    enrollments (per-sequence `settings.unenrollOnReply`, default true).
    //    Independent of activity logging — a reply is a reply even when the
    //    timeline write failed. `unenrollSabcrmSequencesForRecord` is
    //    best-effort and never throws.
    let unenrolled = 0;
    for (const m of matches.slice(0, MAX_ACTIVITIES)) {
      unenrolled += await unenrollSabcrmSequencesForRecord(
        projectId,
        m.object,
        m.recordId,
        'reply',
        { messageId: email.messageId },
      );
    }

    return {
      routed: logged > 0,
      matchedRecords: matches.length,
      activitiesLogged: logged,
      sequencesUnenrolled: unenrolled,
      reason: logged > 0 ? undefined : 'activity-log-failed',
    };
  } catch (e) {
    return none(e instanceof Error ? e.message : 'route-failed');
  }
}
