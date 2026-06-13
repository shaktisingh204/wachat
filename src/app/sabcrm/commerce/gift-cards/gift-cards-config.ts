/**
 * SabCRM Commerce — gift-card surface config (client-safe).
 *
 * Status vocabulary + tones + happy-path flow, kit filter mapping, and
 * route helpers. Mirrors `crm_gift_cards::GiftCardStatus`
 * (`active|redeemed|expired|archived`).
 */

import type { CrmGiftCardStatus } from '@/lib/rust-client/crm-gift-cards';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmGiftCardListFilters } from '@/app/actions/sabcrm-commerce-gift-cards.actions.types';

export const GIFT_CARD_STATUSES: (DocStatusDef & {
  value: CrmGiftCardStatus;
})[] = [
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'redeemed', label: 'Redeemed', tone: 'neutral' },
  { value: 'expired', label: 'Expired', tone: 'warning' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const GIFT_CARD_FLOW: CrmGiftCardStatus[] = ['active', 'redeemed'];

export function toGiftCardFilters(f: DocListFilters): SabcrmGiftCardListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmGiftCardStatus | '') || '',
  };
}

export const GIFT_CARDS_PATH = '/sabcrm/commerce/gift-cards';
