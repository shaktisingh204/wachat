/**
 * SabCRM Commerce — POS session surface config (client-safe).
 *
 * Status vocabulary + tones + happy-path flow for the StatusFlow rail
 * on the cash-summary detail, kit filter mapping, and route helpers.
 * Mirrors `crm_pos::PosSessionStatus`
 * (`open|closed|reconciled|archived`).
 */

import type { CrmPosSessionStatus } from '@/lib/rust-client/crm-pos';
import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmPosSessionListFilters } from '@/app/actions/sabcrm-commerce-pos-sessions.actions.types';

export const POS_SESSION_STATUSES: (DocStatusDef & {
  value: CrmPosSessionStatus;
})[] = [
  { value: 'open', label: 'Open', tone: 'info' },
  { value: 'closed', label: 'Closed', tone: 'warning' },
  { value: 'reconciled', label: 'Reconciled', tone: 'success' },
  { value: 'archived', label: 'Archived', tone: 'neutral' },
];

export const POS_SESSION_FLOW: CrmPosSessionStatus[] = [
  'open',
  'closed',
  'reconciled',
];

export function toPosSessionFilters(
  f: DocListFilters,
): SabcrmPosSessionListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as CrmPosSessionStatus | '') || '',
  };
}

export const POS_SESSIONS_PATH = '/sabcrm/commerce/pos-sessions';

export function posSessionDetailHref(id: string): string {
  return `${POS_SESSIONS_PATH}/${encodeURIComponent(id)}`;
}
