/**
 * SabCRM People — salary-structure surface config (client-safe).
 *
 * Route helpers + kit-filter mapping for
 * `/sabcrm/people/salary-structures` (people-suite WI-31, rich shape
 * per WI-8). The status vocabulary is synthesized from the `active`
 * flag; component/calc/applicability vocabularies live in the shared
 * action types — re-exported here so the surface imports one module.
 * No server imports.
 */

import type { DocListFilters } from '../../finance/_components/doc-surface/types';
import type { SabcrmSalaryStructureListFilters } from '@/app/actions/sabcrm-people-salary-structures.actions.types';

export {
  APPLICABILITY_KINDS,
  CALC_KINDS,
  COMPONENT_FREQUENCIES,
  COMPONENT_TYPES,
  SALARY_STRUCTURE_STATUSES,
  previewComponentAmount,
} from '@/app/actions/sabcrm-people-salary-structures.actions.types';

export const SALARY_STRUCTURES_PATH = '/sabcrm/people/salary-structures';

/** Deep link that opens the full-field edit drawer for a row. */
export function structureOpenHref(id: string): string {
  return `${SALARY_STRUCTURES_PATH}?open=${encodeURIComponent(id)}`;
}

/**
 * Kit list filters → structure action filters. There is no party on
 * this entity (`partyId` is ignored) and structures are effective-dated
 * catalog rows, so the date range is not applicable.
 */
export function toStructureFilters(
  f: DocListFilters,
): SabcrmSalaryStructureListFilters {
  return {
    page: f.page,
    q: f.q || undefined,
    status: f.status || '',
  };
}
