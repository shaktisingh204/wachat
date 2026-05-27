import 'server-only';

/**
 * SabCreator Forms client — wraps `/v1/sabcreator/forms`.
 * Mirrors `rust/crates/sabcreator-forms/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabcreatorFormStatus = 'draft' | 'published' | 'archived';

export type SabcreatorFormSubmitAction =
  | 'createRecord'
  | 'updateRecord'
  | 'callWorkflow';

export interface SabcreatorFormFieldSpec {
  tableFieldId: string;
  label: string;
  helpText?: string;
  required?: boolean;
  hidden?: boolean;
  defaultValue?: unknown;
  validations?: Record<string, unknown>;
  conditional?: Record<string, unknown>;
}

export interface SabcreatorFormDoc {
  _id: string;
  userId: string;
  appId: string;
  name: string;
  description?: string;
  sabtablesTableId?: string;
  fieldsJson: SabcreatorFormFieldSpec[] | unknown;
  layoutJson?: Record<string, unknown>;
  submitAction: SabcreatorFormSubmitAction;
  submitWorkflowId?: string;
  status: SabcreatorFormStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcreatorFormListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcreatorFormStatus | 'all' | 'active_visible';
  appId?: string;
}

export interface SabcreatorFormListResponse {
  items: SabcreatorFormDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcreatorFormCreateInput {
  appId: string;
  name: string;
  description?: string;
  sabtablesTableId?: string;
  fieldsJson?: SabcreatorFormFieldSpec[] | unknown;
  layoutJson?: Record<string, unknown>;
  submitAction?: SabcreatorFormSubmitAction;
  submitWorkflowId?: string;
}

export type SabcreatorFormUpdateInput = Partial<Omit<SabcreatorFormCreateInput, 'appId'>> & {
  status?: SabcreatorFormStatus;
};

function buildQuery(p?: SabcreatorFormListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.appId) qs.set('appId', p.appId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcreatorFormsApi = {
  list: (params?: SabcreatorFormListParams) =>
    rustFetch<SabcreatorFormListResponse>(`/v1/sabcreator/forms${buildQuery(params)}`),
  getById: (id: string) =>
    rustFetch<SabcreatorFormDoc>(`/v1/sabcreator/forms/${encodeURIComponent(id)}`),
  create: (input: SabcreatorFormCreateInput) =>
    rustFetch<{ id: string; entity: SabcreatorFormDoc }>('/v1/sabcreator/forms', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabcreatorFormUpdateInput) =>
    rustFetch<SabcreatorFormDoc>(`/v1/sabcreator/forms/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabcreator/forms/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
