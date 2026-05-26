import 'server-only';

/**
 * Request Instance client — wraps `/v1/sabrequests/instances`.
 *
 * Counterpart of the Rust crate `sabrequests-instances`. A request
 * instance is a single live approval workflow spawned from a Blueprint.
 * The `decide` endpoint advances `currentStageIdx`, flips status to
 * approved/rejected/cancelled, and writes a row to
 * `requests_stage_actions` (audit log).
 */
import { rustFetch } from './fetcher';

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type StageActionKind = 'approve' | 'reject' | 'reassign' | 'comment';

export interface CurrentStageView {
  idx: number;
  name: string;
  approverId?: string;
  approverKind?: string;
  slaMins?: number;
}

export interface RequestInstanceDoc {
  _id: string;
  projectId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  blueprintId: string;
  blueprintName?: string;
  blueprintCategory?: string;
  requesterId: string;
  formData?: unknown;
  currentStageIdx: number;
  currentStage?: CurrentStageView;
  status: RequestStatus;
  slaDeadlineAt?: string;
  breachedAt?: string;
  decidedAt?: string;
  attachments?: unknown[];
  title?: string;
  priority?: string;
  archived?: boolean;
}

export interface RequestInstanceListParams {
  page?: number;
  limit?: number;
  q?: string;
  blueprintId?: string;
  status?: RequestStatus;
  awaitingMe?: boolean;
  mine?: boolean;
  breached?: boolean;
}

export interface RequestInstanceCreateInput {
  projectId?: string;
  blueprintId: string;
  blueprintName?: string;
  blueprintCategory?: string;
  formData?: unknown;
  currentStage?: CurrentStageView;
  currentStageIdx?: number;
  slaDeadlineAt?: string;
  title?: string;
  priority?: string;
  attachments?: unknown[];
}

export interface RequestInstanceUpdateInput {
  title?: string;
  priority?: string;
  formData?: unknown;
  attachments?: unknown[];
  cancel?: boolean;
}

export interface StageDecisionInput {
  action: StageActionKind;
  note?: string;
  reassignTo?: string;
  nextStage?: CurrentStageView;
  nextStageIdx?: number;
  nextSlaDeadlineAt?: string;
}

function buildListQuery(p?: RequestInstanceListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.blueprintId) qs.set('blueprintId', p.blueprintId);
  if (p.status) qs.set('status', p.status);
  if (p.awaitingMe != null) qs.set('awaitingMe', String(p.awaitingMe));
  if (p.mine != null) qs.set('mine', String(p.mine));
  if (p.breached != null) qs.set('breached', String(p.breached));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabrequestsInstancesApi = {
  list: (params?: RequestInstanceListParams) =>
    rustFetch<RequestInstanceDoc[]>(
      `/v1/sabrequests/instances${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<RequestInstanceDoc>(
      `/v1/sabrequests/instances/${encodeURIComponent(id)}`,
    ),
  create: (input: RequestInstanceCreateInput) =>
    rustFetch<RequestInstanceDoc>(`/v1/sabrequests/instances`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: RequestInstanceUpdateInput) =>
    rustFetch<RequestInstanceDoc>(
      `/v1/sabrequests/instances/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  decide: (id: string, decision: StageDecisionInput) =>
    rustFetch<RequestInstanceDoc>(
      `/v1/sabrequests/instances/${encodeURIComponent(id)}/decision`,
      { method: 'POST', body: JSON.stringify(decision) },
    ),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; archived?: boolean }>(
      `/v1/sabrequests/instances/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
