import 'server-only';

/**
 * SabCreator Role Assignments client — wraps `/v1/sabcreator/role-assignments`.
 * Mirrors `rust/crates/sabcreator-role-assignments/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export interface SabcreatorRoleAssignmentDoc {
  _id: string;
  userId: string;
  appId: string;
  assigneeUserId: string;
  roleId: string;
  assignedAt: string;
  assignedBy?: string;
}

export interface SabcreatorRoleAssignmentListParams {
  page?: number;
  limit?: number;
  appId?: string;
  assigneeUserId?: string;
  roleId?: string;
}

export interface SabcreatorRoleAssignmentListResponse {
  items: SabcreatorRoleAssignmentDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcreatorRoleAssignmentCreateInput {
  appId: string;
  assigneeUserId: string;
  roleId: string;
}

function buildQuery(p?: SabcreatorRoleAssignmentListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.appId) qs.set('appId', p.appId);
  if (p.assigneeUserId) qs.set('assigneeUserId', p.assigneeUserId);
  if (p.roleId) qs.set('roleId', p.roleId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcreatorRoleAssignmentsApi = {
  list: (params?: SabcreatorRoleAssignmentListParams) =>
    rustFetch<SabcreatorRoleAssignmentListResponse>(
      `/v1/sabcreator/role-assignments${buildQuery(params)}`,
    ),
  create: (input: SabcreatorRoleAssignmentCreateInput) =>
    rustFetch<{ id: string; entity: SabcreatorRoleAssignmentDoc }>(
      '/v1/sabcreator/role-assignments',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabcreator/role-assignments/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      },
    ),
};
