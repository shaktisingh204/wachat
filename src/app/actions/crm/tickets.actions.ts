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
import { RustApiError } from '@/lib/rust-client';
import {
  crmTicketsApi,
  type CrmTicketCreateInput,
  type CrmTicketDoc,
  type CrmTicketListParams,
  type CrmTicketUpdateInput,
} from '@/lib/rust-client/crm-tickets';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';

const LIST_PATH = '/dashboard/crm/tickets';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface TicketListResult {
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
  try {
    const tickets = await crmTicketsApi.list({ ...params, page, limit });
    return { tickets, page, limit, hasMore: tickets.length === limit };
  } catch (e) {
    return { tickets: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getTicket(
  id: string,
): Promise<{ ticket: CrmTicketDoc | null; error?: string }> {
  if (!id) return { ticket: null, error: 'Missing ticket id.' };
  try {
    const ticket = await crmTicketsApi.getById(id);
    return { ticket };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { ticket: null, error: 'Ticket not found.' };
    }
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
  const id = pickString(formData, '_id');
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

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'Ticket updated.' : 'Ticket created.',
      id: String(result._id),
    };
  } catch (e) {
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
  try {
    await crmTicketsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Ticket not found.' };
    }
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
