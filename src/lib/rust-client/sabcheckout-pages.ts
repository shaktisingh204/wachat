import 'server-only';

/**
 * SabCheckout Pages client — wraps `/v1/sabcheckout/pages`.
 *
 * Counterpart of the Rust crate `sabcheckout-pages`. CRUD over branded
 * payment pages (admin-only). Also exposes the public lookup helper
 * `publicGetBySlug` used by the unauthenticated `/pay/[pageSlug]` route.
 */
import { rustFetch } from './fetcher';

export type SabcheckoutPageStatus = 'draft' | 'live' | 'paused';
export type SabcheckoutPageMode = 'one_off' | 'recurring' | 'both';
export type SabcheckoutItemType = 'amount' | 'plan';

export interface SabcheckoutCheckoutItem {
  type: SabcheckoutItemType;
  label: string;
  amountMinor?: number;
  planId?: string;
  allowQuantity?: boolean;
}

export interface SabcheckoutRequiredField {
  name: string;
  label: string;
  custom?: boolean;
  required?: boolean;
}

export interface SabcheckoutPageDoc {
  _id: string;
  userId: string;
  slug: string;
  displayName: string;
  headline?: string;
  description?: string;
  themeJson?: Record<string, unknown>;
  logoFileId?: string;
  currency: string;
  status: SabcheckoutPageStatus;
  mode: SabcheckoutPageMode;
  items?: SabcheckoutCheckoutItem[];
  requireFields?: SabcheckoutRequiredField[];
  successUrl?: string;
  cancelUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabcheckoutPageListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: SabcheckoutPageStatus | 'all';
}

export interface SabcheckoutPageListResponse {
  items: SabcheckoutPageDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabcheckoutPageCreateInput {
  slug: string;
  displayName: string;
  headline?: string;
  description?: string;
  themeJson?: Record<string, unknown>;
  logoFileId?: string;
  currency?: string;
  status?: SabcheckoutPageStatus;
  mode?: SabcheckoutPageMode;
  items?: SabcheckoutCheckoutItem[];
  requireFields?: SabcheckoutRequiredField[];
  successUrl?: string;
  cancelUrl?: string;
}

export type SabcheckoutPageUpdateInput = Partial<SabcheckoutPageCreateInput>;

export interface SabcheckoutPagePublicView {
  id: string;
  userId: string;
  page: SabcheckoutPageDoc;
}

function buildListQuery(p?: SabcheckoutPageListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabcheckoutPagesApi = {
  list: (params?: SabcheckoutPageListParams) =>
    rustFetch<SabcheckoutPageListResponse>(
      `/v1/sabcheckout/pages${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<SabcheckoutPageDoc>(
      `/v1/sabcheckout/pages/${encodeURIComponent(id)}`,
    ),
  create: (input: SabcheckoutPageCreateInput) =>
    rustFetch<{ id: string; entity: SabcheckoutPageDoc }>(
      '/v1/sabcheckout/pages',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: SabcheckoutPageUpdateInput) =>
    rustFetch<SabcheckoutPageDoc>(
      `/v1/sabcheckout/pages/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabcheckout/pages/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  /**
   * Public — unauthenticated lookup by slug. The Rust handler only
   * returns pages whose status is `live`.
   */
  publicGetBySlug: (slug: string) =>
    rustFetch<SabcheckoutPagePublicView>(
      `/v1/sabcheckout/pages/public/by-slug/${encodeURIComponent(slug)}`,
    ),
};
