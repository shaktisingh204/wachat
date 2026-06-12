/**
 * SabCRM Finance — quotation-surface action types.
 *
 * Shared between `sabcrm-finance-quotations.actions.ts` ('use server'
 * modules may only export async functions) and the quotation clients.
 * Mirrors the `sabcrm-finance-invoices.actions.types.ts` convention.
 */

import type {
  CrmQuotationAddress,
  CrmQuotationStatus,
} from '@/lib/rust-client/crm-quotations';
import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type {
  SabcrmDocAttachmentInput,
  SabcrmPartyObjectSlug,
} from './sabcrm-finance-invoices.actions.types';

/* ─── Status workflow ─────────────────────────────────────────── */

/**
 * Allowed manual transitions per current status (`converted` is set by
 * the convert actions, never by hand — mirrors the finance-rollout
 * spec §3.1).
 */
export const SABCRM_QUOTATION_TRANSITIONS: Record<
  CrmQuotationStatus,
  CrmQuotationStatus[]
> = {
  draft: ['sent'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: [],
  rejected: ['draft'],
  expired: ['sent'],
  converted: [],
};

/* ─── Create / update (full form payloads) ────────────────────── */

/**
 * The full quotation-form payload. Totals are NOT part of the input —
 * the action recomputes them from `lines` + `totalsModifiers` via the
 * shared doc math, so the client can never save inconsistent money.
 */
export interface SabcrmQuotationFullInput {
  quotationNo: string;
  /** REAL picked party (records-engine record id). Required. */
  clientId: string;
  currency: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `YYYY-MM-DD` — the kit's due-date slot ("Valid until"). */
  validUntil: string;
  lines: DocLineInput[];
  /** Header modifiers folded into the recomputed wire `totals`. */
  totalsModifiers?: DocTotalsModifiersInput;
  /** Short headline above the items table. */
  subject?: string;
  /** Free-form customer/internal reference number. */
  referenceNo?: string;
  /** FX rate vs the tenant base currency — finite, > 0. */
  exchangeRate?: number;
  /** Place of supply — free-text state name (legacy convention). */
  placeOfSupply?: string;
  customerNotes?: string;
  termsAndConditions?: string;
  attachments?: SabcrmDocAttachmentInput[];
  /** Save-and-send ⇒ the quotation is created with status `sent`. */
  issue?: boolean;
  /** Optional lineage parent (deal/lead → quotation). */
  fromKind?: 'lead' | 'deal';
  fromId?: string;
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmQuotationFullPatch = Partial<
  Omit<SabcrmQuotationFullInput, 'issue' | 'fromKind' | 'fromId'>
>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the list page sends to the fetcher. */
export interface SabcrmQuotationListFilters {
  page?: number;
  limit?: number;
  q?: string;
  status?: CrmQuotationStatus | '';
  clientId?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the quotation date. */
  from?: string;
  to?: string;
}

/** A display-ready list row (party already resolved to a label). */
export interface SabcrmQuotationListRow {
  id: string;
  quotationNo: string;
  subject: string | null;
  referenceNo: string | null;
  partyId: string;
  /** Resolved customer label, or null when the record no longer exists. */
  partyLabel: string | null;
  partyObjectSlug: SabcrmPartyObjectSlug | null;
  date: string;
  validUntil: string;
  currency: string;
  total: number;
  status: CrmQuotationStatus;
}

export interface SabcrmQuotationListPage {
  rows: SabcrmQuotationListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmQuotationKpis {
  /** Dominant currency among scanned quotations (formats the strip). */
  currency: string;
  /** Σ totals.total over open (draft + sent) quotations. */
  openValue: number;
  openCount: number;
  /** (accepted + converted) ÷ resolved, 0–100; null when unresolved. */
  acceptanceRatePct: number | null;
  /** Open quotations whose validity ends within the next 7 days. */
  expiringSoonCount: number;
  /** Quotations converted with a date in the current month. */
  convertedThisMonth: number;
  /** Quotations scanned. */
  count: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}

/* ─── Detail ──────────────────────────────────────────────────── */

/** Display lines for a stored Address (paper / rail cards). */
export function quotationAddressLines(
  addr: CrmQuotationAddress | undefined,
): string[] {
  if (!addr) return [];
  const cityLine = [addr.city, addr.state, addr.pincode]
    .filter(Boolean)
    .join(', ');
  return [addr.label, addr.line1, addr.line2, cityLine, addr.country].filter(
    (s): s is string => !!s && s.trim() !== '',
  );
}

/** Result payload of the convert actions (route target for the toast). */
export interface SabcrmQuotationConvertResult {
  /** Id of the freshly created document. */
  id: string;
  /** Display number of the created document. */
  number: string;
  /** Route of the created document's surface. */
  href: string;
}
