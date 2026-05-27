import 'server-only';

/**
 * SabCreator Workflows client — wraps `/v1/sabcreator/workflows`.
 * Mirrors `rust/crates/sabcreator-workflows/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabcreatorWorkflowStatus = 'active' | 'paused' | 'archived';

export type SabcreatorWorkflowTriggerKind =
  | 'form_submit'
  | 'record_change'
  | 'cron'
  | 'button_click';

export interface SabcreatorWorkflowTrigger {
  kind: SabcreatorWorkflowTriggerKind | string;
  config?: Record<string, unknown>;
}

export interface SabcreatorWorkflowDoc {
  _id: string;
  userId: string;
  appId: string;
  name: string;
  description?: string;
  trigger: SabcreatorWorkflowTrigger;
  sabflowRefId?: string;
  inlineStepsJson?: Record<string, unknown> | unknown;
  status: SabcreatorWorkflowStatus;
  createdAt?: string;
  updatedAt?: string;
  lastRunAt?: string;
}

export interface SabcreatorWorkflowListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcreatorWorkflowStatus | 'all' | 'active_visible';
  appId?: string;
  triggerKind?: SabcreatorWorkflowTriggerKind;
}

export interface SabcreatorWorkflowListResponse {
  items: SabcreatorWorkflowDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcreatorWorkflowCreateInput {
  appId: string;
  name: string;
  description?: string;
  trigger: SabcreatorWorkflowTrigger;
  sabflowRefId?: string;
  inlineStepsJson?: Record<string, unknown> | unknown;
}

export type SabcreatorWorkflowUpdateInput = Partial<
  Omit<SabcreatorWorkflowCreateInput, 'appId'>
> & {
  status?: SabcreatorWorkflowStatus;
};

export interface SabcreatorWorkflowRunInput {
  triggerData?: Record<string, unknown> | unknown;
}

function buildQuery(p?: SabcreatorWorkflowListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.appId) qs.set('appId', p.appId);
  if (p.triggerKind) qs.set('triggerKind', p.triggerKind);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcreatorWorkflowsApi = {
  list: (params?: SabcreatorWorkflowListParams) =>
    rustFetch<SabcreatorWorkflowListResponse>(
      `/v1/sabcreator/workflows${buildQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcreatorWorkflowDoc>(`/v1/sabcreator/workflows/${encodeURIComponent(id)}`),
  create: (input: SabcreatorWorkflowCreateInput) =>
    rustFetch<{ id: string; entity: SabcreatorWorkflowDoc }>('/v1/sabcreator/workflows', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabcreatorWorkflowUpdateInput) =>
    rustFetch<SabcreatorWorkflowDoc>(`/v1/sabcreator/workflows/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcreator/workflows/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  run: (id: string, input?: SabcreatorWorkflowRunInput) =>
    rustFetch<{ accepted: boolean; workflowId: string }>(
      `/v1/sabcreator/workflows/${encodeURIComponent(id)}/run`,
      {
        method: 'POST',
        body: JSON.stringify(input ?? {}),
      },
    ),
};
