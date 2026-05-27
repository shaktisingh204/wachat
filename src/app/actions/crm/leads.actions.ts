'use server';

/**
 * CRM Lead server actions.
 *
 * Thin shims over the Rust BFF (`crmLeadsApi`). No direct Mongo access.
 * FormData callers (the dialog/list pages) hit `saveLeadAction` /
 * `deleteLeadAction`; programmatic callers can use the typed helpers
 * (`listLeads`, `getLead`, `createLead`, `updateLead`, `deleteLead`).
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmLeadsApi,
  type CrmLeadCreateInput,
  type CrmLeadDoc,
  type CrmLeadListParams,
  type CrmLeadUpdateInput,
} from '@/lib/rust-client/crm-leads';
import { applyCustomFieldsToEntity } from '@/app/actions/worksuite/meta.actions';
import { recordFlowAction } from '@/lib/sabflow/audit/middleware';
import { getSession } from '@/app/actions/user.actions';

async function _crmLeadActorId(): Promise<string | null> {
  try {
    const session = await getSession();
    const u = (session as { user?: { _id?: unknown; id?: unknown } } | null)?.user;
    const raw = u?._id ?? u?.id;
    if (!raw) return null;
    return typeof raw === 'string' ? raw : String(raw);
  } catch {
    return null;
  }
}

const LIST_PATH = '/dashboard/crm/leads';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

interface LeadListResult {
  leads: CrmLeadDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listLeads(params: CrmLeadListParams = {}): Promise<LeadListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const leads = await crmLeadsApi.list({ ...params, page, limit });
    return { leads, page, limit, hasMore: leads.length === limit };
  } catch (e) {
    return { leads: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getLead(
  id: string,
): Promise<{ lead: CrmLeadDoc | null; error?: string }> {
  if (!id) return { lead: null, error: 'Missing lead id.' };
  try {
    const lead = await crmLeadsApi.getById(id);
    return { lead };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { lead: null, error: 'Lead not found.' };
    }
    return { lead: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
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
 * lead save.
 */
export async function saveLeadAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const firstName = pickString(formData, 'firstName');
  const lastName = pickString(formData, 'lastName');

  if (!firstName || !lastName) {
    return { error: 'First name and last name are required.' };
  }

  const draft: CrmLeadCreateInput = {
    firstName,
    lastName,
    email: pickString(formData, 'email'),
    phone: pickString(formData, 'phone'),
    company: pickString(formData, 'company'),
    title: pickString(formData, 'title'),
    source: pickString(formData, 'source'),
    subSource: pickString(formData, 'subSource'),
    status: pickString(formData, 'status'),
    leadScore: pickNumber(formData, 'leadScore'),
    ownerId: pickString(formData, 'ownerId'),
    assignedTo: pickString(formData, 'assignedTo'),
    estimatedValue: pickNumber(formData, 'estimatedValue'),
    currency: pickString(formData, 'currency') ?? 'INR',
    probabilityPct: pickNumber(formData, 'probabilityPct'),
    expectedClose: pickString(formData, 'expectedClose'),
    industry: pickString(formData, 'industry'),
  };

  try {
    let result: CrmLeadDoc;
    if (id) {
      const patch: CrmLeadUpdateInput = { ...draft };
      result = await crmLeadsApi.update(id, patch);
    } else {
      result = await crmLeadsApi.create(draft);
    }

    const cfValues = parseCustomFields(formData);
    if (cfValues && result._id) {
      try {
        await applyCustomFieldsToEntity('lead', String(result._id), cfValues);
      } catch (e) {
        console.error('[saveLeadAction] custom fields apply failed:', e);
      }
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    const actorId = await _crmLeadActorId();
    if (actorId) {
      void recordFlowAction(id ? 'crm.lead.updated' : 'crm.lead.created', {
        userId: actorId,
        target: String(result._id),
        metadata: { firstName, lastName, status: draft.status, source: draft.source },
      });
    }
    return {
      message: id ? 'Lead updated.' : 'Lead created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete a lead. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteLeadAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing lead id.' };
  try {
    await crmLeadsApi.delete(id);
    revalidatePath(LIST_PATH);
    const actorId = await _crmLeadActorId();
    if (actorId) {
      void recordFlowAction('crm.lead.deleted', {
        userId: actorId,
        target: id,
      });
    }
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Lead not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */
//
// 'use server' files only allow async exports — these helpers thinly
// wrap the Rust client so callers don't have to remember `await
// crmLeadsApi.x(...)`.

export async function createLead(input: CrmLeadCreateInput) {
  return crmLeadsApi.create(input);
}

export async function updateLead(id: string, patch: CrmLeadUpdateInput) {
  return crmLeadsApi.update(id, patch);
}

export async function deleteLead(id: string) {
  return crmLeadsApi.delete(id);
}
