'use server';

/**
 * CRM TicketGroup server actions.
 *
 * Thin shims over the Rust BFF (`crmTicketGroupsApi`) at
 * `/v1/crm/ticket-groups`. No legacy Mongo fallback — failures surface as
 * an error string and are counted via `recordRustFallback`.
 *
 * RBAC module: `crm_ticket_group`.
 *
 * The settings-style list page (`/dashboard/sabdesk/groups`) uses
 * `getTicketGroups` to populate both the table and the parent-group
 * selector in the inline-create dialog. `saveTicketGroup` is wired as a
 * `useActionState` reducer — pass `null` as the previous state on the
 * first call.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmTicketGroupsApi,
  type CrmTicketGroupCreateInput,
  type CrmTicketGroupDoc,
  type CrmTicketGroupStatus,
  type CrmTicketGroupUpdateInput,
} from '@/lib/rust-client/crm-ticket-groups';

const LIST_PATH = '/dashboard/sabdesk/groups';

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickBool(formData: FormData, key: string): boolean | undefined {
  const v = formData.get(key);
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === '' ) return undefined;
    if (t === 'true' || t === '1' || t === 'on' || t === 'yes') return true;
    if (t === 'false' || t === '0' || t === 'off' || t === 'no') return false;
  }
  return undefined;
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface TicketGroupListResult {
  groups: CrmTicketGroupDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export interface GetTicketGroupsParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmTicketGroupStatus | 'all';
  isActive?: boolean;
  parentGroupId?: string;
}

export async function getTicketGroups(
  params: GetTicketGroupsParams = {},
): Promise<TicketGroupListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 200), 200);
  const session = await getSession();
  if (!session?.user) {
    return { groups: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_ticket_group', 'view');
  if (!guard.ok) {
    return { groups: [], page, limit, hasMore: false, error: guard.error };
  }
  try {
    const res = await crmTicketGroupsApi.list({ ...params, page, limit });
    return {
      groups: res.items,
      page: res.page,
      limit: res.limit,
      hasMore: res.hasMore,
    };
  } catch (e) {
    console.error('[getTicketGroups] rust path failed:', e);
    recordRustFallback({
      entity: 'ticket_group',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { groups: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getTicketGroupById(
  id: string,
): Promise<{ group: CrmTicketGroupDoc | null; error?: string }> {
  if (!id) return { group: null, error: 'Missing ticket group id.' };
  const session = await getSession();
  if (!session?.user) return { group: null, error: 'Unauthorized' };
  const guard = await requirePermission('crm_ticket_group', 'view');
  if (!guard.ok) return { group: null, error: guard.error };
  try {
    const group = await crmTicketGroupsApi.getById(id);
    return { group };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { group: null, error: 'Ticket group not found.' };
    }
    console.error('[getTicketGroupById] rust path failed:', e);
    recordRustFallback({
      entity: 'ticket_group',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { group: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

export interface SaveTicketGroupState {
  message?: string;
  error?: string;
  id?: string;
}

/**
 * Create / update reducer for `useActionState`.
 *
 * `formData` carries: name (required), description, parentGroupId,
 * defaultAssigneeId, defaultSlaId, color, icon, isActive, and an optional
 * `_id` (or `groupId`) that flips this into PATCH mode.
 */
export async function saveTicketGroup(
  _prev: SaveTicketGroupState | null,
  formData: FormData,
): Promise<SaveTicketGroupState> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = pickString(formData, '_id') ?? pickString(formData, 'groupId');
  const guard = await requirePermission(
    'crm_ticket_group',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  const name = pickString(formData, 'name');
  if (!id && !name) return { error: 'Name is required.' };

  const draft: CrmTicketGroupCreateInput = {
    name: name ?? '',
    description: pickString(formData, 'description'),
    parentGroupId: pickString(formData, 'parentGroupId'),
    defaultAssigneeId: pickString(formData, 'defaultAssigneeId'),
    defaultSlaId: pickString(formData, 'defaultSlaId'),
    color: pickString(formData, 'color'),
    icon: pickString(formData, 'icon'),
    isActive: pickBool(formData, 'isActive') ?? true,
  };

  try {
    let result: CrmTicketGroupDoc;
    if (id) {
      const patch: CrmTicketGroupUpdateInput = { ...draft };
      // PATCH semantics: don't overwrite name if the caller didn't set
      // it (saveTicketGroup is also reusable from a no-name edit shortcut).
      if (!name) delete (patch as { name?: string }).name;
      const status = pickString(formData, 'status') as
        | CrmTicketGroupStatus
        | undefined;
      if (status === 'active' || status === 'archived') patch.status = status;
      result = await crmTicketGroupsApi.update(id, patch);
    } else {
      result = await crmTicketGroupsApi.create(draft);
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'ticket_group',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    return {
      message: id ? 'Ticket group updated.' : 'Ticket group created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveTicketGroup] rust path failed:', e);
    recordRustFallback({
      entity: 'ticket_group',
      op: id ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { error: rustErr(e) };
  }
}

export async function deleteTicketGroup(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing ticket group id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_ticket_group', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmTicketGroupsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'ticket_group',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Ticket group not found.' };
    }
    console.error('[deleteTicketGroup] rust path failed:', e);
    recordRustFallback({
      entity: 'ticket_group',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}
