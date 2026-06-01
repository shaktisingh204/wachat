import "server-only";

import type { AgentChatSubscriptionEvent } from '@/lib/sabcrm/shared/ai';
import type { Redis } from 'ioredis';

const STREAM_CHUNKS_TTL_SECONDS = 3600;

// PORT-NOTE: NestJS @Injectable() removed. Use createAgentChatEventPublisherService()
// as a factory and pass the deps directly.

export type AgentChatEventPublisherService = {
  publish: (args: {
    threadId: string;
    workspaceId: string;
    event: AgentChatSubscriptionEvent;
  }) => Promise<void>;
  getAccumulatedChunks: (threadId: string) => Promise<{
    chunks: Record<string, unknown>[];
    maxSeq: number;
  }>;
};

function getStreamChunksKey(threadId: string): string {
  return `agent-chat-stream-chunks:${threadId}`;
}

export function createAgentChatEventPublisherService(deps: {
  getRedisClient: () => Redis;
  publishToAgentChat: (args: {
    workspaceId: string;
    threadId: string;
    payload: {
      onAgentChatEvent: {
        threadId: string;
        event: AgentChatSubscriptionEvent;
      };
    };
  }) => Promise<void>;
}): AgentChatEventPublisherService {
  const { getRedisClient, publishToAgentChat } = deps;

  return {
    async publish({ threadId, workspaceId, event }): Promise<void> {
      let publishedEvent: AgentChatSubscriptionEvent = event;

      if (event.type === 'stream-chunk') {
        const redis = getRedisClient();
        const key = getStreamChunksKey(threadId);

        // RPUSH returns the new list length — use it as a 1-based sequence number
        const seq = await redis.rpush(key, JSON.stringify(event.chunk));
        await redis.expire(key, STREAM_CHUNKS_TTL_SECONDS);

        publishedEvent = { ...event, seq };
      } else if (event.type === 'message-persisted') {
        const redis = getRedisClient();
        await redis.del(getStreamChunksKey(threadId));
      }

      await publishToAgentChat({
        workspaceId,
        threadId,
        payload: {
          onAgentChatEvent: {
            threadId,
            event: publishedEvent,
          },
        },
      });
    },

    async getAccumulatedChunks(threadId: string): Promise<{
      chunks: Record<string, unknown>[];
      maxSeq: number;
    }> {
      const redis = getRedisClient();
      const rawChunks = await redis.lrange(
        getStreamChunksKey(threadId),
        0,
        -1,
      );

      return {
        chunks: rawChunks.map((raw) => JSON.parse(raw) as Record<string, unknown>),
        maxSeq: rawChunks.length,
      };
    },
  };
}
