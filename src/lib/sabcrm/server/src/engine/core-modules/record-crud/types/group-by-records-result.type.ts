// PORT-NOTE: Ported from twenty-server. Pure TS type, no deps.

import { type AggregateOperations } from '@/lib/sabcrm/shared/src/types/AggregateOperations';

export type GroupByRecordsResult = {
  groups: Array<{ dimensions: string[]; value: string | number | null }>;
  dimensionLabels: string[];
  aggregation: keyof typeof AggregateOperations;
  groupCount: number;
};
