/**
 * SabCRM Supply — vendor surface action types (rollout WI-7).
 *
 * Shared between `sabcrm-supply-vendors.actions.ts` ('use server'
 * modules may only export async functions) and the vendors client.
 * Mirrors the finance master-data convention
 * (`sabcrm-finance-payment-accounts.actions.types.ts`): full create /
 * update payloads, display-ready list rows + a KPI strip shape.
 *
 * Vendors are master data — the crate has NO status column, so the
 * list surface degrades to "All vendors" (no status select) per the
 * spec. Bank details + invoice flags + attachments are surfaced in a
 * bespoke drawer (DocForm is invoice-shaped and does not fit).
 */

import type { CrmVendorBankDetails } from '@/lib/rust-client/crm-vendors';

/* ─── Create / update (full drawer payloads) ──────────────────── */

/**
 * The full vendor-form payload — every user-meaningful field on
 * `CrmVendorDoc` (identity, contact, address, tax, banking, invoice
 * flags, attachments). `name` is the only required field.
 */
export interface SabcrmVendorFullInput {
  name: string;
  displayName?: string;
  industry?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  /* address */
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  /* tax */
  gstin?: string;
  pan?: string;
  panName?: string;
  vendorType?: string;
  taxTreatment?: string;
  subject?: string;
  /* banking */
  bankAccountDetails?: CrmVendorBankDetails;
  /* invoice flags */
  showEmailInInvoice?: boolean;
  showPhoneInInvoice?: boolean;
  /* SabFiles attachment ids */
  attachments?: string[];
}

/** Full-form patch — same shape, everything optional. */
export type SabcrmVendorFullPatch = Partial<SabcrmVendorFullInput>;

/* ─── List page / KPIs ────────────────────────────────────────── */

/** Filters the vendors list page sends to the fetcher. */
export interface SabcrmVendorListFilters {
  page?: number;
  limit?: number;
  q?: string;
  /** Inclusive `YYYY-MM-DD` bounds applied to the created date. */
  from?: string;
  to?: string;
}

/**
 * A display-ready vendor list row. Carries the full editable field set
 * so a row click opens the edit drawer with no second fetch (mirrors
 * the payment-accounts deep-link pattern).
 */
export interface SabcrmVendorListRow {
  id: string;
  name: string;
  displayName: string;
  industry: string;
  logoUrl: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  gstin: string;
  pan: string;
  panName: string;
  vendorType: string;
  taxTreatment: string;
  subject: string;
  bankAccountDetails: CrmVendorBankDetails | null;
  showEmailInInvoice: boolean;
  showPhoneInInvoice: boolean;
  attachments: string[];
  createdAt: string;
}

export interface SabcrmVendorListPage {
  rows: SabcrmVendorListRow[];
  page: number;
  hasMore: boolean;
}

/** KPI strip numbers (computed over a capped scan; see `sampled`). */
export interface SabcrmVendorKpis {
  /** Vendors scanned. */
  count: number;
  /** Vendors with a verified GSTIN on file. */
  withGstin: number;
  /** Vendors with bank account details captured. */
  withBankDetails: number;
  /** Distinct vendor-type buckets seen. */
  vendorTypeCount: number;
  /** True when the scan hit the cap (numbers are a floor, not exact). */
  sampled: boolean;
}
