import 'server-only';

/**
 * Request Blueprint client — wraps `/v1/sabrequests/blueprints`.
 *
 * Counterpart of the Rust crate `sabrequests-blueprints`. Blueprints are
 * templates that describe the form schema, approval stages, SLA, and
 * routing rules for a category of approval workflow (procurement,
 * time-off, IT access, custom). Live requests are spawned from these
 * via `sabrequests-instances`.
 */
import { rustFetch } from './fetcher';

export type BlueprintApproverKind =
  | 'user'
  | 'role'
  | 'manager_of_requester'
  | 'conditional';

export interface BlueprintStage {
  name: string;
  approverKind: BlueprintApproverKind | string;
  approverId?: string;
  approverRole?: string;
  conditionalExpr?: string;
  slaMins?: number;
  escalateOnBreach?: boolean;
  escalateToUserId?: string;
  description?: string;
}

export interface BlueprintRoutingRule {
  label: string;
  expr: string;
  startStageIdx: number;
}

export interface RequestBlueprintDoc {
  _id: string;
  projectId?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  formSchema?: unknown;
  stages?: BlueprintStage[];
  routingRules?: BlueprintRoutingRule[];
  ownerTeamId?: string;
  slaMins?: number;
  published?: boolean;
  archived?: boolean;
  deletedAt?: string;
}

export interface RequestBlueprintListParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  ownerTeamId?: string;
  published?: boolean;
}

export interface RequestBlueprintCreateInput {
  projectId?: string;
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  formSchema?: unknown;
  stages?: BlueprintStage[];
  routingRules?: BlueprintRoutingRule[];
  ownerTeamId?: string;
  slaMins?: number;
  published?: boolean;
}

export type RequestBlueprintUpdateInput = Partial<
  Omit<RequestBlueprintCreateInput, 'projectId'>
>;

function buildListQuery(p?: RequestBlueprintListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.category) qs.set('category', p.category);
  if (p.ownerTeamId) qs.set('ownerTeamId', p.ownerTeamId);
  if (p.published != null) qs.set('published', String(p.published));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabrequestsBlueprintsApi = {
  list: (params?: RequestBlueprintListParams) =>
    rustFetch<RequestBlueprintDoc[]>(
      `/v1/sabrequests/blueprints${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<RequestBlueprintDoc>(
      `/v1/sabrequests/blueprints/${encodeURIComponent(id)}`,
    ),
  create: (input: RequestBlueprintCreateInput) =>
    rustFetch<RequestBlueprintDoc>(`/v1/sabrequests/blueprints`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: RequestBlueprintUpdateInput) =>
    rustFetch<RequestBlueprintDoc>(
      `/v1/sabrequests/blueprints/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; archived?: boolean }>(
      `/v1/sabrequests/blueprints/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
