import 'server-only';

/**
 * SabShop Tax Rule client — wraps `/v1/sabshop/tax-rules`.
 */
import { rustFetch } from './fetcher';

export interface SabshopTaxRuleDoc {
  _id: string;
  userId?: string;
  storefrontId: string;
  name: string;
  region: string;
  rate: number;
  inclusive?: boolean;
  productCategoryIds?: string[];
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabshopTaxRuleListResponse {
  items: SabshopTaxRuleDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabshopTaxRuleCreateInput {
  storefrontId: string;
  name: string;
  region: string;
  rate: number;
  inclusive?: boolean;
  productCategoryIds?: string[];
  active?: boolean;
}

export type SabshopTaxRuleUpdateInput = Partial<Omit<SabshopTaxRuleCreateInput, 'storefrontId'>>;

export const sabshopTaxRulesApi = {
  list: (params?: { page?: number; limit?: number; storefrontId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.storefrontId) qs.set('storefrontId', params.storefrontId);
    const s = qs.toString();
    return rustFetch<SabshopTaxRuleListResponse>(
      `/v1/sabshop/tax-rules${s ? `?${s}` : ''}`,
    );
  },
  getById: (id: string) =>
    rustFetch<SabshopTaxRuleDoc>(`/v1/sabshop/tax-rules/${encodeURIComponent(id)}`),
  create: (input: SabshopTaxRuleCreateInput) =>
    rustFetch<{ id: string; entity: SabshopTaxRuleDoc }>(`/v1/sabshop/tax-rules`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabshopTaxRuleUpdateInput) =>
    rustFetch<SabshopTaxRuleDoc>(`/v1/sabshop/tax-rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(`/v1/sabshop/tax-rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
