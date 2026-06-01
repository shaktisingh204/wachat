import "server-only";

// PORT-NOTE: NestJS GraphQL resolver ported to plain async server functions.
// Each @Query / @Mutation becomes an exported async function that receives
// the workspace/user context explicitly instead of via decorators.
// Redis publish for cancellation is done inline; BillingUsageService /
// AiModelRegistryService / AgentChatService / etc. are passed as deps.

import { getCancelChannel } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/utils/get-cancel-channel.util';
import type { BrowsingContextType } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/browsingContext.type';
import type { AgentChatThreadDocument } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity';
import type { AgentChatService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat.service';
import type { AgentChatStreamingService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat-streaming.service';
import type { AgentChatEventPublisherService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat-event-publisher.service';
import type { SystemPromptBuilderService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/system-prompt-builder.service';
import type { FileAttachmentInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/dtos/file-attachment.input';
import type { SendChatMessageResultDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/dtos/send-chat-message-result.dto';
import type { ChatStreamCatchupChunksDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/dtos/chat-stream-catchup-chunks.dto';
import type { AiSystemPromptPreviewDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/dtos/ai-system-prompt-preview.dto';
import { toDisplayCredits } from '@/lib/sabcrm/server/src/engine/core-modules/usage/utils/to-display-credits.util';

// Shared workspace context passed to every action.
export type WorkspaceContext = {
  id: string;
  smartModel?: string;
  aiAdditionalInstructions?: string;
};

export type AgentChatActionDeps = {
  agentChatService: AgentChatService;
  agentChatStreamingService: AgentChatStreamingService;
  eventPublisherService: AgentChatEventPublisherService;
  systemPromptBuilderService: SystemPromptBuilderService;
  hasAvailableCreditsOrThrow: (workspaceId: string) => Promise<void>;
  getAvailableModels: () => unknown[];
  validateModelAvailability: (
    modelId: string | undefined,
    workspace: WorkspaceContext,
  ) => void;
  getThread: (
    workspaceId: string,
    threadId: string,
    userWorkspaceId: string,
  ) => Promise<AgentChatThreadDocument | null>;
  redisPublish: (channel: string, message: string) => Promise<void>;
  updateThreadActiveStreamId: (
    workspaceId: string,
    threadId: string,
    userWorkspaceId: string,
    activeStreamId: string | null,
  ) => Promise<void>;
};

// chatThreads — list all threads for the current user
export async function chatThreads(
  {
    userWorkspaceId,
    workspaceId,
  }: { userWorkspaceId: string; workspaceId: string },
  { agentChatService }: Pick<AgentChatActionDeps, 'agentChatService'>,
) {
  return agentChatService.getThreadsForUser({ userWorkspaceId, workspaceId });
}

// chatThread — fetch a single thread by id
export async function chatThread(
  {
    id,
    userWorkspaceId,
    workspaceId,
  }: { id: string; userWorkspaceId: string; workspaceId: string },
  { agentChatService }: Pick<AgentChatActionDeps, 'agentChatService'>,
) {
  return agentChatService.getThreadById({
    threadId: id,
    userWorkspaceId,
    workspaceId,
  });
}

// chatMessages — list messages for a thread
export async function chatMessages(
  {
    threadId,
    userWorkspaceId,
    workspaceId,
  }: { threadId: string; userWorkspaceId: string; workspaceId: string },
  { agentChatService }: Pick<AgentChatActionDeps, 'agentChatService'>,
) {
  return agentChatService.getMessagesForThread({
    threadId,
    userWorkspaceId,
    workspaceId,
  });
}

// chatStreamCatchupChunks — fetch accumulated SSE chunks for reconnection
export async function chatStreamCatchupChunks(
  {
    threadId,
    userWorkspaceId,
    workspaceId,
  }: { threadId: string; userWorkspaceId: string; workspaceId: string },
  {
    agentChatService,
    eventPublisherService,
  }: Pick<
    AgentChatActionDeps,
    'agentChatService' | 'eventPublisherService'
  >,
): Promise<ChatStreamCatchupChunksDTO> {
  await agentChatService.getThreadById({
    threadId,
    userWorkspaceId,
    workspaceId,
  });

  return eventPublisherService.getAccumulatedChunks(threadId);
}

// createChatThread — create a new thread
export async function createChatThread(
  {
    userWorkspaceId,
    workspaceId,
  }: { userWorkspaceId: string; workspaceId: string },
  { agentChatService }: Pick<AgentChatActionDeps, 'agentChatService'>,
) {
  return agentChatService.createThread({ userWorkspaceId, workspaceId });
}

// sendChatMessage — send a message and start/queue a stream
export async function sendChatMessage(
  {
    threadId,
    text,
    messageId,
    browsingContext,
    modelId,
    fileAttachments,
    userWorkspaceId,
    workspace,
  }: {
    threadId: string;
    text: string;
    messageId: string;
    browsingContext: BrowsingContextType | null;
    modelId?: string;
    fileAttachments?: FileAttachmentInput[] | null;
    userWorkspaceId: string;
    workspace: WorkspaceContext;
  },
  {
    agentChatService,
    agentChatStreamingService,
    eventPublisherService,
    hasAvailableCreditsOrThrow,
    getAvailableModels,
    validateModelAvailability,
    getThread,
  }: AgentChatActionDeps,
): Promise<SendChatMessageResultDTO> {
  if (getAvailableModels().length === 0) {
    throw new Error(
      'API_KEY_NOT_CONFIGURED: No AI models are available. Configure at least one AI provider.',
    );
  }

  const resolvedModelId = modelId ?? workspace.smartModel;

  validateModelAvailability(resolvedModelId, workspace);

  await hasAvailableCreditsOrThrow(workspace.id);

  const thread = await getThread(workspace.id, threadId, userWorkspaceId);

  if (!thread) {
    throw new Error('THREAD_NOT_FOUND: Thread not found');
  }

  if (thread.deletedAt != null) {
    await agentChatService.unarchiveThread({
      threadId,
      userWorkspaceId,
      workspaceId: workspace.id,
    });
  }

  if (thread.activeStreamId != null) {
    const queuedMessage = await agentChatService.queueMessage({
      threadId,
      text,
      id: messageId,
      fileAttachments: fileAttachments ?? undefined,
      workspaceId: workspace.id,
      userWorkspaceId,
    });

    await eventPublisherService.publish({
      threadId,
      workspaceId: workspace.id,
      event: { type: 'queue-updated' },
    });

    return { messageId: queuedMessage.id, queued: true };
  }

  const result = await agentChatStreamingService.streamAgentChat({
    threadId,
    browsingContext: browsingContext ?? null,
    modelId,
    userWorkspaceId,
    workspace,
    text,
    messageId,
    fileAttachments: fileAttachments ?? undefined,
  });

  return {
    messageId: result.messageId,
    queued: false,
    streamId: result.streamId,
  };
}

// stopAgentChatStream — cancel an active stream
export async function stopAgentChatStream(
  {
    threadId,
    userWorkspaceId,
    workspaceId,
  }: { threadId: string; userWorkspaceId: string; workspaceId: string },
  {
    getThread,
    redisPublish,
    updateThreadActiveStreamId,
  }: Pick<
    AgentChatActionDeps,
    'getThread' | 'redisPublish' | 'updateThreadActiveStreamId'
  >,
): Promise<boolean> {
  const thread = await getThread(workspaceId, threadId, userWorkspaceId);

  if (!thread || thread.activeStreamId == null) {
    return true;
  }

  await redisPublish(getCancelChannel(threadId), 'cancel');

  await updateThreadActiveStreamId(
    workspaceId,
    threadId,
    userWorkspaceId,
    null,
  );

  return true;
}

// renameChatThread — rename a thread's title
export async function renameChatThread(
  {
    id,
    title,
    userWorkspaceId,
    workspaceId,
  }: {
    id: string;
    title: string;
    userWorkspaceId: string;
    workspaceId: string;
  },
  { agentChatService }: Pick<AgentChatActionDeps, 'agentChatService'>,
) {
  return agentChatService.updateThreadTitle({
    threadId: id,
    userWorkspaceId,
    workspaceId,
    title,
  });
}

// archiveChatThread — soft-delete a thread (stop active stream first)
export async function archiveChatThread(
  {
    id,
    userWorkspaceId,
    workspaceId,
  }: { id: string; userWorkspaceId: string; workspaceId: string },
  deps: AgentChatActionDeps,
) {
  await cancelActiveStreamIfAny(id, userWorkspaceId, workspaceId, deps);

  return deps.agentChatService.archiveThread({
    threadId: id,
    userWorkspaceId,
    workspaceId,
  });
}

// unarchiveChatThread — restore an archived thread
export async function unarchiveChatThread(
  {
    id,
    userWorkspaceId,
    workspaceId,
  }: { id: string; userWorkspaceId: string; workspaceId: string },
  { agentChatService }: Pick<AgentChatActionDeps, 'agentChatService'>,
) {
  return agentChatService.unarchiveThread({
    threadId: id,
    userWorkspaceId,
    workspaceId,
  });
}

// deleteChatThread — hard-delete a thread (stop active stream first)
export async function deleteChatThread(
  {
    id,
    userWorkspaceId,
    workspaceId,
  }: { id: string; userWorkspaceId: string; workspaceId: string },
  deps: AgentChatActionDeps,
): Promise<boolean> {
  await cancelActiveStreamIfAny(id, userWorkspaceId, workspaceId, deps);

  await deps.agentChatService.hardDeleteThread({
    threadId: id,
    userWorkspaceId,
    workspaceId,
  });

  return true;
}

// deleteQueuedChatMessage — remove a queued (not-yet-sent) message
export async function deleteQueuedChatMessage(
  {
    messageId,
    userWorkspaceId,
    workspaceId,
    threadId: knownThreadId,
  }: {
    messageId: string;
    userWorkspaceId: string;
    workspaceId: string;
    threadId?: string;
  },
  {
    agentChatService,
    eventPublisherService,
    getThread,
  }: AgentChatActionDeps,
): Promise<boolean> {
  const message = await agentChatService.findQueuedMessage({
    messageId,
    workspaceId,
  });

  if (!message) {
    throw new Error('MESSAGE_NOT_FOUND: Queued message not found');
  }

  const thread = await getThread(
    workspaceId,
    message.threadId,
    userWorkspaceId,
  );

  if (!thread) {
    throw new Error('THREAD_NOT_FOUND: Thread not found');
  }

  const deleted = await agentChatService.deleteQueuedMessage({
    messageId,
    workspaceId,
  });

  if (deleted) {
    await eventPublisherService.publish({
      threadId: message.threadId,
      workspaceId,
      event: { type: 'queue-updated' },
    });
  }

  return deleted;
}

// getAiSystemPromptPreview — build a preview of the system prompt
export async function getAiSystemPromptPreview(
  {
    workspaceId,
    userWorkspaceId,
    aiAdditionalInstructions,
  }: {
    workspaceId: string;
    userWorkspaceId: string;
    aiAdditionalInstructions?: string;
  },
  {
    systemPromptBuilderService,
  }: Pick<AgentChatActionDeps, 'systemPromptBuilderService'>,
): Promise<AiSystemPromptPreviewDTO> {
  return systemPromptBuilderService.buildPreview(
    workspaceId,
    userWorkspaceId,
    aiAdditionalInstructions,
  );
}

// resolveThreadTotalInputCredits — field resolver helper
export function resolveThreadTotalInputCredits(
  totalInputCredits: number,
): number {
  return toDisplayCredits(totalInputCredits);
}

// resolveThreadTotalOutputCredits — field resolver helper
export function resolveThreadTotalOutputCredits(
  totalOutputCredits: number,
): number {
  return toDisplayCredits(totalOutputCredits);
}

// Internal: cancel an active stream for a thread if one exists.
async function cancelActiveStreamIfAny(
  threadId: string,
  userWorkspaceId: string,
  workspaceId: string,
  {
    getThread,
    redisPublish,
  }: Pick<AgentChatActionDeps, 'getThread' | 'redisPublish'>,
): Promise<void> {
  const thread = await getThread(workspaceId, threadId, userWorkspaceId);

  if (!thread || thread.activeStreamId == null) {
    return;
  }

  await redisPublish(getCancelChannel(threadId), 'cancel');
}
