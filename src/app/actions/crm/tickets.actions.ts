'use server';

/**
 * CRM Ticket server actions.
 *
 * Thin shims over the Rust BFF (`crmTicketsApi`). No direct Mongo access.
 * FormData callers (the dialog/list pages) hit `saveTicketAction` /
 * `deleteTicketAction`; programmatic callers can use the typed helpers
 * (`listTickets`, `getTicket`, `createTicket`, `updateTicket`,
 * `deleteTicket`).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmTicketsApi,
  type CrmTicketCreateInput,
  type CrmTicketDoc,
  type CrmTicketListParams,
  type CrmTicketUpdateInput,
} from '@/lib/rust-client/crm-tickets';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { sendSlackNotification } from '@/lib/integrations/slack';

const LIST_PATH = '/dashboard/sabdesk';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

interface TicketListResult {
  tickets: CrmTicketDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listTickets(params: CrmTicketListParams = {}): Promise<TicketListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  const session = await getSession();
  if (!session?.user) return { tickets: [], page, limit, hasMore: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_ticket', 'view');
  if (!guard.ok) return { tickets: [], page, limit, hasMore: false, error: guard.error };
  try {
    const tickets = await crmTicketsApi.list({ ...params, page, limit });
    return { tickets, page, limit, hasMore: tickets.length === limit };
  } catch (e) {
    console.error('[listTickets] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'ticket', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { tickets: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getTicket(
  id: string,
): Promise<{ ticket: CrmTicketDoc | null; error?: string }> {
  if (!id) return { ticket: null, error: 'Missing ticket id.' };
  const session = await getSession();
  if (!session?.user) return { ticket: null, error: 'Unauthorized' };
  const guard = await requirePermission('crm_ticket', 'view');
  if (!guard.ok) return { ticket: null, error: guard.error };
  try {
    const ticket = await crmTicketsApi.getById(id);
    return { ticket };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { ticket: null, error: 'Ticket not found.' };
    }
    console.error('[getTicket] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'ticket', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { ticket: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function parseCustomFields(formData: FormData): Record<string, unknown> | null {
  const raw = formData.get('customFields');
  if (typeof raw !== 'string' || raw.length === 0 || raw === '{}') return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. Custom-field values (under the `customFields` JSON blob) are
 * persisted via `applyCustomFieldsToEntity` after the main row is
 * created/updated — failures there are logged but do not roll back the
 * ticket save.
 */
export async function saveTicketAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id');
  const guard = await requirePermission('crm_ticket', id ? 'edit' : 'create');
  if (!guard.ok) return { error: guard.error };

  const subject = pickString(formData, 'subject');
  const requesterId = pickString(formData, 'requesterId');
  const channel = pickString(formData, 'channel');
  const severity = pickString(formData, 'severity');

  if (!subject) {
    return { error: 'Subject is required.' };
  }
  if (!id) {
    // On create the Rust layer requires requesterId / channel / severity.
    // On update they're all optional (PATCH), so we only enforce the
    // create-time guard rails here.
    if (!requesterId) return { error: 'Requester (client) is required.' };
    if (!channel) return { error: 'Channel is required.' };
    if (!severity) return { error: 'Severity is required.' };
  }

  const draft: CrmTicketCreateInput = {
    subject,
    requesterId: requesterId ?? '',
    channel: channel ?? '',
    severity: severity ?? '',
    category: pickString(formData, 'category'),
    priority: pickString(formData, 'priority'),
    status: pickString(formData, 'status'),
    assigneeId: pickString(formData, 'assigneeId'),
    productId: pickString(formData, 'productId'),
    linkedDealId: pickString(formData, 'linkedDealId'),
    linkedInvoiceId: pickString(formData, 'linkedInvoiceId'),
    parentTicketId: pickString(formData, 'parentTicketId'),
    dueBy: pickString(formData, 'dueBy'),
  };

  try {
    let result: CrmTicketDoc;
    if (id) {
      const patch: CrmTicketUpdateInput = { ...draft };
      // Strip the empty placeholder strings that the create-time
      // required-fields fallback above injects — PATCH semantics treat
      // empty strings as "clear this field", which we don't want here.
      if (!requesterId) delete patch.requesterId;
      if (!channel) delete patch.channel;
      if (!severity) delete patch.severity;
      result = await crmTicketsApi.update(id, patch);
    } else {
      result = await crmTicketsApi.create(draft);
    }

    const cfValues = parseCustomFields(formData);
    if (cfValues && result._id) {
      try {
        await applyCustomFieldsToEntity('ticket', String(result._id), cfValues);
      } catch (e) {
        console.error('[saveTicketAction] custom fields apply failed:', e);
      }
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'ticket',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    const statusV = pickString(formData, 'status');
    if (!id) {
      void recordFlowAction('crm.ticket.created', {
        userId: String(session.user._id),
        target: String(result._id),
        metadata: { subject, channel, severity, status: statusV },
      });
      // Slack — non-fatal; never breaks ticket creation.
      const ticketNumber =
        (result as any).ticket_number ??
        (result as any).number ??
        String(result._id).slice(-6);
      void sendSlackNotification(
        `New ticket #${ticketNumber}: ${subject}`,
      ).catch((err) => console.warn('[saveTicketAction] slack notify failed:', err));

      // Fire the `ticket_created` notification email to the requester.
      // Best-effort — failures are logged but never break ticket creation.
      void (async () => {
        try {
          const { dispatchTransactionalEmail } = await import(
            '@/lib/email-dispatcher'
          );
          const { renderEffectiveTemplate } = await import(
            '@/lib/email-templates/render'
          );
          // Resolver: the requester's email + name need to be loaded from
          // the contact directory. The Rust BFF doesn't return it on the
          // create response — TODO: thread `requester.email` through the
          // `CrmTicketDoc` so we can skip this extra lookup. For now we
          // dispatch only when a public ticket URL contact lookup is
          // available; the engine still records the templateId.
          const rendered = await renderEffectiveTemplate(
            String(session.user._id),
            'ticket_created',
            {
              contactName: '',
              ticketNumber,
              ticketSubject: subject,
              ticketUrl: `${LIST_PATH}/${String(result._id)}`,
              companyName: '',
            },
          );
          // Without a resolved requester email we cannot send — log and
          // exit. Wiring requester lookup is the next step.
          console.log('[ticket_created] rendered', {
            ticketId: String(result._id),
            subject: rendered.subject,
          });
        } catch (notifyErr) {
          console.warn(
            '[saveTicketAction] ticket_created notify failed:',
            notifyErr,
          );
        }
      })();
    } else if (statusV === 'resolved' || statusV === 'closed') {
      void recordFlowAction('crm.ticket.resolved', {
        userId: String(session.user._id),
        target: String(result._id),
        metadata: { status: statusV },
      });
    } else if (statusV) {
      void recordFlowAction('crm.ticket.statusChanged', {
        userId: String(session.user._id),
        target: String(result._id),
        metadata: { status: statusV },
      });
    } else if (pickString(formData, 'assigneeId')) {
      void recordFlowAction('crm.ticket.assigned', {
        userId: String(session.user._id),
        target: String(result._id),
        metadata: { assigneeId: pickString(formData, 'assigneeId') },
      });
    }
    return {
      message: id ? 'Ticket updated.' : 'Ticket created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveTicketAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'ticket', op: id ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a ticket. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteTicketAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing ticket id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_ticket', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmTicketsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'ticket',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    void recordFlowAction('crm.ticket.deleted', {
      userId: String(session.user._id),
      target: id,
    });
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Ticket not found.' };
    }
    console.error('[deleteTicketAction] rust path failed; falling back:', e);
    recordRustFallback({ entity: 'ticket', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createTicket(input: CrmTicketCreateInput) {
  return crmTicketsApi.create(input);
}

export async function updateTicket(id: string, patch: CrmTicketUpdateInput) {
  return crmTicketsApi.update(id, patch);
}

export async function deleteTicket(id: string) {
  return crmTicketsApi.delete(id);
}

/* ─── getCrmTicketRelatedCounts ─────────────────────────────────────────
 * Right-rail counts (§5.6) for the ticket detail page: replies on this
 * ticket, attachments, and any related tickets (same requester or
 * parent linkage). Each filter is tenant-scoped on `userId`. Returns
 * zeros on any failure so the UI never blocks.
 */
export async function getCrmTicketRelatedCounts(ticketId: string): Promise<{
  replies: number;
  attachments: number;
  relatedTickets: number;
}> {
  const empty = { replies: 0, attachments: 0, relatedTickets: 0 };
  if (!ticketId) return empty;
  const session = await getSession();
  if (!session?.user) return empty;
  const guard = await requirePermission('crm_ticket', 'view');
  if (!guard.ok) return empty;

  try {
    const { db } = await connectToDatabase();
    const userId = new ObjectId(String(session.user._id));
    const idCandidates: unknown[] = [ticketId];
    if (ObjectId.isValid(ticketId)) idCandidates.push(new ObjectId(ticketId));

    // The ticket doc itself supplies `requesterId` + `parentTicketId`
    // so we can resolve sibling/child tickets in one extra round-trip.
    const ticketDoc = await db
      .collection('crm_tickets')
      .findOne(
        ObjectId.isValid(ticketId)
          ? ({ _id: new ObjectId(ticketId), userId } as Record<string, unknown>)
          : ({ _id: ticketId, userId } as Record<string, unknown>),
        { projection: { requesterId: 1, parentTicketId: 1 } },
      )
      .catch(() => null);
    const requesterId = (ticketDoc as { requesterId?: string } | null)?.requesterId;
    const parentTicketId = (ticketDoc as { parentTicketId?: string } | null)?.parentTicketId;

    const [replies, attachments, relatedTickets] = await Promise.all([
      db
        .collection('crm_ticket_replies')
        .countDocuments({
          userId,
          ticketId: { $in: idCandidates },
        } as Record<string, unknown>)
        .catch(() => 0),
      db
        .collection('crm_attachments')
        .countDocuments({
          userId,
          $or: [
            { entityKind: 'ticket', entityId: { $in: idCandidates } },
            { ticketId: { $in: idCandidates } },
          ],
        } as Record<string, unknown>)
        .catch(() => 0),
      (async () => {
        const ors: Record<string, unknown>[] = [];
        if (requesterId) ors.push({ requesterId });
        if (parentTicketId) ors.push({ parentTicketId });
        ors.push({ parentTicketId: { $in: idCandidates } });
        if (ors.length === 0) return 0;
        const idMatcher = ObjectId.isValid(ticketId)
          ? { $ne: new ObjectId(ticketId) }
          : { $ne: ticketId };
        return db
          .collection('crm_tickets')
          .countDocuments({
            userId,
            _id: idMatcher,
            $or: ors,
          } as Record<string, unknown>)
          .catch(() => 0);
      })(),
    ]);

    return {
      replies: Number(replies) || 0,
      attachments: Number(attachments) || 0,
      relatedTickets: Number(relatedTickets) || 0,
    };
  } catch (e) {
    console.error('[getCrmTicketRelatedCounts] failed:', e);
    return empty;
  }
}
