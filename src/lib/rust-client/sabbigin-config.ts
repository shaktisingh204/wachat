import 'server-only';

/**
 * SabBigin config client — wraps `/v1/sabbigin/config`.
 *
 * Per-tenant settings for the SabBigin (lite CRM SKU) experience. SabBigin
 * reuses the existing CRM entity collections (`crm_contacts`, `crm_deals`,
 * `crm_pipelines`, …) under a focused, micro-business UI mounted at
 * `/dashboard/sabbigin/`. The only SabBigin-owned document is this config
 * row.
 */
import { rustFetch, RustApiError } from './fetcher';

export type SabbiginConfigStatus = 'active' | 'archived';

export type SabbiginFeatureFlag =
  | 'contacts'
  | 'companies'
  | 'deals'
  | 'products'
  | 'tasks'
  | 'events'
  | 'calls'
  | 'emails'
  | 'dashboard'
  | 'forms'
  | 'bookings'
  | 'workflows'
  | 'emailIn'
  | 'fileCabinet'
  | 'api';

export interface SabbiginPublicBranding {
  logoUrl?: string | null;
  accentColor?: string | null;
  companyName?: string | null;
}

export interface SabbiginOnboardingState {
  createdPipeline?: boolean;
  importedContacts?: boolean;
  createdDeal?: boolean;
  connectedEmail?: boolean;
  dismissed?: boolean;
}

export interface SabbiginConfigDoc {
  _id: string;
  userId?: string;
  enabled: boolean;
  /** Hex `ObjectId` of the pipeline the deals board defaults to. */
  pipelineId?: string | null;
  /** `0` = no admin override; effective cap derived from the plan tier. */
  pipelineLimit: number;
  allowedFeatures: (SabbiginFeatureFlag | string)[];
  defaultCurrency?: string | null;
  multiCurrency?: boolean;
  emailInEnabled?: boolean;
  publicBranding?: SabbiginPublicBranding | null;
  onboarding?: SabbiginOnboardingState | null;
  status: SabbiginConfigStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SabbiginConfigListParams {
  page?: number;
  limit?: number;
  status?: SabbiginConfigStatus | 'all';
}

export interface SabbiginConfigListResponse {
  items: SabbiginConfigDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SabbiginConfigCreateInput {
  enabled?: boolean;
  pipelineId?: string;
  pipelineLimit?: number;
  allowedFeatures?: (SabbiginFeatureFlag | string)[];
  defaultCurrency?: string;
  multiCurrency?: boolean;
  emailInEnabled?: boolean;
}

export type SabbiginConfigUpdateInput = Partial<SabbiginConfigCreateInput> & {
  publicBranding?: SabbiginPublicBranding;
  onboarding?: SabbiginOnboardingState;
  status?: SabbiginConfigStatus;
};

function buildListQuery(p?: SabbiginConfigListParams): string {
  if (!p) return '';
  const qs = new URLSearchParams();
  if (p.page != null) qs.set('page', String(p.page));
  if (p.limit != null) qs.set('limit', String(p.limit));
  if (p.status) qs.set('status', p.status);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const sabbiginConfigApi = {
  list: (params?: SabbiginConfigListParams) =>
    rustFetch<SabbiginConfigListResponse>(
      `/v1/sabbigin/config${buildListQuery(params)}`,
    ),
  /**
   * Convenience: returns the tenant's current active config (most-recent
   * non-archived row), or `null` if none exists yet.
   */
  current: async (): Promise<SabbiginConfigDoc | null> => {
    try {
      return await rustFetch<SabbiginConfigDoc>('/v1/sabbigin/config/current');
    } catch (e) {
      if (e instanceof RustApiError && e.status === 404) return null;
      throw e;
    }
  },
  getById: (id: string) =>
    rustFetch<SabbiginConfigDoc>(
      `/v1/sabbigin/config/${encodeURIComponent(id)}`,
    ),
  create: (input: SabbiginConfigCreateInput) =>
    rustFetch<{ id: string; entity: SabbiginConfigDoc }>('/v1/sabbigin/config', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  update: (id: string, patch: SabbiginConfigUpdateInput) =>
    rustFetch<SabbiginConfigDoc>(
      `/v1/sabbigin/config/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (id: string) =>
    rustFetch<{ deleted: boolean }>(
      `/v1/sabbigin/config/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    ),
};
