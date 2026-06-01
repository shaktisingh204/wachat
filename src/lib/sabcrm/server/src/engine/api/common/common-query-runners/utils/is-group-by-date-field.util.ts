import "server-only";

// PORT-NOTE: Ported from Twenty's is-group-by-date-field.util.ts. Pure type guard, no dependencies.

import type {
  GroupByDateField,
  GroupByField,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/types/group-by-field.types';

export const isGroupByDateField = (
  groupByField: GroupByField,
): groupByField is GroupByDateField => {
  return (
    'dateGranularity' in groupByField &&
    !('nestedFieldMetadata' in groupByField)
  );
};
