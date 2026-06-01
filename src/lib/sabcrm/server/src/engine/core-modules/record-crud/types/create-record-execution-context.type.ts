// PORT-NOTE: Ported from twenty-server. Pure TS type, no NestJS deps.
// ActorMetadata comes from twenty-shared (ported to shared/src/types/composite-types/actor.composite-type).

import { type ActorMetadata } from '@/lib/sabcrm/shared/src/types/composite-types/actor.composite-type';

import { type RecordCrudExecutionContext } from './record-crud-execution-context.type';

export type CreateRecordExecutionContext = RecordCrudExecutionContext & {
  createdBy?: ActorMetadata;
};
