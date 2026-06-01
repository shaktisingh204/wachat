// PORT-NOTE: Ported from twenty-server. ObjectRecordFilter and ObjectRecordOrderBy are left
// as open Record types since those GraphQL interfaces have no direct Mongo analogue.

import { type RecordCrudExecutionContext } from './record-crud-execution-context.type';
import { type FindRecordsInput } from './record-crud-input.type';

export type FindRecordsParams = FindRecordsInput &
  RecordCrudExecutionContext & {
    filter?:
      | Record<string, unknown>
      | Record<string, unknown>[]
      | Partial<Record<string, unknown>>
      | Partial<Record<string, unknown>>[];
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    offset?: number;
  };
