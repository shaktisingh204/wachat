import 'server-only';

/**
 * CRM Ticket client — wraps `/v1/crm/tickets`.
 *
 * Counterpart of the Rust crate `crm-tickets`. The Rust handlers return
 * the full `Ticket` document on every endpoint; this module narrows the
 * shape into a TS-friendly `CrmTicketDoc` and provides camelCase access
 * for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_extras_types::Ticket ────────────── */

export interface CrmTicketDoc {
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
  assignment?: {
    assignedTo?: string;
    assignedBy?: string;
    assignedAt?: string;
  };
  subject: string;
  requesterId: string;
  channel?: string;
  productId?: string;
  category?: string;
  priority?: string;
  severity?: string;
  dueBy?: string;
  slaId?: string;
  assigneeId?: string;
  status?: string;
  satisfactionRating?: number;
  internalNotes?: unknown[];
  attachments?: unknown[];
  linkedDealId?: string;
  linkedInvoiceId?: string;
  parentTicketId?: string;
  childTicketIds?: string[];
  mergeLog?: unknown[];
  customFields?: Record<string, unknown>;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmTicketListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  severity?: string;
  assigneeId?: string;
  requesterId?: string;
}

export interface CrmTicketCreateInput {
  subject: string;
  requesterId: string;
  channel: string;
  severity: string;
  productId?: string;
  category?: string;
  priority?: string;
  dueBy?: string;
  assigneeId?: string;
  status?: string;
  linkedDealId?: string;
  linkedInvoiceId?: string;
  parentTicketId?: string;
  internalNotes?: unknown;
  attachments?: unknown;
  projectId?: string;
}

export type CrmTicketUpdateInput = Partial<Omit<CrmTicketCreateInput, 'projectId'>>;

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmTicketListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.severity) qs.set('severity', p.severity);
  if (p.assigneeId) qs.set('assigneeId', p.assigneeId);
  if (p.requesterId) qs.set('requesterId', p.requesterId);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmTicketsApi = {
  list: (params?: CrmTicketListParams) =>
    rustFetch<CrmTicketDoc[]>(`/v1/crm/tickets${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmTicketDoc>(`/v1/crm/tickets/${encodeURIComponent(id)}`),
  create: (input: CrmTicketCreateInput) =>
    rustFetch<CrmTicketDoc>('/v1/crm/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmTicketUpdateInput) =>
    rustFetch<CrmTicketDoc>(`/v1/crm/tickets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(`/v1/crm/tickets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
