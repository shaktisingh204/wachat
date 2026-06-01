// PORT-NOTE: Ported from twenty-server. ObjectRecordFilter is represented as an open
// Record since the original GraphQL interface has no direct Mongo analogue.

import { type RecordCrudExecutionContext } from './record-crud-execution-context.type';
import { type ObjectRecordProperties } from './object-record-properties.type';

export type UpdateManyRecordsParams = {
  objectName: string;
  filter: Partial<Record<string, unknown>>;
  data: ObjectRecordProperties;
  authContext: RecordCrudExecutionContext['authContext'];
  rolePermissionConfig?: RecordCrudExecutionContext['rolePermissionConfig'];
  slimResponse?: boolean;
};
