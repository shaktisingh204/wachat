/**
 * SabNode Developer Platform — barrel export.
 *
 * Re-exports the public surface of `src/lib/api-platform/*` so callers
 * can `import { verifyApiKey, consumeToken, signPayload } from '@/lib/api-platform'`.
 */

export type {
  ApiKey,
  OAuthApp,
  OAuthScope,
  RateLimitTier,
  Webhook,
  WebhookDelivery,
} from './types';

export type { ApiAuthContext } from './auth';
export { verifyApiKey, requireScope } from './auth';

export type { RateLimitResult } from './rate-limit';
export { consumeToken, rateLimitHeaders, TIER_LIMITS } from './rate-limit';

export type { DeliverOptions } from './webhooks';
export { signPayload, verifySignature, deliverWebhook } from './webhooks';

export type { OpenApiSpec } from './openapi';
export { buildOpenApiSpec } from './openapi';

export type { ProblemDetails, ProblemType, ApiErrorOptions } from './errors';
export { ApiError, isApiError } from './errors';

export type { ApiV1Context, ApiV1Handler, WithApiV1Options } from './handler';
export { withApiV1, abort } from './handler';

export type { CursorPayload, PaginateOptions, PageResult } from './pagination';
export { encodeCursor, decodeCursor, normalisePageArgs, paginate } from './pagination';

export type { IdempotentRecord, ProducedResult } from './idempotency';
export {
  hashBody,
  lookupIdempotent,
  acquireLock,
  releaseLock,
  storeIdempotent,
  withIdempotency,
  IDEMPOTENCY_TTL_SECONDS,
  IDEMPOTENCY_LOCK_TTL_SECONDS,
} from './idempotency';
