import "server-only";

import type { Redis } from 'ioredis';

// Single shared Redis subscriber connection per process for AI stream
// cancellation. Multiplexes all cancel channels onto one connection
// so we use exactly 1 Redis connection regardless of how many
// concurrent streams are running.
//
// PORT-NOTE: NestJS @Injectable() / OnModuleDestroy removed. Use
// createAgentChatCancelSubscriberService() as a singleton factory and call
// destroy() explicitly on server shutdown.

export type AgentChatCancelSubscriberService = {
  subscribe: (channel: string, onCancel: () => void) => Promise<void>;
  unsubscribe: (channel: string) => Promise<void>;
  destroy: () => Promise<void>;
};

export function createAgentChatCancelSubscriberService(
  getRedisClient: () => Redis,
): AgentChatCancelSubscriberService {
  let subscriber: Redis | null = null;
  const callbacks = new Map<string, () => void>();

  function ensureSubscriber(): Redis {
    if (!subscriber) {
      subscriber = getRedisClient().duplicate();
      subscriber.on('message', (channel: string) => {
        const callback = callbacks.get(channel);

        if (callback) {
          callback();
          callbacks.delete(channel);
          subscriber?.unsubscribe(channel).catch(() => {});
        }
      });
    }

    return subscriber;
  }

  return {
    async subscribe(channel: string, onCancel: () => void): Promise<void> {
      callbacks.set(channel, onCancel);
      await ensureSubscriber().subscribe(channel);
    },

    async unsubscribe(channel: string): Promise<void> {
      callbacks.delete(channel);
      await subscriber?.unsubscribe(channel).catch(() => {});
    },

    async destroy(): Promise<void> {
      if (subscriber) {
        await subscriber.quit().catch(() => {});
        subscriber = null;
      }

      callbacks.clear();
    },
  };
}
