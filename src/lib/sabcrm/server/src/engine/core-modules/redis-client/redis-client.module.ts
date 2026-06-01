// PORT-NOTE: NestJS @Global() @Module() has no Next.js equivalent.
// This registry re-exports the ported RedisClientService so consumers
// can import it directly without going through a DI container.
//
// What the original module wired:
//   - imports: [TwentyConfigModule]       → env vars read from process.env in the service
//   - providers/exports: [RedisClientService]

export {
  RedisClientService,
  getRedisClient,
  getRedisQueueClient,
} from "@/lib/sabcrm/server/src/engine/core-modules/redis-client/redis-client.service";
