import 'server-only';

/**
 * CRM Lead client — wraps `/v1/crm/leads`.
 *
 * Counterpart of the Rust crate `crm-leads`. The Rust handlers return
 * the full `Lead` document on every endpoint; this module narrows the
 * shape into a TS-friendly `CrmLeadDoc` and provides camelCase access
 * for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_sales_crm_types::Lead ───────────── */

export interface CrmLeadDoc {
  _id: string;
  identity?: {
    id?: string;
    projectId?: string;
    userId?: string;
    tenantId?: string;
  };
  audit?: {
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    updatedBy?: string;
  };
  attribution?: {
    source?: string;
    medium?: string;
    campaign?: string;
    referrerUrl?: string;
  };
  assignment?: {
    assignedTo?: string;
    assignedBy?: string;
    assignedAt?: string;
  };
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  subSource?: string;
  status?: { name: string; changedAt?: string };
  leadScore?: number;
  ownerId?: string;
  estimatedValue?: number;
  currency?: string;
  probabilityPct?: number;
  expectedClose?: string;
  industry?: string;
  customFields?: Record<string, unknown>;
  tags?: string[];
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmLeadListParams {
  page?: number;
  limit?: number;
  q?: string;
}

export interface CrmLeadCreateInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  source?: string;
  subSource?: string;
  status?: string;
  leadScore?: number;
  ownerId?: string;
  assignedTo?: string;
  estimatedValue?: number;
  currency?: string;
  probabilityPct?: number;
  expectedClose?: string;
  industry?: string;
  projectId?: string;
}

export type CrmLeadUpdateInput = Partial<Omit<CrmLeadCreateInput, 'projectId'>>;

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmLeadListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmLeadsApi = {
  list: (params?: CrmLeadListParams) =>
    rustFetch<CrmLeadDoc[]>(`/v1/crm/leads${buildListQuery(params)}`),
  getById: (id: string) => rustFetch<CrmLeadDoc>(`/v1/crm/leads/${encodeURIComponent(id)}`),
  create: (input: CrmLeadCreateInput) =>
    rustFetch<CrmLeadDoc>('/v1/crm/leads', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmLeadUpdateInput) =>
    rustFetch<CrmLeadDoc>(`/v1/crm/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(`/v1/crm/leads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
