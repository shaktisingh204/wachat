/**
 * SabCRM People — Payroll Settings action types (client-safe).
 *
 * Shared vocabulary between
 * `sabcrm-people-payroll-settings.actions.ts` and the
 * `/sabcrm/people/settings` surface (singleton-per-project, WI-14).
 * No server imports.
 */

import type {
  CrmPayrollSettingDoc,
  CrmPayrollSettingPayCycle,
  CrmPayrollSettingStatus,
  CrmPayrollSettingTaxSlab,
} from '@/lib/rust-client/crm-payroll-settings';

export type {
  CrmPayrollSettingDoc,
  CrmPayrollSettingPayCycle,
  CrmPayrollSettingStatus,
  CrmPayrollSettingTaxSlab,
};

export const PAY_CYCLES: {
  value: CrmPayrollSettingPayCycle;
  label: string;
}[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
];

export const PAYROLL_SETTING_STATUSES: {
  value: CrmPayrollSettingStatus;
  label: string;
}[] = [
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

/** Full form field set (WI-14 / WI-35). */
export interface SabcrmPayrollSettingsInput {
  companyName?: string;
  /** Employee PF deduction rate (percent). */
  pfRate?: number;
  /** Employee ESI deduction rate (percent). */
  esiRate?: number;
  payCycle: CrmPayrollSettingPayCycle;
  taxSlabs: CrmPayrollSettingTaxSlab[];
  defaultCurrency?: string;
  status: CrmPayrollSettingStatus;
}
