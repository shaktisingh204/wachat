/**
 * SabCRM Commerce — Gift cards surface action types (spec WI-16).
 *
 * Master data: rows carry the full editable field set; edit mode
 * additionally exposes balance adjustment + status (crate
 * `UpdateGiftCardInput`).
 */

import type { CrmGiftCardStatus } from '@/lib/rust-client/crm-gift-cards';

export interface SabcrmGiftCardListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status: CrmGiftCardStatus | '';
}

export interface SabcrmGiftCardListRow {
  id: string;
  code: string;
  value: number;
  balance: number;
  issuedTo: string | null;
  issuedToEmail: string | null;
  expiryDate: string | null;
  transferable: boolean;
  status: CrmGiftCardStatus;
  notes: string | null;
  createdAt: string | null;
}

export interface SabcrmGiftCardListPage {
  rows: SabcrmGiftCardListRow[];
  page: number;
  hasMore: boolean;
}

export interface SabcrmGiftCardKpis {
  currency: string;
  count: number;
  activeCount: number;
  outstandingBalance: number;
  totalIssuedValue: number;
  sampled: boolean;
}

/** Full create payload (blank code ⇒ server-generated). */
export interface SabcrmGiftCardFullInput {
  code?: string;
  value: number;
  issuedTo?: string;
  issuedToEmail?: string;
  /** `YYYY-MM-DD`. */
  expiryDate?: string;
  transferable?: boolean;
  notes?: string;
}
