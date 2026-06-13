/**
 * SabCRM Supply — BOM surface config (client-safe, rollout WI-10).
 *
 * The BOM entity's doc-surface vocabulary: status defs + tones, the
 * happy-path flow for the StatusFlow rail, kit-filter mapping and route
 * helpers. The status union + transitions are authoritative in
 * `sabcrm-supply-docs.actions.types.ts` (free-form crate — the UI vocab
 * is the only guard).
 */

import type {
  DocListFilters,
  DocStatusDef,
} from '@/app/sabcrm/finance/_components/doc-surface/types';
import type { SabcrmBomStatus } from '@/app/actions/sabcrm-supply-docs.actions.types';
import { SABCRM_BOM_FLOW } from '@/app/actions/sabcrm-supply-docs.actions.types';
import type { SabcrmBomListFilters } from '@/app/actions/sabcrm-supply-bom.actions.types';

export const BOM_STATUSES: (DocStatusDef & { value: SabcrmBomStatus })[] = [
  { value: 'draft', label: 'Draft', tone: 'neutral' },
  { value: 'active', label: 'Active', tone: 'success' },
  { value: 'obsolete', label: 'Obsolete', tone: 'neutral' },
];

export const BOM_FLOW: readonly SabcrmBomStatus[] = SABCRM_BOM_FLOW;

export function bomStatusLabel(value: string | undefined): string {
  if (!value) return 'Draft';
  return (
    BOM_STATUSES.find((s) => s.value === value)?.label ??
    value.replaceAll('_', ' ')
  );
}

export function toBomFilters(f: DocListFilters): SabcrmBomListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: (f.status as SabcrmBomStatus | '') || '',
    from: f.from,
    to: f.to,
  };
}

export const BOM_PATH = '/sabcrm/supply/bom';

export function bomDetailHref(id: string): string {
  return `${BOM_PATH}/${encodeURIComponent(id)}`;
}
