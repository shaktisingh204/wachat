/**
 * Worksuite Company/Organization — type definitions.
 *
 * Ported from the Worksuite PHP/Laravel models:
 *   Company, CompanyAddress, Designation, GlobalSetting,
 *   CurrencyFormatSetting, Currency, LanguageSetting.
 *
 * SabNode already has `crm_departments` and `crm_designations`
 * (see `src/lib/definitions.ts`). The types here extend those with
 * parent-pointer hierarchy fields and introduce new collections for
 * company profile, multi-address, currency, language, and global
 * tenant settings — all tenant-isolated via `userId`.
 */

export type WsDateLike = string | Date;

/* ───────────────── Company Profile (singleton per tenant) ───────────────── */

export interface WsCompanyProfile {
  _id?: string;
  userId?: string;
  company_name: string;
  logo?: string;
  legal_name?: string;
  address?: string;
  city?: string;
  state?: string;
  country_id?: string;
  postal_code?: string;
  website?: string;
  email?: string;
  phone?: string;
  currency_code?: string;
  /** 1–12 (January = 1). Controls fiscal-year reports. */
  fiscal_year_start_month?: number;
  timezone?: string;
  language?: string;
  date_format?: string;
  time_format?: string;
  /** 0–6 where 0 = Sunday. */
  first_day_of_week?: number;
  invoice_prefix?: string;
  estimate_prefix?: string;
  proposal_prefix?: string;
  gst_number?: string;
  pan_number?: string;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Company Addresses (multi-row per tenant) ─────────────── */

export type WsCompanyAddressType =
  | 'office'
  | 'warehouse'
  | 'branch'
  | 'billing'
  | 'shipping';

export interface WsCompanyAddress {
  _id?: string;
  userId?: string;
  /** Self-reference: the `WsCompanyProfile._id` (always the tenant's singleton). */
  company_id?: string;
  type: WsCompanyAddressType;
  address: string;
  city?: string;
  state?: string;
  country_id?: string;
  postal_code?: string;
  is_default: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Extensions for existing crm_departments / crm_designations */

/**
 * Extension fields added to existing `crm_departments` docs via
 * `saveDepartmentExt` (upsert). Kept as a standalone shape so we don't
 * touch the base `CrmDepartment` in `src/lib/definitions.ts`.
 */
export interface WsDepartmentExt {
  _id?: string;
  userId?: string;
  name?: string;
  description?: string;
  parent_department_id?: string | null;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

export interface WsDesignationExt {
  _id?: string;
  userId?: string;
  name?: string;
  description?: string;
  parent_designation_id?: string | null;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/** Recursive node used by `getDepartmentTree` / `getDesignationTree`. */
export interface WsHierarchyNode {
  _id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  children: WsHierarchyNode[];
}

/* ───────────────── Currencies ───────────────── */

export type WsCurrencyPosition =
  | 'front'
  | 'back'
  | 'front-space'
  | 'back-space';

export interface WsCurrency {
  _id?: string;
  userId?: string;
  code: string;
  symbol?: string;
  name: string;
  exchange_rate?: number;
  is_cryptocurrency: boolean;
  usd_price?: number;
  decimal_separator?: string;
  thousand_separator?: string;
  decimal_digits?: number;
  currency_position: WsCurrencyPosition;
  default: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Language Settings ───────────────── */

export interface WsLanguageSetting {
  _id?: string;
  userId?: string;
  language_code: string;
  language_name: string;
  is_default: boolean;
  is_enabled: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}

/* ───────────────── Global Settings (singleton per tenant) ──────────────── */

export interface WsGlobalSetting {
  _id?: string;
  userId?: string;
  timezone?: string;
  /** References `WsCurrency._id`. */
  currency_id?: string;
  datepicker_format?: string;
  moment_format?: string;
  business_name?: string;
  strict_timezone: boolean;
  rtl: boolean;
  email_verified: boolean;
  createdAt?: WsDateLike;
  updatedAt?: WsDateLike;
}
