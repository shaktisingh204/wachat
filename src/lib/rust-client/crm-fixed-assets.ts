import 'server-only';

/**
 * CRM Fixed Asset client — wraps `/v1/crm/fixed-assets`.
 *
 * Counterpart of the Rust crate `crm-fixed-assets`. The Rust handlers
 * return the full `FixedAsset` document on every endpoint; this module
 * narrows the shape into a TS-friendly `CrmFixedAssetDoc` and provides
 * camelCase access for the UI layer.
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';

/* ─── Wire types — mirror crm_extras_types::FixedAsset ─────────── */

export interface CrmFixedAssetDoc {
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
  code: string;
  name: string;
  category?: string;
  purchaseDate: string;
  supplierId?: string;
  cost: number;
  currency: string;
  usefulLifeMonths: number;
  depreciationMethod: 'slm' | 'wdv' | 'units' | string;
  residualValue?: number;
  location?: string;
  custodianEmployeeId?: string;
  condition?: 'new' | 'good' | 'fair' | 'damaged' | 'retired' | string;
  warrantyUntil?: string;
  insuranceUntil?: string;
  amcContractId?: string;
  retireOrSell?: {
    at: string;
    mode: string;
    saleAmount?: number;
    buyer?: string;
    note?: string;
  } | null;
  accumulatedDepreciation?: number;
  netBookValue?: number;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmFixedAssetListParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  condition?: string;
  depreciationMethod?: string;
}

export interface CrmFixedAssetCreateInput {
  projectId?: string;
  code: string;
  name: string;
  purchaseDate: string;
  cost: number;
  currency: string;
  usefulLifeMonths: number;
  depreciationMethod: string;
  category?: string;
  supplierId?: string;
  residualValue?: number;
  location?: string;
  custodianEmployeeId?: string;
  condition?: string;
  warrantyUntil?: string;
  insuranceUntil?: string;
  amcContractId?: string;
}

export interface RetireSellEntryInput {
  at: string;
  mode: string;
  saleAmount?: number;
  buyer?: string;
  note?: string;
}

export type CrmFixedAssetUpdateInput = Partial<
  Omit<CrmFixedAssetCreateInput, 'projectId'>
> & {
  retireOrSell?: RetireSellEntryInput;
};

/* ─── Client ──────────────────────────────────────────────────── */

function buildListQuery(p?: CrmFixedAssetListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.category) qs.set('category', p.category);
  if (p.condition) qs.set('condition', p.condition);
  if (p.depreciationMethod) qs.set('depreciationMethod', p.depreciationMethod);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmFixedAssetsApi = {
  list: (params?: CrmFixedAssetListParams) =>
    rustFetch<CrmFixedAssetDoc[]>(`/v1/crm/fixed-assets${buildListQuery(params)}`),
  getById: (id: string) =>
    rustFetch<CrmFixedAssetDoc>(`/v1/crm/fixed-assets/${encodeURIComponent(id)}`),
  create: (input: CrmFixedAssetCreateInput) =>
    rustFetch<CrmFixedAssetDoc>('/v1/crm/fixed-assets', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: CrmFixedAssetUpdateInput) =>
    rustFetch<CrmFixedAssetDoc>(`/v1/crm/fixed-assets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `/v1/crm/fixed-assets/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
  depreciate: (id: string) =>
    rustFetch<CrmFixedAssetDoc>(`/v1/crm/fixed-assets/${encodeURIComponent(id)}/depreciate`, {
      method: 'POST',
    }),
};
