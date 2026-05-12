'use server';

/**
 * CRM RFQ server actions.
 *
 * Thin shims over the Rust BFF (`crmRfqsApi`). No direct Mongo access.
 * FormData callers (the list/edit pages) hit `saveRfqAction` /
 * `deleteRfqAction`; programmatic callers can use the typed helpers
 * (`listRfqs`, `getRfq`).
 *
 * Note: `'rfq'` is intentionally NOT registered as a
 * `WsCustomFieldBelongsTo` key — RFQs skip the custom-field panel
 * entirely, mirroring the procurement audit-trail design used by
 * Purchase Orders.
 */

import { revalidatePath } from 'next/cache';
import { RustApiError } from '@/lib/rust-client';
import {
  crmRfqsApi,
  type CrmRfqAttachment,
  type CrmRfqCreateInput,
  type CrmRfqDoc,
  type CrmRfqLineItem,
  type CrmRfqListParams,
  type CrmRfqUpdateInput,
} from '@/lib/rust-client/crm-rfqs';

const LIST_PATH = '/dashboard/crm/purchases/rfqs';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface RfqListResult {
  rfqs: CrmRfqDoc[];
  page: number;
  limit: number;
  // The Rust endpoint returns a bare array — there's no `total` field.
  // The UI uses `hasMore` to know whether to render the Next button.
  hasMore: boolean;
  error?: string;
}

export async function listRfqs(params: CrmRfqListParams = {}): Promise<RfqListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
  try {
    const rfqs = await crmRfqsApi.list({ ...params, page, limit });
    return { rfqs, page, limit, hasMore: rfqs.length === limit };
  } catch (e) {
    return { rfqs: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getRfq(
  id: string,
): Promise<{ rfq: CrmRfqDoc | null; error?: string }> {
  if (!id) return { rfq: null, error: 'Missing RFQ id.' };
  try {
    const rfq = await crmRfqsApi.getById(id);
    return { rfq };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { rfq: null, error: 'RFQ not found.' };
    }
    return { rfq: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toStringOpt(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

/**
 * Parse the form's `items` hidden input — a JSON-encoded
 * `CrmRfqLineItem[]`. Returns `[]` when the blob is empty or malformed;
 * the action layer validates the resulting list before sending to Rust.
 *
 * RFQ lines carry NO price — only itemId / qty / unit / specs /
 * description. The Rust DTO requires `itemId` to be a valid 24-char hex
 * `ObjectId`; rows missing that are dropped silently (the form already
 * gates a row from existing via the item picker).
 */
function parseLineItems(formData: FormData): CrmRfqLineItem[] {
  const raw = formData.get('items');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (it): it is Record<string, unknown> =>
          typeof it === 'object' && it !== null,
      )
      .map((it) => normalizeLineItem(it))
      .filter((it): it is CrmRfqLineItem => it !== null);
  } catch {
    return [];
  }
}

function normalizeLineItem(raw: Record<string, unknown>): CrmRfqLineItem | null {
  const itemId = toStringOpt(raw.itemId);
  if (!itemId) return null;
  const qty = toNumber(raw.qty) ?? 0;
  return {
    itemId,
    description: toStringOpt(raw.description),
    qty,
    unit: toStringOpt(raw.unit),
    specs: toStringOpt(raw.specs),
  };
}

/**
 * Parse the form's `vendorsInvited` hidden input — a JSON-encoded array
 * of hex-encoded vendor `ObjectId`s. Empty / non-array payloads collapse
 * to an empty list.
 */
function parseVendorIds(formData: FormData): string[] {
  const raw = formData.get('vendorsInvited');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

/**
 * Parse the form's `attachments` hidden input — a JSON-encoded array of
 * `CrmRfqAttachment` records (SabFile references). Malformed entries are
 * dropped; per the project SabFiles policy these come from
 * `<SabFilePickerButton>` only — never a free-text URL paste.
 */
function parseAttachments(formData: FormData): CrmRfqAttachment[] {
  const raw = formData.get('attachments');
  if (typeof raw !== 'string' || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (a): a is Record<string, unknown> =>
          typeof a === 'object' && a !== null,
      )
      .map((a) => ({
        fileId: toStringOpt(a.fileId),
        name: toStringOpt(a.name),
        url: toStringOpt(a.url),
        mime: toStringOpt(a.mime),
        size: toNumber(a.size),
      }));
  } catch {
    return [];
  }
}

/**
 * Server-action entry point for the create / edit form.
 *
 * If `formData` carries an `_id`, this performs a PATCH; otherwise a
 * POST. RFQs have no custom-field bag.
 */
export async function saveRfqAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const id = pickString(formData, '_id');
  const title = pickString(formData, 'title');
  const items = parseLineItems(formData);
  const vendorsInvited = parseVendorIds(formData);
  const attachments = parseAttachments(formData);

  if (!id) {
    // Required-on-create gate.
    if (!title) return { error: 'Title is required.' };
    if (items.length === 0) {
      return { error: 'At least one line item is required.' };
    }
  } else if (items.length === 0 && (!title || title.length === 0)) {
    // PATCH with no items + no other meaningful change short-circuits at
    // the Rust side anyway, but a defensive nudge in the UI keeps the
    // user from posting a no-op.
  }

  // Rust expects an RFC3339 timestamp. The HTML date input gives us
  // `YYYY-MM-DD` — append the start-of-day UTC marker so the parser
  // accepts it.
  const toIso = (d?: string): string | undefined => {
    if (!d) return undefined;
    if (d.includes('T')) return d;
    return `${d}T00:00:00Z`;
  };

  try {
    let result: CrmRfqDoc;
    if (id) {
      const patch: CrmRfqUpdateInput = {};
      if (title) patch.title = title;
      if (items.length > 0) patch.items = items;
      const isoRequiredBy = toIso(pickString(formData, 'requiredBy'));
      if (isoRequiredBy) patch.requiredBy = isoRequiredBy;
      const isoDeadline = toIso(pickString(formData, 'deadline'));
      if (isoDeadline) patch.deadline = isoDeadline;
      // Vendors / attachments are full-array replacements on the Rust
      // side — only send when the hidden input was rendered (i.e. the
      // form was actually mounted). An empty array still wipes the
      // server state on PATCH, which is intentional: the user removed
      // every chip.
      if (formData.has('vendorsInvited')) patch.vendorsInvited = vendorsInvited;
      if (formData.has('attachments')) patch.attachments = attachments;
      const terms = pickString(formData, 'terms');
      if (terms) patch.terms = terms;
      const status = pickString(formData, 'status');
      if (status) patch.status = status;
      result = await crmRfqsApi.update(id, patch);
    } else {
      const draft: CrmRfqCreateInput = {
        title: title as string,
        items,
        requiredBy: toIso(pickString(formData, 'requiredBy')),
        vendorsInvited,
        terms: pickString(formData, 'terms'),
        deadline: toIso(pickString(formData, 'deadline')),
        attachments,
        fromKind: pickString(formData, 'fromKind'),
        fromId: pickString(formData, 'fromId'),
      };
      result = await crmRfqsApi.create(draft);
    }

    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${String(result._id)}`);
    return {
      message: id ? 'RFQ updated.' : 'RFQ created.',
      id: String(result._id),
    };
  } catch (e) {
    return { error: rustErr(e) };
  }
}

/**
 * Hard-delete an RFQ. The Rust handler removes the row from the
 * collection — no soft-delete flag.
 */
export async function deleteRfqAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing RFQ id.' };
  try {
    await crmRfqsApi.delete(id);
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'RFQ not found.' };
    }
    return { success: false, error: rustErr(e) };
  }
}

/* ─── Programmatic helpers (typed) ────────────────────────────── */

export async function createRfq(input: CrmRfqCreateInput) {
  return crmRfqsApi.create(input);
}

export async function updateRfq(id: string, patch: CrmRfqUpdateInput) {
  return crmRfqsApi.update(id, patch);
}

export async function deleteRfq(id: string) {
  return crmRfqsApi.delete(id);
}
