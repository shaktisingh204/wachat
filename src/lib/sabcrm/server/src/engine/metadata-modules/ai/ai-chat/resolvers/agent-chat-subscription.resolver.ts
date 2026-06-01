import "server-only";

// PORT-NOTE: NestJS GraphQL Subscription resolver ported to a server-only
// function. The subscription/pubsub mechanism (Redis) is preserved.
// In a Next.js context this would be exposed via a WebSocket or SSE route.

import type { AgentChatEventDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/dtos/agent-chat-event.dto';
import type { AgentChatThreadDocument } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity';
import type { SubscriptionService } from '@/lib/sabcrm/server/src/engine/subscriptions/subscription.service';

export type AgentChatEventPayload = { onAgentChatEvent: AgentChatEventDTO };

export type OnAgentChatEventArgs = {
  threadId: string;
  workspaceId: string;
  userWorkspaceId: string;
};

export type OnAgentChatEventDeps = {
  subscriptionService: SubscriptionService;
  getThread: (
    workspaceId: string,
    threadId: string,
    userWorkspaceId: string,
  ) => Promise<Pick<AgentChatThreadDocument, 'id'> | null>;
};

// Validates ownership and returns the subscription iterator for the thread.
export async function onAgentChatEvent(
  { threadId, workspaceId, userWorkspaceId }: OnAgentChatEventArgs,
  { subscriptionService, getThread }: OnAgentChatEventDeps,
) {
  const thread = await getThread(workspaceId, threadId, userWorkspaceId);

  if (!thread) {
    throw new Error('THREAD_NOT_FOUND: Thread not found');
  }

  return subscriptionService.subscribeToAgentChat({
    workspaceId,
    threadId,
  });
}

// Subscription filter: only deliver events matching the requested threadId.
export function agentChatEventFilter(
  payload: AgentChatEventPayload,
  variables: { threadId: string },
): boolean {
  return payload.onAgentChatEvent.threadId === variables.threadId;
}
