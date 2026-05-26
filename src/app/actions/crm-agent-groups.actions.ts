'use server';

/**
 * CRM AgentGroup server actions.
 *
 * Thin shims over the Rust BFF (`crmAgentGroupsApi`) at
 * `/v1/crm/agent-groups`. RBAC module: `crm_agent_group`.
 *
 * Agent groups bundle support agents into teams with a manager and an
 * assignment strategy (round_robin / load_balanced / manual / sticky)
 * plus an optional shared inbox + business-hours reference. The list
 * page is settings-style (inline dialog), so all writes flow through
 * `saveAgentGroup` as a `useActionState` reducer.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client';
import {
  crmAgentGroupsApi,
  type CrmAgentGroupAssignmentStrategy,
  type CrmAgentGroupCreateInput,
  type CrmAgentGroupDoc,
  type CrmAgentGroupStatus,
  type CrmAgentGroupUpdateInput,
} from '@/lib/rust-client/crm-agent-groups';

const LIST_PATH = '/dashboard/sabdesk/agent-groups';

const VALID_STRATEGIES: ReadonlySet<CrmAgentGroupAssignmentStrategy> = new Set([
  'round_robin',
  'load_balanced',
  'manual',
  'sticky',
]);

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

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

/**
 * Parse a comma-separated string of ObjectIds. Trims, drops empties,
 * de-duplicates while preserving order.
 */
function asIdList(v: FormDataEntryValue | null): string[] | undefined {
  const s = asString(v);
  if (!s) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of s.split(/[\s,]+/)) {
    const t = part.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out.length > 0 ? out : undefined;
}

/* ─── Read ────────────────────────────────────────────────────── */

export interface AgentGroupListResult {
  groups: CrmAgentGroupDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export interface GetAgentGroupsParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmAgentGroupStatus | 'all';
  assignmentStrategy?: CrmAgentGroupAssignmentStrategy | string;
  isActive?: boolean;
  managerId?: string;
}

export async function getAgentGroups(
  params: GetAgentGroupsParams = {},
): Promise<AgentGroupListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 200), 200);
  const session = await getSession();
  if (!session?.user) {
    return { groups: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_agent_group', 'view');
  if (!guard.ok) {
    return { groups: [], page, limit, hasMore: false, error: guard.error };
  }
  try {
    const res = await crmAgentGroupsApi.list({ ...params, page, limit });
    return {
      groups: res.items,
      page: res.page,
      limit: res.limit,
      hasMore: res.hasMore,
    };
  } catch (e) {
    console.error('[getAgentGroups] rust path failed:', e);
    recordRustFallback({
      entity: 'agent_group',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { groups: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getAgentGroupById(
  id: string,
): Promise<{ group: CrmAgentGroupDoc | null; error?: string }> {
  if (!id) return { group: null, error: 'Missing agent group id.' };
  const session = await getSession();
  if (!session?.user) return { group: null, error: 'Unauthorized' };
  const guard = await requirePermission('crm_agent_group', 'view');
  if (!guard.ok) return { group: null, error: guard.error };
  try {
    const group = await crmAgentGroupsApi.getById(id);
    return { group };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { group: null, error: 'Agent group not found.' };
    }
    console.error('[getAgentGroupById] rust path failed:', e);
    recordRustFallback({
      entity: 'agent_group',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { group: null, error: rustErr(e) };
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

export interface SaveAgentGroupState {
  message?: string;
  error?: string;
  id?: string;
}

/**
 * Create / update reducer for `useActionState`.
 *
 * `formData` carries: name (required), email, memberIds (comma-sep),
 * managerId, assignmentStrategy, businessHoursId, isActive, status,
 * description, plus an optional `_id` that flips this into PATCH mode.
 */
export async function saveAgentGroup(
  _prev: SaveAgentGroupState | null,
  formData: FormData,
): Promise<SaveAgentGroupState> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id = asString(formData.get('_id')) ?? asString(formData.get('groupId'));
  const guard = await requirePermission(
    'crm_agent_group',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  const name = asString(formData.get('name'));
  if (!id && !name) return { error: 'Name is required.' };

  const strategyRaw = asString(formData.get('assignmentStrategy'));
  const assignmentStrategy =
    strategyRaw && VALID_STRATEGIES.has(strategyRaw as CrmAgentGroupAssignmentStrategy)
      ? (strategyRaw as CrmAgentGroupAssignmentStrategy)
      : undefined;

  const draft: CrmAgentGroupCreateInput = {
    name: name ?? '',
    description: asString(formData.get('description')),
    email: asString(formData.get('email')),
    memberIds: asIdList(formData.get('memberIds')),
    managerId: asString(formData.get('managerId')),
    assignmentStrategy,
    businessHoursId: asString(formData.get('businessHoursId')),
    isActive: asBool(formData.get('isActive')) ?? true,
  };

  try {
    let result: CrmAgentGroupDoc;
    if (id) {
      const patch: CrmAgentGroupUpdateInput = { ...draft };
      if (!name) delete (patch as { name?: string }).name;
      const status = asString(formData.get('status')) as
        | CrmAgentGroupStatus
        | undefined;
      if (status === 'active' || status === 'archived') patch.status = status;
      result = await crmAgentGroupsApi.update(id, patch);
    } else {
      const created = await crmAgentGroupsApi.create(draft);
      result = created.entity;
    }

    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: id ? 'update' : 'create',
        entityKind: 'agent_group',
        entityId: String(result._id),
      });
    } catch {
      /* non-fatal */
    }

    revalidatePath(LIST_PATH);
    return {
      message: id ? 'Agent group updated.' : 'Agent group created.',
      id: String(result._id),
    };
  } catch (e) {
    console.error('[saveAgentGroup] rust path failed:', e);
    recordRustFallback({
      entity: 'agent_group',
      op: id ? 'update' : 'create',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { error: rustErr(e) };
  }
}

export async function deleteAgentGroup(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing agent group id.' };
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_agent_group', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };
  try {
    await crmAgentGroupsApi.delete(id);
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'delete',
        entityKind: 'agent_group',
        entityId: id,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(LIST_PATH);
    return { success: true };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { success: false, error: 'Agent group not found.' };
    }
    console.error('[deleteAgentGroup] rust path failed:', e);
    recordRustFallback({
      entity: 'agent_group',
      op: 'delete',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { success: false, error: rustErr(e) };
  }
}
