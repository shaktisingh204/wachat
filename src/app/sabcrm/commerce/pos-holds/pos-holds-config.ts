/**
 * SabCRM Commerce — POS hold surface config (client-safe).
 *
 * Status vocabulary + tones + happy-path flow, kit filter mapping, and
 * route helpers (spec WI-21). Mirrors `crm_pos::PosHoldStatus`
 * (`held|recalled|voided|archived`).
 */

import type { CrmPosHoldStatus } from '@/lib/rust-client/crm-pos';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmPosHoldListFilters } from '@/app/actions/sabcrm-commerce-pos-holds.actions.types';

export const POS_HOLD_STATUSES: (DocStatusDef & { value: CrmPosHoldStatus })[] = [
  { value: 'held', label: 'Held', tone: 'warning' },
  { value: 'recalled', label: 'Recalled', tone: 'success' },
  { value: 'voided', label: 'Voided', tone: 'neutral' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const POS_HOLD_FLOW: CrmPosHoldStatus[] = ['held', 'recalled'];

export function toPosHoldFilters(f: DocListFilters): SabcrmPosHoldListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmPosHoldStatus | '') || '',
  };
}

export const POS_HOLDS_PATH = '/sabcrm/commerce/pos-holds';

/** Recall navigates to the register prefilled with this hold. */
export function recallAtRegisterHref(holdId: string): string {
  return `/sabcrm/commerce/register?holdId=${encodeURIComponent(holdId)}`;
}
