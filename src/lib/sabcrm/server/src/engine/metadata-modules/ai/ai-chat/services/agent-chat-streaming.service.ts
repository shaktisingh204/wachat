import "server-only";

import { generateId } from 'ai';
import type {
  ExtendedFileUIPart,
  ExtendedUIMessagePart,
} from '@/lib/sabcrm/shared/ai';

import { AgentMessageRole, AgentMessageStatus } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message.entity';
import { mapDBPartsToUIMessageParts } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/utils/mapDBPartsToUIMessageParts';
import type { BrowsingContextType } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/browsingContext.type';
import type { AgentChatThreadDocument } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity';
import { STREAM_AGENT_CHAT_JOB_NAME } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/jobs/stream-agent-chat-job-name.constant';
import type { StreamAgentChatJobData } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/jobs/stream-agent-chat-job.types';
import type { AgentChatEventPublisherService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat-event-publisher.service';
import type { AgentChatService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-chat.service';
import type { AiChatFileAttachment } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/types/ai-chat-file-attachment.type';
import { FileFolder } from '@/lib/sabcrm/shared/types';

// PORT-NOTE: NestJS @Injectable() / @InjectWorkspaceScopedRepository /
// @InjectMessageQueue removed. Deps are injected via plain constructor args.

export type WorkspaceContext = {
  id: string;
  smartModel?: string;
};

export type StreamAgentChatOptions = {
  threadId: string;
  userWorkspaceId: string;
  workspace: WorkspaceContext;
  text: string;
  browsingContext: BrowsingContextType | null;
  modelId?: string;
  messageId?: string;
  fileAttachments?: AiChatFileAttachment[];
};

export type AgentChatStreamingService = {
  streamAgentChat: (
    options: StreamAgentChatOptions,
  ) => Promise<{ streamId: string; messageId: string }>;
  flushNextQueuedMessage: (
    threadId: string,
    userWorkspaceId: string,
    workspaceId: string,
    hasTitle: boolean,
  ) => Promise<void>;
};

export type AgentChatStreamingServiceDeps = {
  getThread: (
    workspaceId: string,
    threadId: string,
    userWorkspaceId: string,
  ) => Promise<AgentChatThreadDocument | null>;
  getThreadById: (
    workspaceId: string,
    threadId: string,
  ) => Promise<AgentChatThreadDocument | null>;
  getFilesByIds: (
    workspaceId: string,
    fileIds: string[],
    folderPrefix: string,
  ) => Promise<Array<{ id: string; mimeType: string }>>;
  updateThreadActiveStreamId: (
    workspaceId: string,
    threadId: string,
    activeStreamId: string,
  ) => Promise<void>;
  enqueueJob: (jobName: string, data: StreamAgentChatJobData) => Promise<void>;
  signFileUrl: (args: {
    fileId: string;
    workspaceId: string;
    fileFolder: string;
  }) => Promise<string>;
  agentChatService: AgentChatService;
  eventPublisherService: AgentChatEventPublisherService;
};

export function createAgentChatStreamingService(
  deps: AgentChatStreamingServiceDeps,
): AgentChatStreamingService {
  const {
    getThread,
    getThreadById,
    getFilesByIds,
    updateThreadActiveStreamId,
    enqueueJob,
    signFileUrl,
    agentChatService,
    eventPublisherService,
  } = deps;

  async function loadMessagesFromDB(
    threadId: string,
    userWorkspaceId: string,
    workspaceId: string,
  ) {
    const allMessages = await agentChatService.getMessagesForThread({
      threadId,
      userWorkspaceId,
      workspaceId,
    });

    const filteredMessages = allMessages.filter(
      (message) => message.status !== AgentMessageStatus.QUEUED,
    );

    return Promise.all(
      filteredMessages.map(async (message) => ({
        id: message.id,
        role: message.role as 'user' | 'assistant' | 'system',
        parts: await Promise.all(
          mapDBPartsToUIMessageParts(message.parts ?? []).map(async (part) => {
            const maybeFile = part as Record<string, unknown>;
            if (
              typeof maybeFile.type === 'string' &&
              maybeFile.type === 'file' &&
              typeof maybeFile.fileId === 'string'
            ) {
              const filePart = part as ExtendedFileUIPart;

              return {
                ...filePart,
                url: await signFileUrl({
                  fileId: filePart.fileId,
                  workspaceId,
                  fileFolder: FileFolder.AgentChat,
                }),
              } as ExtendedFileUIPart;
            }

            return part;
          }),
        ),
        createdAt: message.createdAt,
      })),
    );
  }

  async function buildFilePartsFromAttachments(
    fileAttachments: AiChatFileAttachment[] | undefined,
    workspaceId: string,
  ): Promise<ExtendedUIMessagePart[]> {
    if (!fileAttachments || fileAttachments.length === 0) {
      return [];
    }

    const fileIds = fileAttachments.map((attachment) => attachment.id);
    const validFiles = await getFilesByIds(
      workspaceId,
      fileIds,
      `${FileFolder.AgentChat}/`,
    );
    const validFileIds = new Set(validFiles.map((file) => file.id));

    return fileAttachments
      .filter((attachment) => validFileIds.has(attachment.id))
      .map((attachment): ExtendedFileUIPart => {
        const file = validFiles.find((f) => f.id === attachment.id);

        return {
          type: 'file' as const,
          mediaType: file?.mimeType ?? 'application/octet-stream',
          filename: attachment.filename,
          url: '',
          fileId: attachment.id,
        };
      });
  }

  return {
    async streamAgentChat({
      threadId,
      userWorkspaceId,
      workspace,
      text,
      browsingContext,
      modelId,
      messageId,
      fileAttachments,
    }): Promise<{ streamId: string; messageId: string }> {
      const thread = await getThread(workspace.id, threadId, userWorkspaceId);

      if (!thread) {
        throw new Error('THREAD_NOT_FOUND: Thread not found');
      }

      const fileParts = await buildFilePartsFromAttachments(
        fileAttachments,
        workspace.id,
      );

      const userMessageParts: ExtendedUIMessagePart[] = [
        { type: 'text' as const, text },
        ...fileParts,
      ];

      const savedUserMessage = await agentChatService.addMessage({
        threadId,
        id: messageId,
        uiMessage: {
          role: AgentMessageRole.USER,
          parts: userMessageParts,
        },
        workspaceId: workspace.id,
      });

      await agentChatService.notifyThreadActivityUpdated({
        threadId,
        userWorkspaceId,
        workspaceId: workspace.id,
      });

      const previousMessages = await loadMessagesFromDB(
        threadId,
        userWorkspaceId,
        workspace.id,
      );

      const streamId = generateId();

      await enqueueJob(STREAM_AGENT_CHAT_JOB_NAME, {
        threadId: thread.id,
        streamId,
        userWorkspaceId,
        workspaceId: workspace.id,
        messages: previousMessages,
        browsingContext,
        modelId,
        lastUserMessageText: text,
        lastUserMessageParts: userMessageParts,
        hasTitle: !!thread.title,
        conversationSizeTokens: thread.conversationSize,
        existingTurnId: savedUserMessage.turnId ?? undefined,
      });

      await updateThreadActiveStreamId(workspace.id, thread.id, streamId);

      return { streamId, messageId: savedUserMessage.id };
    },

    async flushNextQueuedMessage(
      threadId: string,
      userWorkspaceId: string,
      workspaceId: string,
      hasTitle: boolean,
    ): Promise<void> {
      const threadStatus = await getThreadById(workspaceId, threadId);

      if (!threadStatus || threadStatus.deletedAt) {
        return;
      }

      const queuedMessages = await agentChatService.getQueuedMessages({
        threadId,
        workspaceId,
      });

      const nextQueued = queuedMessages[0];

      if (!nextQueued) {
        return;
      }

      const textPart = nextQueued.parts?.find((part) => part.type === 'text');
      const messageText = textPart?.textContent ?? '';
      const fileParts = (nextQueued.parts ?? [])
        .filter((part) => part.type === 'file')
        .map(
          (part): ExtendedFileUIPart => ({
            type: 'file',
            mediaType: part.file?.mimeType ?? 'application/octet-stream',
            filename: part.fileFilename ?? '',
            url: '',
            fileId: part.fileId ?? '',
          }),
        );

      if (messageText === '' && fileParts.length === 0) {
        await agentChatService.deleteQueuedMessage({
          messageId: nextQueued.id,
          workspaceId,
        });

        return;
      }

      const turnId = await agentChatService.promoteQueuedMessage({
        messageId: nextQueued.id,
        threadId,
        workspaceId,
      });

      if (turnId === null) {
        return;
      }

      await eventPublisherService.publish({
        threadId,
        workspaceId,
        event: { type: 'queue-updated' },
      });

      await eventPublisherService.publish({
        threadId,
        workspaceId,
        event: { type: 'message-persisted', messageId: nextQueued.id },
      });

      const [uiMessages, thread] = await Promise.all([
        loadMessagesFromDB(threadId, userWorkspaceId, workspaceId),
        getThreadById(workspaceId, threadId),
      ]);

      if (!thread) {
        return;
      }

      const streamId = generateId();

      const lastUserMessageParts: ExtendedUIMessagePart[] = [
        ...(messageText !== ''
          ? [{ type: 'text' as const, text: messageText }]
          : []),
        ...fileParts,
      ];

      await enqueueJob(STREAM_AGENT_CHAT_JOB_NAME, {
        threadId,
        streamId,
        userWorkspaceId,
        workspaceId,
        messages: uiMessages,
        browsingContext: null,
        lastUserMessageText: messageText,
        lastUserMessageParts,
        hasTitle,
        conversationSizeTokens: thread.conversationSize,
        existingTurnId: turnId,
      });

      await updateThreadActiveStreamId(workspaceId, threadId, streamId);
    },
  };
}
