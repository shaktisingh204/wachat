// PORT-NOTE: NestJS module wiring has no Next.js equivalent.
// Re-exports the ported service function and exception so consumers
// import from one place.

export { processRecordInput } from '@/lib/sabcrm/server/src/engine/core-modules/record-transformer/services/record-input-transformer.service';
export {
  RecordTransformerException,
  RecordTransformerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-transformer/record-transformer.exception';
export { recordTransformerGraphqlApiExceptionHandler } from '@/lib/sabcrm/server/src/engine/core-modules/record-transformer/utils/record-transformer-graphql-api-exception-handler.util';
