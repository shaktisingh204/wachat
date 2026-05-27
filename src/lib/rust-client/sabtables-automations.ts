import 'server-only';

/**
 * SabTables Automations client — wraps `/v1/sabtables/automations`.
 * Mirrors `rust/crates/sabtables-automations/src/types.rs`.
 */
import { rustFetch } from './fetcher';

export type SabtablesTriggerKind =
  | 'record_created'
  | 'record_updated'
  | 'cron'
  | 'webhook';

export interface SabtablesAutomationTrigger {
  kind: SabtablesTriggerKind;
  config?: Record<string, unknown>;
}

export interface SabtablesAutomationAction {
  id: string;
  kind: string;
  config?: Record<string, unknown>;
}

export interface SabtablesAutomationDoc {
  _id: string;
  userId: string;
  tableId: string;
  name: string;
  trigger: SabtablesAutomationTrigger;
  actions: SabtablesAutomationAction[];
  isEnabled: boolean;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface SabtablesAutomationListParams {
  tableId?: string;
  status?: 'active' | 'archived' | 'all';
}

export interface SabtablesAutomationListResponse {
  items: SabtablesAutomationDoc[];
}

export interface SabtablesAutomationCreateInput {
  tableId: string;
  name: string;
  trigger: SabtablesAutomationTrigger;
  actions?: SabtablesAutomationAction[];
  isEnabled?: boolean;
}

export interface SabtablesAutomationUpdateInput {
  name?: string;
  trigger?: SabtablesAutomationTrigger;
  actions?: SabtablesAutomationAction[];
  isEnabled?: boolean;
  status?: 'active' | 'archived';
}

export interface RunAutomationInput {
  recordId?: string;
}

export interface RunAutomationResponse {
  runId: string;
  stepsExecuted: number;
  status: string;
}

function buildQuery(p?: SabtablesAutomationListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.tableId) qs.set('tableId', p.tableId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabtablesAutomationsApi = {
  list: (params?: SabtablesAutomationListParams) =>
    rustFetch<SabtablesAutomationListResponse>(
      `/v1/sabtables/automations${buildQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabtablesAutomationDoc>(`/v1/sabtables/automations/${encodeURIComponent(id)}`),
  create: (input: SabtablesAutomationCreateInput) =>
    rustFetch<{ id: string; entity: SabtablesAutomationDoc }>('/v1/sabtables/automations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabtablesAutomationUpdateInput) =>
    rustFetch<SabtablesAutomationDoc>(`/v1/sabtables/automations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabtables/automations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  run: (id: string, input: RunAutomationInput = {}) =>
    rustFetch<RunAutomationResponse>(
      `/v1/sabtables/automations/${encodeURIComponent(id)}/run`,
      { method: 'POST', body: JSON.stringify(input) },
    ),
};
