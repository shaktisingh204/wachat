/**
 * SabCRM Finance — TDS surface config (client-safe).
 *
 * The TDS-record entity's doc-surface vocabulary: status defs + tones,
 * the happy-path flow, recent-FY options and the kit-filters →
 * action-filters mapper. Mirrors `crm-tds::CrmTdsRecord` exactly
 * (spec §3.19).
 */

import type { CrmTdsQuarter, CrmTdsStatus } from '@/lib/rust-client/crm-tds';
import type {
  DocListFilters,
  DocStatusDef,
} from '../_components/doc-surface/types';
import type { SabcrmTdsListFilters } from '@/app/actions/sabcrm-finance-tds.actions.types';

export const TDS_STATUSES: (DocStatusDef & { value: CrmTdsStatus })[] = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'deposited', label: 'Deposited', tone: 'info' },
  { value: 'filed', label: 'Filed', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

/** Happy path for the StatusFlow rail. */
export const TDS_FLOW: CrmTdsStatus[] = ['pending', 'deposited', 'filed'];

/**
 * Recent financial years for the FY Select (current + 5 back, Indian
 * Apr–Mar convention).
 */
export function recentFinancialYears(count = 6, now = new Date()): string[] {
  const month = now.getMonth() + 1;
  const startYear = month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => {
    const y = startYear - i;
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  });
}

/**
 * Kit list filters → TDS action filters. The kit's party slot is the
 * DEDUCTEE (people record) filter; FY + quarter ride along from the
 * toolbar's custom Selects (held outside the kit, read via a ref).
 */
export function toTdsFilters(
  f: DocListFilters,
  extra: { financialYear: string; quarter: CrmTdsQuarter | '' },
): SabcrmTdsListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmTdsStatus | '') || '',
    financialYear: extra.financialYear || undefined,
    quarter: extra.quarter || '',
    employeeId: f.partyId || undefined,
    from: f.from,
    to: f.to,
  };
}

export const TDS_PATH = '/sabcrm/finance/tds';
