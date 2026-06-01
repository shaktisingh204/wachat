// PORT-NOTE: NestJS module → SabNode registry/index.
// ThrottlerModule wired: ThrottlerService (exported).
// No DI container; re-export the ported service factory.

export {
  tokenBucketThrottleOrThrow,
  consumeTokens,
  getAvailableTokensCount,
} from '@/lib/sabcrm/server/src/engine/core-modules/throttler/throttler.service';
