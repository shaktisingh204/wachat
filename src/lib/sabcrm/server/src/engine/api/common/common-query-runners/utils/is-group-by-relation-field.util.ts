import "server-only";

// PORT-NOTE: Ported from Twenty's is-group-by-relation-field.util.ts. Pure type guard.

import type {
  GroupByField,
  GroupByRelationField,
} from '@/lib/sabcrm/server/src/engine/api/common/common-query-runners/types/group-by-field.types';

export const isGroupByRelationField = (
  groupByField: GroupByField,
): groupByField is GroupByRelationField => {
  return 'nestedFieldMetadata' in groupByField;
};
