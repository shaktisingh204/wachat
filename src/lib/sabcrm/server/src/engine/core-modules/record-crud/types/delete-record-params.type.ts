// PORT-NOTE: Ported from twenty-server. Pure TS type composition.

import { type RecordCrudExecutionContext } from './record-crud-execution-context.type';
import { type DeleteRecordInput } from './record-crud-input.type';

export type DeleteRecordParams = DeleteRecordInput &
  RecordCrudExecutionContext & {
    soft?: boolean;
  };
