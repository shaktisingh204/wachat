// PORT-NOTE: Ported from twenty-server. Pure TS type composition.

import { type ActorMetadata } from '@/lib/sabcrm/shared/src/types/composite-types/actor.composite-type';

import { type RecordCrudExecutionContext } from './record-crud-execution-context.type';

export type UpdateRecordExecutionContext = RecordCrudExecutionContext & {
  updatedBy?: ActorMetadata;
};
