// PORT-NOTE: Ported from twenty-server record-crud types. NestJS DI removed.
import { type RecordCrudExecutionContext } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/record-crud-execution-context.type';
import { type UpsertRecordInput } from '@/lib/sabcrm/server/src/engine/core-modules/record-crud/types/record-crud-input.type';

export type UpsertRecordParams = UpsertRecordInput & RecordCrudExecutionContext;
