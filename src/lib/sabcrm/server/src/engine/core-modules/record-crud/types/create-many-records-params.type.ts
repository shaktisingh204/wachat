// PORT-NOTE: Ported from twenty-server. Pure TS type, no NestJS deps.
// ActorMetadata sourced from ported shared types.
// RolePermissionConfig is an open record stub until the ORM layer is ported.

import { type ActorMetadata } from '@/lib/sabcrm/shared/src/types/composite-types/actor.composite-type';

import { type RecordCrudExecutionContext } from './record-crud-execution-context.type';
import { type ObjectRecordProperties } from './object-record-properties.type';

export type CreateManyRecordsParams = {
  objectName: string;
  objectRecords: ObjectRecordProperties[];
  authContext: RecordCrudExecutionContext['authContext'];
  rolePermissionConfig?: RecordCrudExecutionContext['rolePermissionConfig'];
  createdBy?: ActorMetadata;
  slimResponse?: boolean;
};
