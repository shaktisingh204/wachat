import 'server-only';

/**
 * CRM Subscription client — wraps `/v1/crm/subscriptions`.
 *
 * Counterpart of the Rust crate `crm-subscriptions`. The Rust handlers
 * return the canonical `Subscription` document (from
 * `crm_extras_types::subscription::Subscription`) on every endpoint;
 * this module narrows the shape into a TS-friendly `CrmSubscriptionDoc`
 * and exposes camelCase access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Enums (wire-format strings) ─────────────────────────────── */

export type CrmSubBillingFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'custom';

export type CrmSubRenewalMode = 'auto' | 'manual';

export type CrmSubStatus =
  | 'trial'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'expired';

/* ─── Sub-documents ───────────────────────────────────────────── */

export interface CrmSubscriptionItem {
  itemId: string;
  qty: number;
  rate: number;
  currency: string;
}

export interface CrmSubscriptionDunningStep {
  dayOffset: number;
  action: string;
  templateId?: string;
}

export interface CrmSubscriptionEvent {
  at: string;
  kind: string;
  by?: string;
  note?: string;
}

/* ─── Wire types — mirror crm_extras_types::Subscription ──────── */

export interface CrmSubscriptionDoc {
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
  planId?: string | null;
  customerId: string;
  frequency: CrmSubBillingFrequency;
  trialUntil?: string;
  renewalMode: CrmSubRenewalMode;
  items: CrmSubscriptionItem[];
  prorationEnabled?: boolean;
  dunningLadder?: CrmSubscriptionDunningStep[];
  status: CrmSubStatus;
  startedAt: string;
  nextBillingAt?: string;
  pausedUntil?: string;
  cancelledAt?: string;
  history?: CrmSubscriptionEvent[];
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/* ─── Request / list types ────────────────────────────────────── */

export interface CrmSubscriptionListParams {
  page?: number;
  limit?: number;
  q?: string;
  customerId?: string;
  status?: CrmSubStatus;
}

export interface CrmSubscriptionCreateInput {
  projectId?: string;
  customerId: string;
  planId?: string;
  frequency: CrmSubBillingFrequency;
  startedAt: string;
  renewalMode: CrmSubRenewalMode;
  trialUntil?: string;
  nextBillingAt?: string;
  items: CrmSubscriptionItem[];
  prorationEnabled?: boolean;
  dunningLadder?: CrmSubscriptionDunningStep[];
}

export type CrmSubscriptionUpdateInput = Partial<
  Omit<CrmSubscriptionCreateInput, 'projectId' | 'customerId' | 'startedAt'>
>;

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmSubscriptionListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.customerId) qs.set('customerId', p.customerId);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmSubscriptionsApi = {
  list: (params?: CrmSubscriptionListParams) =>
    rustFetch<CrmSubscriptionDoc[]>(`/v1/crm/subscriptions${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmSubscriptionDoc>(`/v1/crm/subscriptions/${encodeURIComponent(id)}`),
  create: (input: CrmSubscriptionCreateInput) =>
    rustFetch<CrmSubscriptionDoc>('/v1/crm/subscriptions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmSubscriptionUpdateInput) =>
    rustFetch<CrmSubscriptionDoc>(`/v1/crm/subscriptions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/subscriptions/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
