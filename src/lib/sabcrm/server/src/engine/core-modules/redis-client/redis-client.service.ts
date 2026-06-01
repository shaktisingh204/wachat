import "server-only";

// PORT-NOTE: NestJS @Injectable() / OnModuleDestroy removed.
// Singleton Redis clients are managed as module-level variables.
// Configuration is read from process.env (REDIS_URL, REDIS_QUEUE_URL).
// graphql-redis-subscriptions RedisPubSub preserved for parity.

import IORedis from "ioredis";
import { RedisPubSub } from "graphql-redis-subscriptions";

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

let _redisClient: IORedis | null = null;
let _redisQueueClient: IORedis | null = null;
let _redisPubSubClient: RedisPubSub | null = null;

export function getQueueClient(): IORedis {
  if (!_redisQueueClient) {
    const redisQueueUrl =
      process.env.REDIS_QUEUE_URL ?? process.env.REDIS_URL;

    if (!redisQueueUrl) {
      throw new Error("REDIS_QUEUE_URL or REDIS_URL must be defined");
    }

    _redisQueueClient = new IORedis(redisQueueUrl, {
      maxRetriesPerRequest: null,
    });
  }

  return _redisQueueClient;
}

export function getRedisQueueClient(): IORedis {
  return getQueueClient();
}

export function getClient(): IORedis {
  if (!_redisClient) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL must be defined");
    }

    _redisClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  return _redisClient;
}

export function getRedisClient(): IORedis {
  return getClient();
}

export function getPubSubClient(): RedisPubSub {
  if (!_redisPubSubClient) {
    const redisClient = getClient();

    _redisPubSubClient = new RedisPubSub({
      publisher: redisClient.duplicate(),
      subscriber: redisClient.duplicate(),
    });
  }

  return _redisPubSubClient;
}

export async function destroyClients(): Promise<void> {
  if (isDefined(_redisQueueClient)) {
    await _redisQueueClient.quit();
    _redisQueueClient = null;
  }
  if (isDefined(_redisClient)) {
    await _redisClient.quit();
    _redisClient = null;
  }
  if (isDefined(_redisPubSubClient)) {
    await _redisPubSubClient.close();
    _redisPubSubClient = null;
  }
}

// Class-style surface for code that imports RedisClientService by name.
export class RedisClientService {
  getQueueClient = getQueueClient;
  getClient = getClient;
  getPubSubClient = getPubSubClient;
  onModuleDestroy = destroyClients;
}
