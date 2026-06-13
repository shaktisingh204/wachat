/**
 * SabCRM Commerce — Storefronts surface action types (spec WI-14).
 *
 * Master data: rows carry the FULL editable field set (homepage blocks
 * included) so the edit dialog seeds without a second fetch — the
 * payment-accounts convention.
 */

import type {
  CrmStoreHomepageBlock,
  CrmStorefrontStatus,
} from '@/lib/rust-client/crm-store';

export interface SabcrmStorefrontListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status: CrmStorefrontStatus | '';
}

/** Display-ready row + full editable fields. */
export interface SabcrmStorefrontListRow {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  currency: string;
  themeId: string | null;
  logoUrl: string | null;
  homepageBlocks: CrmStoreHomepageBlock[];
  blocksCount: number;
  status: CrmStorefrontStatus;
  createdAt: string;
}

export interface SabcrmStorefrontListPage {
  rows: SabcrmStorefrontListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmStorefrontKpis {
  count: number;
  publishedCount: number;
  draftCount: number;
  archivedCount: number;
  sampled: boolean;
}

/** Full create payload (supersedes the minimal dialog input). */
export interface SabcrmStorefrontFullInput {
  name: string;
  slug: string;
  domain?: string;
  currency?: string;
  themeId?: string;
  /** SabFiles-sourced URL (never a free-text paste — repo policy). */
  logoUrl?: string;
  homepageBlocks?: CrmStoreHomepageBlock[];
}
