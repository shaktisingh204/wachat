'use server';

/**
 * CRM Reply Templates — server-action wrappers around the Rust BFF
 * (`crmReplyTemplatesApi` at `/v1/crm/reply-templates`).
 *
 * Reply templates are canned ticket replies / macros keyed by an optional
 * shortcut (e.g. `/refund`), with `{{variable}}` placeholders and
 * per-language / category bucketing.
 *
 * RBAC module: `crm_reply_template`.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { connectToDatabase } from '@/lib/mongodb';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmReplyTemplatesApi,
  type CrmReplyTemplateCreateInput,
  type CrmReplyTemplateDoc,
  type CrmReplyTemplateListParams,
  type CrmReplyTemplateListResponse,
  type CrmReplyTemplateStatus,
  type CrmReplyTemplateUpdateInput,
} from '@/lib/rust-client/crm-reply-templates';

const LIST_PATH = '/dashboard/sabdesk/reply-templates';

/* ─── Helpers ────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean | undefined {
  if (v == null) return undefined;
  const s = String(v).toLowerCase();
  if (s === '') return undefined;
  if (s === 'on' || s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'off' || s === 'false' || s === '0' || s === 'no') return false;
  return undefined;
}

function asStringList(v: FormDataEntryValue | null): string[] | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of s.split(/[\s,]+/)) {
    const t = part.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length > 0 ? out : undefined;
}

/** Extract `{{var}}` placeholders from a template body. */
function extractVariables(body: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const v = m[1];
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

/* ─── Reads ──────────────────────────────────────────────────────── */

interface GetReplyTemplatesParams extends CrmReplyTemplateListParams {}

export async function getReplyTemplates(
  params: GetReplyTemplatesParams = {},
): Promise<{
  items: CrmReplyTemplateDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 100), 200);
  const session = await getSession();
  if (!session?.user) {
    return { items: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_reply_template', 'view');
  if (!guard.ok) {
    return { items: [], page, limit, hasMore: false, error: guard.error };
  }
  try {
    const res: CrmReplyTemplateListResponse = await crmReplyTemplatesApi.list({
      ...params,
      page,
      limit,
    });
    return {
      items: res.items,
      page: res.page,
      limit: res.limit,
      hasMore: res.hasMore,
    };
  } catch (e) {
    console.error('[getReplyTemplates] rust path failed; falling back to MongoDB:', e);
    recordRustFallback({
      entity: 'reply_template',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    try {
      const { db } = await connectToDatabase();
      const query: Record<string, unknown> = { userId: session.user._id };
      if (params.category) query.category = params.category;
      if (params.language) query.language = params.language;
      if (params.isActive !== undefined) query.isActive = params.isActive;
      const items = await db
        .collection('crm_reply_templates')
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray() as CrmReplyTemplateDoc[];
      return { items, page, limit, hasMore: false };
    } catch (dbErr) {
      console.error('[getReplyTemplates] MongoDB fallback also failed:', dbErr);
      return { items: [], page, limit, hasMore: false, error: rustErr(e) };
    }
  }
}

export async function getReplyTemplateById(
  id: string,
): Promise<CrmReplyTemplateDoc | null> {
  if (!id) return null;
  const session = await getSession();
  if (!session?.user) return null;
  const guard = await requirePermission('crm_reply_template', 'view');
  if (!guard.ok) return null;
  try {
    return await crmReplyTemplatesApi.getById(id);
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) return null;
    console.error('[getReplyTemplateById] rust path failed; falling back to MongoDB:', e);
    recordRustFallback({
      entity: 'reply_template',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    try {
      const { db } = await connectToDatabase();
      const doc = await db
        .collection('crm_reply_templates')
        .findOne({ _id: id }) as CrmReplyTemplateDoc | null;
      return doc;
    } catch (dbErr) {
      console.error('[getReplyTemplateById] MongoDB fallback also failed:', dbErr);
      return null;
    }
  }
}

/* ─── Writes ─────────────────────────────────────────────────────── */

interface SaveReplyTemplateState {
  message?: string;
  error?: string;
  id?: string;
}

export async function saveReplyTemplate(
  _prev: SaveReplyTemplateState | null,
  formData: FormData,
): Promise<SaveReplyTemplateState> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = asString(formData.get('templateId')) ?? asString(formData.get('_id'));
  const guard = await requirePermission(
    'crm_reply_template',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  const name = asString(formData.get('name'));
  if (!id && !name) return { error: 'Template name is required.' };

  const body = asString(formData.get('body'));
  if (!id && !body) return { error: 'Template body is required.' };

  // Auto-extract variables from the body if the form didn't ship an
  // explicit list — the editor surfaces it as comma-separated text.
  const explicitVars = asStringList(formData.get('variables'));
  const variables =
    explicitVars ?? (body ? extractVariables(body) : undefined);

  const draft: CrmReplyTemplateCreateInput = {
    name: name ?? '',
    body: body ?? '',
    shortcut: asString(formData.get('shortcut')),
    category: asString(formData.get('category')),
    language: asString(formData.get('language')),
    variables,
    isActive: asBool(formData.get('isActive')) ?? true,
  };

  try {
    let result: CrmReplyTemplateDoc;
    if (id) {
      const patch: CrmReplyTemplateUpdateInput = { ...draft };
      if (!name) delete (patch as { name?: string }).name;
      if (!body) delete (patch as { body?: string }).body;
      const status = asString(formData.get('status')) as
        | CrmReplyTemplateStatus
        | undefined;
      if (status === 'active' || status === 'archived') patch.status = status;
      result = await crmReplyTemplatesApi.update(id, patch);
    } else {
      const created = await crmReplyTemplatesApi.create(draft);
      result = created.entity;
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'reply_template',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    if (id) revalidatePath(`${LIST_PATH}/${id}`);
    return {
      message: id ? 'Reply template updated.' : 'Reply template created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveReplyTemplate] rust path failed:', e);
    recordRustFallback({
      entity: 'reply_template',
      op: id ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { error: rustErr(e) };
  }
}

export async function deleteReplyTemplate(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing template id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_reply_template', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmReplyTemplatesApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'reply_template',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Reply template not found.' };
    }
    console.error('[deleteReplyTemplate] rust path failed:', e);
    recordRustFallback({
      entity: 'reply_template',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}

/* ─── KPIs ───────────────────────────────────────────────────────── */

interface ReplyTemplateKpis {
  total: number;
  active: number;
  byCategory: Record<string, number>;
  mostUsedName: string | null;
  mostUsedCount: number;
}

export async function getReplyTemplateKpis(): Promise<ReplyTemplateKpis> {
  const zero: ReplyTemplateKpis = {
    total: 0,
    active: 0,
    byCategory: {},
    mostUsedName: null,
    mostUsedCount: 0,
  };

  const session = await getSession();
  if (!session?.user) return zero;
  const guard = await requirePermission('crm_reply_template', 'view');
  if (!guard.ok) return zero;

  try {
    // Fetch a generous page of templates to derive KPIs client-side;
    // the Rust list endpoint handles tenant scoping.
    const res = await crmReplyTemplatesApi.list({ limit: 200 });
    const items = res.items;
    const total = items.length;
    const active = items.filter((t) => t.isActive).length;
    const byCategory: Record<string, number> = {};
    let mostUsedName: string | null = null;
    let mostUsedCount = 0;
    for (const t of items) {
      const cat = t.category ?? 'uncategorised';
      byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      if (t.usageCount > mostUsedCount) {
        mostUsedCount = t.usageCount;
        mostUsedName = t.name;
      }
    }
    return { total, active, byCategory, mostUsedName, mostUsedCount };
  } catch (e) {
    console.error('[getReplyTemplateKpis] failed:', e);
    recordRustFallback({
      entity: 'reply_template',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return zero;
  }
}

/* ─── Bulk operations ────────────────────────────────────────────── */

interface BulkUpdateResult {
  updated: number;
  errors: string[];
}

export async function bulkUpdateReplyTemplates(
  ids: string[],
  patch: { isActive?: boolean; status?: CrmReplyTemplateStatus },
): Promise<BulkUpdateResult> {
  if (!ids.length) return { updated: 0, errors: [] };

  const session = await getSession();
  if (!session?.user) return { updated: 0, errors: ['Unauthorized'] };
  const guard = await requirePermission('crm_reply_template', 'edit');
  if (!guard.ok) return { updated: 0, errors: [guard.error ?? 'Forbidden'] };

  let updated = 0;
  const errors: string[] = [];

  await Promise.all(
    ids.map(async (id) => {
      try {
        await crmReplyTemplatesApi.update(id, patch);
        updated += 1;
      } catch (e) {
        errors.push(`${id}: ${rustErr(e)}`);
        recordRustFallback({
          entity: 'reply_template',
          op: 'update',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }),
  );

  try {
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'bulk_update',
      entityKind: 'reply_template',
      entityId: ids.join(','),
      diff: Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, { after: v }]),
      ),
    });
  } catch {
    /* non-fatal */
  }

  revalidatePath(LIST_PATH);
  return { updated, errors };
}

interface BulkDeleteResult {
  deleted: number;
  errors: string[];
}

export async function bulkDeleteReplyTemplates(
  ids: string[],
): Promise<BulkDeleteResult> {
  if (!ids.length) return { deleted: 0, errors: [] };

  const session = await getSession();
  if (!session?.user) return { deleted: 0, errors: ['Unauthorized'] };
  const guard = await requirePermission('crm_reply_template', 'delete');
  if (!guard.ok) return { deleted: 0, errors: [guard.error ?? 'Forbidden'] };

  let deleted = 0;
  const errors: string[] = [];

  await Promise.all(
    ids.map(async (id) => {
      try {
        await crmReplyTemplatesApi.delete(id);
        deleted += 1;
      } catch (e) {
        if (e instanceof RustApiError && e.status === 404) {
          // Treat missing as already deleted.
          deleted += 1;
          return;
        }
        errors.push(`${id}: ${rustErr(e)}`);
        recordRustFallback({
          entity: 'reply_template',
          op: 'delete',
          errorCode: e instanceof RustApiError ? e.code : undefined,
          status: e instanceof RustApiError ? e.status : undefined,
        });
      }
    }),
  );

  try {
    await writeAuditEntry({
      tenantUserId: String(session.user._id),
      actorId: String(session.user._id),
      action: 'bulk_delete',
      entityKind: 'reply_template',
      entityId: ids.join(','),
    });
  } catch {
    /* non-fatal */
  }

  revalidatePath(LIST_PATH);
  return { deleted, errors };
}
