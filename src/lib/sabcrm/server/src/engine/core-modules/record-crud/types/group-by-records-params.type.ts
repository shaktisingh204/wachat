// PORT-NOTE: Ported from twenty-server. ObjectRecordGroupBy is an open Record type
// since the original GraphQL interface doesn't have a direct Mongo analogue.
// AggregateOperations sourced from ported shared types.

import { type AggregateOperations } from '@/lib/sabcrm/shared/src/types/AggregateOperations';

import { type RecordCrudExecutionContext } from './record-crud-execution-context.type';

// GroupBy entry: fieldName -> true (scalar) or { nestedField: true } (relation)
export type ObjectRecordGroupByEntry = Record<
  string,
  true | Record<string, true>
>;

export type GroupByRecordsParams = RecordCrudExecutionContext & {
  objectName: string;
  groupBy: ObjectRecordGroupByEntry[];
  aggregateOperation?: keyof typeof AggregateOperations;
  aggregateFieldName?: string;
  limit?: number;
  orderBy?: 'ASC' | 'DESC';
  filter?: Record<string, unknown>;
};
