'use server';

/**
 * SabCRM — email server actions (Email-in-CRM via **SabMail**).
 *
 * Bridges a SabCRM record (NEW engine, `/sabcrm/[objectSlug]/[recordId]`) to
 * its email correspondence, the way `sabcrm-comms.actions.ts` bridges
 * WhatsApp:
 *
 *   1. read the record through the Rust engine and pull its first
 *      EMAIL / EMAILS value (object metadata drives which `data.*` keys are
 *      email fields, in field order — see `src/lib/sabcrm/email-core.ts`);
 *   2. resolve the tenant's sending identity: the first active SabMail
 *      account (`listMailAccounts`, the SabBigin pattern in
 *      `sabbigin-email.actions.ts`);
 *   3. the thread merges two sources — SabMail mailbox messages filtered
 *      server-side to the correspondent (SabMail has no per-correspondent
 *      listing, only `listMailMessages` per account) plus the record's own
 *      `EMAIL` activities (the dependable sent-history while the SabMail
 *      transport is stubbed and persists no rows);
 *   4. sends go through {@link sendSabcrmEmailCore} — platform transport
 *      delivery + best-effort SabMail recording + a non-fatal `EMAIL`
 *      activity on the record — the same core the sequences scheduler can
 *      adopt for its email steps.
 *
 * Every action follows the SAME gate pipeline as the sibling
 * `sabcrm-comms.actions.ts` (session → project → RBAC → plan).
 *
 * Inbound routing lives in `src/lib/sabcrm/email-inbound.ts`
 * (`routeInboundSabcrmEmail`) — deliberately NOT here, because a `'use
 * server'` export is a public action endpoint and inbound routing
 * impersonates tenants.
 */

import { revalidatePath } from 'next/cache';

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import { sabcrmActivitiesApi } from '@/lib/rust-client/sabcrm-activities';
import { sabcrmTemplatesApi } from '@/lib/rust-client/sabcrm-templates';
import {
  listMailAccounts,
  listMailMessages,
} from '@/app/actions/mailbox.actions';
import type { MailMessageDoc } from '@/lib/rust-client/mail-messages';
import { firstRecordEmail, sendSabcrmEmailCore } from '@/lib/sabcrm/email-core';
import type { ActionResult, ObjectMetadata } from '@/lib/sabcrm/types';
import type { SabcrmRustActivity } from './sabcrm-twenty.actions.types';
import type {
  SabcrmEmailMessage,
  SabcrmEmailSendResult,
  SabcrmEmailTemplateOption,
  SabcrmEmailTemplateRender,
  SabcrmMailContext,
  SendSabcrmEmailInput,
} from './sabcrm-email.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Base path revalidated after mutations so the SabCRM UI re-fetches. */
const TW_BASE_PATH = '/sabcrm';

/** How many thread entries a context read returns. */
const THREAD_LIMIT = 50;

/** How many recent mailbox rows we scan for the correspondent. */
const MAILBOX_SCAN_LIMIT = 200;

/** Snippet length for activity-derived thread entries. */
const SNIPPET_MAX = 140;

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate (session → project → RBAC → plan) — mirrors sabcrm-comms.actions
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-comms.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into a message. */
function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof RustApiError) return e.message || fallback;
  return e instanceof Error ? e.message : fallback;
}

// ---------------------------------------------------------------------------
// Record → address resolution (shared by read + send)
// ---------------------------------------------------------------------------

/**
 * Read the record through the engine and resolve its first email address.
 * Metadata is only a hint — bare `email` / `emails` keys still resolve when
 * the object fetch fails.
 */
async function resolveRecordEmail(
  ctx: GateContext,
  objectSlug: string,
  recordId: string,
): Promise<string> {
  let object: ObjectMetadata | null = null;
  try {
    object = await sabcrmObjectsApi.get(objectSlug, ctx.projectId);
  } catch {
    object = null;
  }
  const record = await sabcrmRecordsApi.get(objectSlug, recordId, ctx.projectId);
  return firstRecordEmail(object, record.data ?? {});
}

// ---------------------------------------------------------------------------
// Thread assembly
// ---------------------------------------------------------------------------

/** Case-insensitive address equality. */
function sameAddress(a: string | undefined, b: string): boolean {
  return (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();
}

/** Does any entry of the address list match? */
function listHasAddress(
  list: Array<{ email: string }> | undefined,
  address: string,
): boolean {
  return (list ?? []).some((x) => sameAddress(x.email, address));
}

/** Map a SabMail mailbox row onto the flat thread shape. */
function mailDocToMessage(
  doc: MailMessageDoc,
  address: string,
): SabcrmEmailMessage {
  const incoming = sameAddress(doc.fromAddr?.email, address);
  const at = doc.sentAt ?? doc.receivedAt ?? doc.createdAt ?? null;
  return {
    id: `mail-${doc._id ?? doc.messageId ?? Math.random().toString(36).slice(2)}`,
    direction: incoming ? 'in' : 'out',
    subject: doc.subject?.trim() || '(no subject)',
    snippet: doc.snippet ?? '',
    at,
    source: 'sabmail',
  };
}

/**
 * Map an `EMAIL` activity onto the flat thread shape. Outbound sends are
 * titled `Email to {address}: {subject}`; inbound routing logs
 * `Email from {sender}: {subject}` (see `email-inbound.ts`).
 */
function activityToMessage(a: SabcrmRustActivity): SabcrmEmailMessage {
  const title = a.title ?? '';
  const direction: 'in' | 'out' = /^email\s+from\b/i.test(title) ? 'in' : 'out';
  const colon = title.indexOf(': ');
  const subject =
    colon >= 0 ? title.slice(colon + 2).trim() || '(no subject)' : title || '(no subject)';
  const body = (a.body ?? '').replace(/\s+/g, ' ').trim();
  return {
    id: `act-${a.id}`,
    direction,
    subject,
    snippet: body.length > SNIPPET_MAX ? `${body.slice(0, SNIPPET_MAX)}…` : body,
    at: a.createdAt ?? null,
    source: 'activity',
  };
}

/**
 * SabMail rows for this correspondent. SabMail only exposes a per-ACCOUNT
 * listing (`listMailMessages`), so we scan the most recent
 * {@link MAILBOX_SCAN_LIMIT} rows and filter by from/to/cc server-side.
 */
async function sabmailThread(
  accountId: string,
  address: string,
): Promise<SabcrmEmailMessage[]> {
  try {
    const docs = await listMailMessages({
      accountId,
      limit: MAILBOX_SCAN_LIMIT,
    });
    return (docs ?? [])
      .filter(
        (d) =>
          sameAddress(d.fromAddr?.email, address) ||
          listHasAddress(d.toAddrs, address) ||
          listHasAddress(d.cc, address),
      )
      .map((d) => mailDocToMessage(d, address));
  } catch {
    return [];
  }
}

/** The record's EMAIL-activity history (the stub-transport-proof source). */
async function activityThread(
  ctx: GateContext,
  objectSlug: string,
  recordId: string,
): Promise<SabcrmEmailMessage[]> {
  try {
    const activities = await sabcrmActivitiesApi.list({
      projectId: ctx.projectId,
      targetObject: objectSlug,
      targetRecordId: recordId,
      type: 'EMAIL',
      limit: THREAD_LIMIT,
    });
    return (activities ?? []).map(activityToMessage);
  } catch {
    return [];
  }
}

/** Email templates for the compose Select (kind = `email`). */
async function emailTemplates(
  projectId: string,
): Promise<SabcrmEmailTemplateOption[]> {
  try {
    const templates = await sabcrmTemplatesApi.list(projectId, {
      kind: 'email',
    });
    return (templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// getSabcrmMailContext
// ---------------------------------------------------------------------------

/**
 * Resolve the record's email context: address (first EMAIL / EMAILS field),
 * the tenant's SabMail sending identity, the merged thread (SabMail rows for
 * the correspondent + the record's EMAIL activities, oldest first) and the
 * email templates for the compose prefill.
 *
 * `connected: false` is a STATE, not an error — the tab renders a no-email
 * or connect-SabMail CTA from `reason` + `address`. The activity-derived
 * thread is still returned when SabMail is missing so history stays visible.
 */
export async function getSabcrmMailContext(
  projectId: string | undefined,
  objectSlug: string,
  recordId: string,
): Promise<SabcrmMailContext> {
  const empty = (
    reason: string,
    extra?: Partial<SabcrmMailContext>,
  ): SabcrmMailContext => ({
    connected: false,
    reason,
    threadSource: 'none',
    thread: [],
    templates: [],
    ...extra,
  });

  if (!objectSlug || !recordId) {
    return empty('objectSlug and recordId are required.');
  }

  const g = await gate('view', projectId);
  if (!g.ok) return empty(g.error);

  try {
    const address = await resolveRecordEmail(g.ctx, objectSlug, recordId);
    if (!address) {
      return empty('This record has no email address.');
    }

    // The tenant's sending identity — first active SabMail account.
    let account: { id: string; email: string } | undefined;
    try {
      const accounts = await listMailAccounts({ status: 'active', limit: 1 });
      const a = accounts[0];
      const email = a?.emailAddress ?? a?.localPart;
      if (a?._id && email) account = { id: a._id, email };
    } catch {
      account = undefined;
    }

    const [fromMail, fromActivities, templates] = await Promise.all([
      account ? sabmailThread(account.id, address) : Promise.resolve([]),
      activityThread(g.ctx, objectSlug, recordId),
      emailTemplates(g.ctx.projectId),
    ]);

    const thread = [...fromMail, ...fromActivities]
      .sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
      .slice(-THREAD_LIMIT);
    const threadSource: SabcrmMailContext['threadSource'] =
      fromMail.length > 0 && fromActivities.length > 0
        ? 'mixed'
        : fromMail.length > 0
          ? 'sabmail'
          : fromActivities.length > 0
            ? 'activities'
            : 'none';

    if (!account) {
      return empty(
        'SabMail is not connected yet. Create a mail account in SabMail first.',
        { address, thread, threadSource, templates },
      );
    }

    return {
      connected: true,
      address,
      account,
      thread,
      threadSource,
      templates,
    };
  } catch (e) {
    return empty(errorMessage(e, 'Failed to load the email context.'));
  }
}

// ---------------------------------------------------------------------------
// renderSabcrmEmailTemplate
// ---------------------------------------------------------------------------

/**
 * Render a stored email template against the record (`{{field}}` placeholders
 * resolve from the record's `data.*` — the engine's own render endpoint).
 * Used by the Email tab to prefill the composer when a template is picked.
 */
export async function renderSabcrmEmailTemplate(
  projectId: string | undefined,
  objectSlug: string,
  recordId: string,
  templateId: string,
): Promise<ActionResult<SabcrmEmailTemplateRender>> {
  if (!objectSlug || !recordId || !templateId) {
    return { ok: false, error: 'objectSlug, recordId and templateId are required.' };
  }
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const rendered = await sabcrmTemplatesApi.render(g.ctx.projectId, templateId, {
      object: objectSlug,
      recordId,
    });
    return {
      ok: true,
      data: {
        subject: rendered.subject,
        body: rendered.body,
        missingVariables: rendered.missingVariables ?? [],
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Failed to render the template.') };
  }
}

// ---------------------------------------------------------------------------
// sendSabcrmEmail
// ---------------------------------------------------------------------------

/**
 * Send an email to the record's resolved address through
 * {@link sendSabcrmEmailCore} (platform transport + best-effort SabMail
 * recording + non-fatal `EMAIL` activity titled
 * `Email to {address}: {subject}`). The address is re-resolved server-side —
 * a client-supplied recipient is never trusted.
 *
 * When `templateId` is set and `subject` / `body` are blank, the template is
 * rendered against the record server-side and fills the gaps.
 */
export async function sendSabcrmEmail(
  projectId: string | undefined,
  objectSlug: string,
  recordId: string,
  input: SendSabcrmEmailInput,
): Promise<ActionResult<SabcrmEmailSendResult>> {
  if (!objectSlug || !recordId) {
    return { ok: false, error: 'objectSlug and recordId are required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const address = await resolveRecordEmail(g.ctx, objectSlug, recordId);
    if (!address) {
      return { ok: false, error: 'This record has no email address.' };
    }

    let subject = (input.subject ?? '').trim();
    let body = (input.body ?? '').trim();

    // Template interpolation — fill blanks from the rendered template.
    if (input.templateId && (!subject || !body)) {
      try {
        const rendered = await sabcrmTemplatesApi.render(
          g.ctx.projectId,
          input.templateId,
          { object: objectSlug, recordId },
        );
        if (!subject) subject = (rendered.subject ?? '').trim();
        if (!body) body = (rendered.body ?? '').trim();
      } catch (e) {
        return {
          ok: false,
          error: errorMessage(e, 'Failed to render the template.'),
        };
      }
    }

    const sent = await sendSabcrmEmailCore({
      userId: g.ctx.userId,
      projectId: g.ctx.projectId,
      objectSlug,
      recordId,
      to: address,
      subject,
      body,
    });
    if (!sent.ok) {
      return { ok: false, error: sent.error ?? 'Failed to send the email.' };
    }

    revalidatePath(`${TW_BASE_PATH}/${objectSlug}/${recordId}`);
    return {
      ok: true,
      data: { activity: sent.activity, messageId: sent.messageId },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e, 'Failed to send the email.') };
  }
}
