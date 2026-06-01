// PORT-NOTE: NestJS module wiring. No Next.js equivalent — re-exports the
// ported service and types so consumers can import from one place.

export { buildRecordPosition, overridePositionOnRecords, findByPosition, updateRecordPosition } from '@/lib/sabcrm/server/src/engine/core-modules/record-position/services/record-position.service';
export type { RecordPositionServiceCreateArgs } from '@/lib/sabcrm/server/src/engine/core-modules/record-position/services/record-position.service';
export type {
  RecordPositionQueryArgs,
  FindByPositionQueryArgs,
  FindMinPositionQueryArgs,
  FindMaxPositionQueryArgs,
  UpdatePositionQueryArgs,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-position/types/record-position-query.type';
export { RecordPositionQueryType } from '@/lib/sabcrm/server/src/engine/core-modules/record-position/types/record-position-query.type';
