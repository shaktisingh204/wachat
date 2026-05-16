import 'server-only';

/**
 * CRM Company Profile client — wraps `/v1/crm/company-profile`.
 *
 * The Company Profile entity (W11) is the tenant company information master:
 * legal name, branding, addresses, tax IDs, banking, social links, locale
 * defaults, and brand color. One profile may be the tenant's default.
 */
import { rustFetch } from './fetcher';

export type CrmCompanyProfileStatus = 'active' | 'archived';

export type CrmCompanyProfileEmployeeBand =
  | '1-10'
  | '11-50'
  | '51-200'
  | '201-1000'
  | '1000+';

export interface CrmCompanyProfileAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  [key: string]: unknown;
}

export interface CrmCompanyProfileSocialLinks {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
  [key: string]: unknown;
}

export interface CrmCompanyProfileDoc {
  _id: string;
  userId?: string;
  legalName: string;
  displayName?: string;
  shortName?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  industry?: string;
  industryId?: string;
  foundedYear?: number;
  employeeCountBand?: CrmCompanyProfileEmployeeBand | string;
  website?: string;
  email?: string;
  phone?: string;
  fax?: string;
  registeredAddress?: CrmCompanyProfileAddress;
  billingAddress?: CrmCompanyProfileAddress;
  shippingAddress?: CrmCompanyProfileAddress;
  taxId?: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankSwift?: string;
  socialLinks?: CrmCompanyProfileSocialLinks;
  defaultCurrency?: string;
  defaultTimezone?: string;
  fiscalYearStartMonth?: number;
  brandColor?: string;
  isDefault: boolean;
  status: CrmCompanyProfileStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CrmCompanyProfileListParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmCompanyProfileStatus | 'all' | 'active_visible';
  industry?: string;
  isDefault?: boolean;
}

export interface CrmCompanyProfileListResponse {
  items: CrmCompanyProfileDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CrmCompanyProfileCreateInput {
  legalName: string;
  displayName?: string;
  shortName?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  faviconUrl?: string;
  industry?: string;
  industryId?: string;
  foundedYear?: number;
  employeeCountBand?: CrmCompanyProfileEmployeeBand | string;
  website?: string;
  email?: string;
  phone?: string;
  fax?: string;
  registeredAddress?: CrmCompanyProfileAddress;
  billingAddress?: CrmCompanyProfileAddress;
  shippingAddress?: CrmCompanyProfileAddress;
  taxId?: string;
  gstin?: string;
  pan?: string;
  cin?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankSwift?: string;
  socialLinks?: CrmCompanyProfileSocialLinks;
  defaultCurrency?: string;
  defaultTimezone?: string;
  fiscalYearStartMonth?: number;
  brandColor?: string;
  isDefault?: boolean;
}

export type CrmCompanyProfileUpdateInput = Partial<
  CrmCompanyProfileCreateInput
> & {
  status?: CrmCompanyProfileStatus;
};

function buildListQuery(p?: CrmCompanyProfileListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.q) qs.set('q', p.q);
  if (p.status) qs.set('status', p.status);
  if (p.industry) qs.set('industry', p.industry);
  if (p.isDefault != null) qs.set('isDefault', String(p.isDefault));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const crmCompanyProfileApi = {
  list: (params?: CrmCompanyProfileListParams) =>
    rustFetch<CrmCompanyProfileListResponse>(
      `/v1/crm/company-profile${buildListQuery(params)}`,
    ),
  getById: (id: string) =>
    rustFetch<CrmCompanyProfileDoc>(
      `/v1/crm/company-profile/${encodeURIComponent(id)}`,
    ),
  create: (input: CrmCompanyProfileCreateInput) =>
    rustFetch<{ id: string; entity: CrmCompanyProfileDoc }>(
      '/v1/crm/company-profile',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  update: (id: string, patch: CrmCompanyProfileUpdateInput) =>
    rustFetch<CrmCompanyProfileDoc>(
      `/v1/crm/company-profile/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/crm/company-profile/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
