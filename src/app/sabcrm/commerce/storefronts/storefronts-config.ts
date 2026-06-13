/**
 * SabCRM Commerce — storefront surface config (client-safe).
 *
 * Status vocabulary + tones + happy-path flow, kit filter mapping, and
 * route helpers. Mirrors `crm_store::StorefrontStatus`
 * (`draft|published|archived`).
 */

import type { CrmStorefrontStatus } from '@/lib/rust-client/crm-store';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmStorefrontListFilters } from '@/app/actions/sabcrm-commerce-storefronts.actions.types';

export const STOREFRONT_STATUSES: (DocStatusDef & {
  value: CrmStorefrontStatus;
})[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'published', label: 'Published', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const STOREFRONT_FLOW: CrmStorefrontStatus[] = ['draft', 'published'];

/** Homepage block kinds the v1 drawer offers (crate stores free-form). */
export const STOREFRONT_BLOCK_KINDS: { value: string; label: string }[] = [
  { value: 'hero', label: 'Hero' },
  { value: 'featured', label: 'Featured products' },
  { value: 'categories', label: 'Categories' },
  { value: 'banner', label: 'Banner' },
  { value: 'custom', label: 'Custom' },
];

export function toStorefrontFilters(
  f: DocListFilters,
): SabcrmStorefrontListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmStorefrontStatus | '') || '',
  };
}

export const STOREFRONTS_PATH = '/sabcrm/commerce/storefronts';

/** Slugify a storefront name for the auto-slug helper. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
