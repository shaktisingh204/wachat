/**
 * SabCRM Commerce — POS refund surface config (client-safe).
 *
 * Status vocabulary + tones (spec WI-20). The wire is free-form —
 * `SABCRM_POS_REFUND_FLOW` / `SABCRM_POS_REFUND_TRANSITIONS` (shared
 * docs types) are the only guard.
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  SABCRM_POS_REFUND_FLOW,
  type SabcrmPosRefundUiStatus,
} from '@/app/actions/sabcrm-commerce-docs.actions.types';
import type { SabcrmPosRefundListFilters } from '@/app/actions/sabcrm-commerce-pos-refunds.actions.types';

export const POS_REFUND_STATUSES: (DocStatusDef & {
  value: SabcrmPosRefundUiStatus;
})[] = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'completed', label: 'Completed', tone: 'success' },
  { value: 'failed', label: 'Failed', tone: 'danger' },
];

/** Happy path for the StatusFlow rail. */
export const POS_REFUND_FLOW: string[] = [...SABCRM_POS_REFUND_FLOW];

export function toPosRefundFilters(
  f: DocListFilters,
): SabcrmPosRefundListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmPosRefundUiStatus | '') || '',
  };
}

export const POS_REFUNDS_PATH = '/sabcrm/commerce/pos-refunds';

export function posRefundDetailHref(id: string): string {
  return `${POS_REFUNDS_PATH}/${encodeURIComponent(id)}`;
}
