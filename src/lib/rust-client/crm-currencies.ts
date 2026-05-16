import 'server-only';

/**
 * CRM Currencies client — wraps `/v1/crm/currencies`.
 *
 * Currency master entity: ISO 4217 code + name + symbol + exchange rate
 * (vs the tenant's base currency) + display formatting + a single
 * per-tenant `isBase` flag.
 */
import { rustFetch } from './fetcher';

export type CrmCurrencyStatus = 'active' | 'archived';
export type CrmCurrencyDisplayFormat = 'prefix' | 'suffix';

export interface CrmCurrencyDoc {
  _id: string;
  userId?: string;
  /** 3-letter ISO 4217 alpha code, e.g. "INR", "USD". Uppercase. */
  code: string;
  /** Full display name, e.g. "Indian Rupee". */
  name: string;
  /** Currency symbol, e.g. "₹", "$". */
  symbol?: string;
  /** Number of fractional digits to display (typically 2; JPY uses 0). */
  decimalPlaces: number;
  /** Rate vs the tenant's base currency. `1.0` for the base itself. */
  exchangeRate: number;
  /** At most one currency per tenant should have `isBase = true`. */
  isBase: boolean;
  displayFormat?: CrmCurrencyDisplayFormat;
  thousandSeparator?: string;
  decimalSeparator?: string;
  isActive: boolean;
  /** ISO timestamp of the most recent `exchangeRate` write. */
  lastUpdated?: string;
  status: CrmCurrencyStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmCurrencyListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmCurrencyStatus | 'all' | 'active_visible';
  isBase?: boolean;
  isActive?: boolean;
}

export interface CrmCurrencyListResponse {
  items: CrmCurrencyDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmCurrencyCreateInput {
  /** Must be a 3-letter ISO 4217 alpha code. Server uppercases it. */
  code: string;
  name: string;
  symbol?: string;
  decimalPlaces?: number;
  exchangeRate?: number;
  isBase?: boolean;
  displayFormat?: CrmCurrencyDisplayFormat;
  thousandSeparator?: string;
  decimalSeparator?: string;
  isActive?: boolean;
}

export type CrmCurrencyUpdateInput = Partial<CrmCurrencyCreateInput> & {
  status?: CrmCurrencyStatus;
};

function buildListQuery(p?: CrmCurrencyListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.isBase != null) qs.set('isBase', String(p.isBase));
  if (p.isActive != null) qs.set('isActive', String(p.isActive));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmCurrenciesApi = {
  list: (params?: CrmCurrencyListParams) =>
    rustFetch<CrmCurrencyListResponse>(
      `/v1/crm/currencies${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmCurrencyDoc>(
      `/v1/crm/currencies/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmCurrencyCreateInput) =>
    rustFetch<{ id: string; entity: CrmCurrencyDoc }>(
      '/v1/crm/currencies',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmCurrencyUpdateInput) =>
    rustFetch<CrmCurrencyDoc>(
      `/v1/crm/currencies/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/currencies/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
