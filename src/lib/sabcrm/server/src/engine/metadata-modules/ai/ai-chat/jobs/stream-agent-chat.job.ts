import "server-only";

import { createUIMessageStream } from 'ai';
import type {
  CodeExecutionData,
  ExtendedUIMessage,
  ExtendedUIMessagePart,
} from '@/lib/sabcrm/shared/ai';

import type { AiModelConfig } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-model-config.type';
import type { AgentChatThreadDocument } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity';
import type { WorkspaceDocument } from '@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.entity';
import { AgentMessageRole } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message.entity';
import { computeCostBreakdown } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/compute-cost-breakdown.util';
import { convertDollarsToBillingCredits } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/convert-dollars-to-billing-credits.util';
import { extractCacheCreationTokens } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/extract-cache-creation-tokens.util';
import { toDisplayCredits } from '@/lib/sabcrm/server/src/engine/core-modules/usage/utils/to-display-credits.util';
import { getCancelChannel } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/utils/get-cancel-channel.util';
import type { AgentChatCancelSubscriberService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat-cancel-subscriber.service';
import type { AgentChatEventPublisherService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat-event-publisher.service';
import type { AgentChatStreamingService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat-streaming.service';
import type { AgentChatService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat.service';
import type { ChatExecutionService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/chat-execution.service';

export { STREAM_AGENT_CHAT_JOB_NAME } from './stream-agent-chat-job-name.constant';
export type { StreamAgentChatJobData } from './stream-agent-chat-job.types';

import { STREAM_AGENT_CHAT_JOB_NAME } from './stream-agent-chat-job-name.constant';
import type { StreamAgentChatJobData } from './stream-agent-chat-job.types';

// PORT-NOTE: NestJS @Processor/@Process worker pattern replaced with a plain
// exported function. The job is enqueued via the SabNode queue/job system.
// ThreadRepository and WorkspaceRepository become Mongo collection accessors.

export async function handleStreamAgentChatJob(
  data: StreamAgentChatJobData,
  deps: {
    getWorkspace: (workspaceId: string) => Promise<WorkspaceDocument | null>;
    getThread: (
      workspaceId: string,
      threadId: string,
      activeStreamId: string,
    ) => Promise<AgentChatThreadDocument | null>;
    updateThreadActiveStreamId: (
      workspaceId: string,
      threadId: string,
      activeStreamId: string | null,
    ) => Promise<void>;
    agentChatService: AgentChatService;
    chatExecutionService: ChatExecutionService;
    eventPublisherService: AgentChatEventPublisherService;
    cancelSubscriberService: AgentChatCancelSubscriberService;
    agentChatStreamingService: AgentChatStreamingService;
  },
): Promise<void> {
  const {
    getWorkspace,
    getThread,
    updateThreadActiveStreamId,
    agentChatService,
    chatExecutionService,
    eventPublisherService,
    cancelSubscriberService,
    agentChatStreamingService,
  } = deps;

  const workspace = await getWorkspace(data.workspaceId);

  if (!workspace) {
    console.error(`[${STREAM_AGENT_CHAT_JOB_NAME}] Workspace ${data.workspaceId} not found`);
    await eventPublisherService.publish({
      threadId: data.threadId,
      workspaceId: data.workspaceId,
      event: {
        type: 'stream-error',
        code: 'WORKSPACE_NOT_FOUND',
        message: `Workspace ${data.workspaceId} not found`,
      },
    });

    return;
  }

  const abortController = new AbortController();
  const cancelChannel = getCancelChannel(data.threadId);

  await cancelSubscriberService.subscribe(cancelChannel, () => {
    abortController.abort();
  });

  try {
    await executeStream(data, workspace, abortController.signal, deps);
  } catch (error) {
    console.error(
      `[${STREAM_AGENT_CHAT_JOB_NAME}] Stream ${data.streamId} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    await eventPublisherService
      .publish({
        threadId: data.threadId,
        workspaceId: data.workspaceId,
        event: {
          type: 'stream-error',
          code: 'STREAM_EXECUTION_FAILED',
          message:
            error instanceof Error ? error.message : 'Stream execution failed',
        },
      })
      .catch(() => {});
    throw error;
  } finally {
    await cancelSubscriberService.unsubscribe(cancelChannel);
    const thread = await getThread(
      data.workspaceId,
      data.threadId,
      data.streamId,
    );

    if (thread) {
      await updateThreadActiveStreamId(
        data.workspaceId,
        data.threadId,
        null,
      ).catch(() => {});
    }

    if (!abortController.signal.aborted) {
      await agentChatStreamingService
        .flushNextQueuedMessage(
          data.threadId,
          data.userWorkspaceId,
          data.workspaceId,
          data.hasTitle,
        )
        .catch((error) => {
          console.error(
            `[${STREAM_AGENT_CHAT_JOB_NAME}] Failed to flush queued message for thread ${data.threadId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
    }
  }
}

async function executeStream(
  data: StreamAgentChatJobData,
  workspace: WorkspaceDocument,
  abortSignal: AbortSignal,
  deps: {
    agentChatService: AgentChatService;
    chatExecutionService: ChatExecutionService;
    eventPublisherService: AgentChatEventPublisherService;
  },
): Promise<void> {
  const { agentChatService, chatExecutionService, eventPublisherService } = deps;

  // When processing a promoted queued message, the user message already
  // exists in the DB with a turn — skip persisting it again.
  const userMessagePromise = data.existingTurnId
    ? Promise.resolve({ turnId: data.existingTurnId })
    : agentChatService.addMessage({
        threadId: data.threadId,
        uiMessage: {
          role: AgentMessageRole.USER,
          parts: data.lastUserMessageParts.filter(
            (part): part is ExtendedUIMessagePart =>
              part.type === 'text' || part.type === 'file',
          ),
        },
        workspaceId: data.workspaceId,
      });

  userMessagePromise.catch(() => {});

  const titlePromise = data.hasTitle
    ? Promise.resolve(null)
    : agentChatService
        .generateTitleIfNeeded({
          threadId: data.threadId,
          messageContent: data.lastUserMessageText,
          workspaceId: data.workspaceId,
        })
        .catch(() => null);

  await buildAndPublishStream({
    workspace,
    data,
    userMessagePromise,
    titlePromise,
    abortSignal,
    agentChatService,
    chatExecutionService,
    eventPublisherService,
  });
}

async function buildAndPublishStream({
  workspace,
  data,
  userMessagePromise,
  titlePromise,
  abortSignal,
  agentChatService,
  chatExecutionService,
  eventPublisherService,
}: {
  workspace: WorkspaceDocument;
  data: StreamAgentChatJobData;
  userMessagePromise: Promise<{ turnId: string | null }>;
  titlePromise: Promise<string | null>;
  abortSignal: AbortSignal;
  agentChatService: AgentChatService;
  chatExecutionService: ChatExecutionService;
  eventPublisherService: AgentChatEventPublisherService;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let streamUsage = {
      inputTokens: 0,
      outputTokens: 0,
      inputCredits: 0,
      outputCredits: 0,
      cacheReadTokens: 0,
    };
    let lastStepConversationSize = 0;
    let totalCacheCreationTokens = 0;
    let streamError: unknown;
    let checkHasNoMoreAvailableCredits: () => boolean = () => false;

    // onFinish fires before the uiStream is fully drained. We use this
    // promise to coordinate: the IIFE waits for DB persist to complete
    // before publishing message-persisted (after all chunks).
    let resolveStreamFinished: () => void;
    const streamFinishedPromise = new Promise<void>((res) => {
      resolveStreamFinished = res;
    });

    abortSignal.addEventListener('abort', () => resolve(), { once: true });

    const uiStream = createUIMessageStream<ExtendedUIMessage>({
      execute: async ({ writer }) => {
        const onCodeExecutionUpdate = (
          codeExecutionData: CodeExecutionData,
        ) => {
          writer.write({
            type: 'data-code-execution' as const,
            id: `code-execution-${codeExecutionData.executionId}`,
            data: codeExecutionData,
          });
        };

        const onCompaction = () => {
          writer.write({
            type: 'data-compaction' as const,
            id: `compaction-${data.threadId}`,
            data: {},
          });
        };

        const { stream, modelConfig, hasNoMoreAvailableCredits } =
          await chatExecutionService.streamChat({
            workspace,
            userWorkspaceId: data.userWorkspaceId,
            messages: data.messages,
            browsingContext: data.browsingContext,
            modelId: data.modelId,
            onCodeExecutionUpdate,
            onCompaction,
            abortSignal,
            conversationSizeTokens: data.conversationSizeTokens,
          });

        checkHasNoMoreAvailableCredits = hasNoMoreAvailableCredits;

        const titleWritePromise = titlePromise.then((generatedTitle) => {
          if (generatedTitle) {
            writer.write({
              type: 'data-thread-title' as const,
              id: `thread-title-${data.threadId}`,
              data: { title: generatedTitle },
            });
          }
        });

        writer.merge(
          stream.toUIMessageStream({
            onError: (error) => {
              streamError = error;

              return error instanceof Error ? error.message : String(error);
            },
            sendStart: false,
            messageMetadata: ({ part }) => {
              return computeMessageMetadata({
                part,
                modelConfig,
                lastStepConversationSize,
                totalCacheCreationTokens,
                onUpdateUsage: (usage) => {
                  streamUsage = usage;
                },
                onUpdateConversationSize: (size) => {
                  lastStepConversationSize = size;
                },
                onUpdateCacheCreationTokens: (tokens) => {
                  totalCacheCreationTokens = tokens;
                },
              });
            },
            onFinish: async ({ responseMessage }) => {
              try {
                await handleStreamFinish({
                  responseMessage,
                  threadId: data.threadId,
                  workspaceId: data.workspaceId,
                  userWorkspaceId: data.userWorkspaceId,
                  streamUsage,
                  lastStepConversationSize,
                  totalCacheCreationTokens,
                  modelConfig,
                  userMessagePromise,
                  agentChatService,
                });
                await titleWritePromise;
                resolveStreamFinished();
              } catch (error) {
                reject(error);
              }
            },
            sendReasoning: true,
          }),
        );
      },
    });

    // Publish all chunks first, then signal completion. This guarantees
    // message-persisted arrives after every stream-chunk on the client.
    void (async () => {
      try {
        for await (const chunk of uiStream) {
          await eventPublisherService.publish({
            threadId: data.threadId,
            workspaceId: data.workspaceId,
            event: {
              type: 'stream-chunk',
              chunk: chunk as Record<string, unknown>,
            },
          });
        }

        await streamFinishedPromise;

        if (streamError) {
          reject(streamError);
        } else if (checkHasNoMoreAvailableCredits()) {
          await eventPublisherService.publish({
            threadId: data.threadId,
            workspaceId: data.workspaceId,
            event: { type: 'credits-exhausted' },
          });
          resolve();
        } else {
          await eventPublisherService.publish({
            threadId: data.threadId,
            workspaceId: data.workspaceId,
            event: { type: 'message-persisted', messageId: data.threadId },
          });
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    })();
  });
}

function computeMessageMetadata({
  part,
  modelConfig,
  lastStepConversationSize,
  totalCacheCreationTokens,
  onUpdateUsage,
  onUpdateConversationSize,
  onUpdateCacheCreationTokens,
}: {
  part: {
    type: string;
    usage?: {
      inputTokens?: number;
      inputTokenDetails?: { cacheReadTokens?: number };
    };
    totalUsage?: {
      inputTokens?: number;
      outputTokens?: number;
      inputTokenDetails?: { cacheReadTokens?: number };
      outputTokenDetails?: { reasoningTokens?: number };
    };
    providerMetadata?: Record<string, Record<string, unknown> | undefined>;
  };
  modelConfig: AiModelConfig;
  lastStepConversationSize: number;
  totalCacheCreationTokens: number;
  onUpdateUsage: (usage: {
    inputTokens: number;
    outputTokens: number;
    inputCredits: number;
    outputCredits: number;
    cacheReadTokens: number;
  }) => void;
  onUpdateConversationSize: (size: number) => void;
  onUpdateCacheCreationTokens: (tokens: number) => void;
}) {
  if (part.type === 'finish-step') {
    const stepInput = part.usage?.inputTokens ?? 0;
    const stepCached = part.usage?.inputTokenDetails?.cacheReadTokens ?? 0;
    const stepCacheCreation = extractCacheCreationTokens(part.providerMetadata);

    onUpdateCacheCreationTokens(totalCacheCreationTokens + stepCacheCreation);
    onUpdateConversationSize(stepInput + stepCached + stepCacheCreation);
  }

  if (part.type === 'finish') {
    const breakdown = computeCostBreakdown(modelConfig, {
      inputTokens: part.totalUsage?.inputTokens,
      outputTokens: part.totalUsage?.outputTokens,
      cachedInputTokens: part.totalUsage?.inputTokenDetails?.cacheReadTokens,
      reasoningTokens: part.totalUsage?.outputTokenDetails?.reasoningTokens,
      cacheCreationTokens: totalCacheCreationTokens,
    });

    const inputCredits = Math.round(
      convertDollarsToBillingCredits(breakdown.inputCostInDollars),
    );
    const outputCredits = Math.round(
      convertDollarsToBillingCredits(breakdown.outputCostInDollars),
    );

    onUpdateUsage({
      inputTokens: breakdown.tokenCounts.totalInputTokens,
      outputTokens: part.totalUsage?.outputTokens ?? 0,
      inputCredits,
      outputCredits,
      cacheReadTokens: breakdown.tokenCounts.cachedInputTokens,
    });

    return {
      createdAt: new Date().toISOString(),
      usage: {
        inputTokens: breakdown.tokenCounts.totalInputTokens,
        outputTokens: part.totalUsage?.outputTokens ?? 0,
        cachedInputTokens: breakdown.tokenCounts.cachedInputTokens,
        inputCredits: toDisplayCredits(inputCredits),
        outputCredits: toDisplayCredits(outputCredits),
        conversationSize: lastStepConversationSize,
      },
      model: {
        contextWindowTokens: modelConfig.contextWindowTokens,
      },
    };
  }

  return undefined;
}

async function handleStreamFinish({
  responseMessage,
  threadId,
  workspaceId,
  userWorkspaceId,
  streamUsage,
  lastStepConversationSize,
  totalCacheCreationTokens,
  modelConfig,
  userMessagePromise,
  agentChatService,
}: {
  responseMessage: Omit<ExtendedUIMessage, 'id'>;
  threadId: string;
  workspaceId: string;
  userWorkspaceId: string;
  streamUsage: {
    inputTokens: number;
    outputTokens: number;
    inputCredits: number;
    outputCredits: number;
    cacheReadTokens: number;
  };
  lastStepConversationSize: number;
  totalCacheCreationTokens: number;
  modelConfig: AiModelConfig;
  userMessagePromise: Promise<{ turnId: string | null }>;
  agentChatService: AgentChatService;
}): Promise<void> {
  if (responseMessage.parts.length === 0) {
    return;
  }

  const threadStatus = await agentChatService.getThreadStatusById({
    threadId,
    workspaceId,
  });

  if (!threadStatus || threadStatus.deletedAt) {
    return;
  }

  const userMessage = await userMessagePromise;

  await agentChatService.addMessage({
    threadId,
    uiMessage: responseMessage,
    turnId: userMessage.turnId ?? undefined,
    workspaceId,
  });

  await agentChatService.updateThreadUsage({
    threadId,
    workspaceId,
    streamUsage,
    totalCacheCreationTokens,
    contextWindowTokens: modelConfig.contextWindowTokens,
    conversationSize: lastStepConversationSize,
  });

  await agentChatService.notifyThreadUsageUpdated({
    threadId,
    userWorkspaceId,
    workspaceId,
  });
}
