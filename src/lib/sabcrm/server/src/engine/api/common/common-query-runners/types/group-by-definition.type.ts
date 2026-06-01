import "server-only";

// PORT-NOTE: Ported from Twenty's GroupByDefinition type.
// ObjectRecordGroupByDateGranularity imported from ported shared types.

import type { ObjectRecordGroupByDateGranularity } from '@/lib/sabcrm/shared/src/types/ObjectRecordGroupByDateGranularity';

export type GroupByDefinition = {
  columnNameWithQuotes: string;
  expression: string;
  alias: string;
  dateGranularity?: ObjectRecordGroupByDateGranularity;
};
