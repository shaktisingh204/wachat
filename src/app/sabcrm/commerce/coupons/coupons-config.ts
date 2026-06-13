/**
 * SabCRM Commerce — coupon surface config (client-safe).
 *
 * Status vocabulary + tones + happy-path flow for the StatusFlow rail,
 * the kit `DocListFilters` → coupon action-filter mapping, and route
 * helpers. The `crm-coupons` wire is free-form, but the typed client
 * narrows to `draft|active|expired|archived` — that crate vocabulary is
 * authoritative client-side (spec WI-15 §4 risk #4).
 */

import type { CrmCouponStatus } from '@/lib/rust-client/crm-coupons';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmCouponListFilters } from '@/app/actions/sabcrm-commerce-coupons.actions.types';

export const COUPON_STATUSES: (DocStatusDef & { value: CrmCouponStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'expired', label: 'Expired', tone: 'warning' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail (exceptions render as a pill). */
export const COUPON_FLOW: CrmCouponStatus[] = ['draft', 'active'];

export const COUPON_TYPES: { value: 'percent' | 'fixed'; label: string }[] = [
  { value: 'percent', label: 'Percent off' },
  { value: 'fixed', label: 'Fixed amount off' },
];

/** Kit list filters → coupon action filters (status narrows safely — the
 *  toolbar's status values come from `COUPON_STATUSES`). */
export function toCouponFilters(f: DocListFilters): SabcrmCouponListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmCouponStatus | '') || '',
  };
}

export const COUPONS_PATH = '/sabcrm/commerce/coupons';
