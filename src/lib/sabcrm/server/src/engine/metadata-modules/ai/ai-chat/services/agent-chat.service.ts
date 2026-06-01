import "server-only";

import type { ExtendedUIMessage } from '@/lib/sabcrm/shared/ai';
import type { UIDataTypes, UIMessagePart, UITools } from 'ai';

import {
  AgentMessageRole,
  AgentMessageStatus,
  type AgentMessageDocument,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/entities/agent-message.entity';
import { mapUIMessagePartsToDBParts } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/utils/mapUIMessagePartsToDBParts';
import type { AgentChatThreadDocument } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity';
import type { AiChatFileAttachment } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/types/ai-chat-file-attachment.type';
import type { AgentTitleGenerationService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/agent-title-generation.service';
import type { AgentChatThreadDTO } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/dtos/agent-chat-thread.dto';
import { toDisplayCredits } from '@/lib/sabcrm/server/src/engine/core-modules/usage/utils/to-display-credits.util';

// PORT-NOTE: NestJS @Injectable() / TypeORM repository injections removed.
// All database access is provided via the deps object using Mongo collection
// accessors. WorkspaceEventBroadcaster becomes a plain broadcast callback.

export type ThreadUsageUpdate = {
  inputTokens: number;
  outputTokens: number;
  inputCredits: number;
  outputCredits: number;
  cacheReadTokens: number;
};

export type AgentChatServiceDeps = {
  // Thread collection
  findThread: (
    workspaceId: string,
    filter: Partial<AgentChatThreadDocument>,
  ) => Promise<AgentChatThreadDocument | null>;
  findThreads: (
    workspaceId: string,
    filter: Partial<AgentChatThreadDocument>,
  ) => Promise<AgentChatThreadDocument[]>;
  insertThread: (
    workspaceId: string,
    data: Partial<AgentChatThreadDocument>,
  ) => Promise<AgentChatThreadDocument>;
  updateThread: (
    workspaceId: string,
    filter: Partial<AgentChatThreadDocument>,
    update: Partial<AgentChatThreadDocument>,
  ) => Promise<{ modifiedCount: number }>;
  deleteThread: (
    workspaceId: string,
    filter: Partial<AgentChatThreadDocument>,
  ) => Promise<{ deletedCount: number }>;
  // Turn collection
  insertTurn: (
    workspaceId: string,
    data: { threadId: string; agentId: string | null },
  ) => Promise<{ id: string }>;
  deleteTurn: (workspaceId: string, filter: { id: string }) => Promise<void>;
  // Message collection
  findMessages: (
    workspaceId: string,
    filter: Partial<AgentMessageDocument>,
    options?: { sort?: Record<string, 1 | -1>; relations?: string[] },
  ) => Promise<AgentMessageDocument[]>;
  findMessage: (
    workspaceId: string,
    filter: Partial<AgentMessageDocument>,
  ) => Promise<AgentMessageDocument | null>;
  insertMessage: (
    workspaceId: string,
    data: Partial<AgentMessageDocument>,
  ) => Promise<{ id: string }>;
  updateMessage: (
    workspaceId: string,
    filter: Partial<AgentMessageDocument>,
    update: Partial<AgentMessageDocument>,
  ) => Promise<{ modifiedCount: number }>;
  deleteMessage: (
    workspaceId: string,
    filter: Partial<AgentMessageDocument>,
  ) => Promise<{ deletedCount: number }>;
  // Message parts
  insertMessageParts: (
    workspaceId: string,
    parts: unknown[],
  ) => Promise<void>;
  // Files
  findFilesByIds: (
    workspaceId: string,
    ids: string[],
  ) => Promise<Array<{ id: string }>>;
  // Last-message-at aggregate
  getLastMessageAt: (
    workspaceId: string,
    threadId: string,
  ) => Promise<Date | null>;
  // Ranked threads (threads sorted by last message)
  getRankedThreadIds: (
    workspaceId: string,
    userWorkspaceId: string,
  ) => Promise<Array<{ id: string; lastMessageAt: Date | null }>>;
  // Broadcast
  broadcast: (
    workspaceId: string,
    events: Array<{
      type: 'created' | 'updated' | 'deleted';
      entityName: string;
      recordId: string;
      recipientUserWorkspaceIds: string[];
      properties: Record<string, unknown>;
    }>,
  ) => Promise<void>;
  // Title generation
  titleGenerationService: AgentTitleGenerationService;
};

function serializeThreadForBroadcast(
  thread: AgentChatThreadDocument,
  lastMessageAt: Date | null,
) {
  return {
    id: thread.id,
    title: thread.title,
    totalInputTokens: thread.totalInputTokens,
    totalOutputTokens: thread.totalOutputTokens,
    totalCacheReadTokens: thread.totalCacheReadTokens,
    totalCacheCreationTokens: thread.totalCacheCreationTokens,
    contextWindowTokens: thread.contextWindowTokens,
    conversationSize: thread.conversationSize,
    totalInputCredits: toDisplayCredits(thread.totalInputCredits),
    totalOutputCredits: toDisplayCredits(thread.totalOutputCredits),
    deletedAt: thread.deletedAt,
    lastMessageAt,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export type AgentChatService = {
  createThread: (args: {
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<AgentChatThreadDocument>;

  getThreadById: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<AgentChatThreadDocument>;

  getThreadStatusById: (args: {
    threadId: string;
    workspaceId: string;
  }) => Promise<Pick<AgentChatThreadDocument, 'id' | 'deletedAt'> | null>;

  getThreadsForUser: (args: {
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<(AgentChatThreadDocument & { lastMessageAt: Date | null })[]>;

  getLastMessageAtForThread: (args: {
    threadId: string;
    workspaceId: string;
  }) => Promise<Date | null>;

  addMessage: (args: {
    threadId: string;
    uiMessage: Omit<ExtendedUIMessage, 'id'>;
    uiMessageParts?: UIMessagePart<UIDataTypes, UITools>[];
    agentId?: string;
    turnId?: string;
    id?: string;
    workspaceId: string;
  }) => Promise<AgentMessageDocument>;

  updateThreadUsage: (args: {
    threadId: string;
    workspaceId: string;
    streamUsage: ThreadUsageUpdate;
    totalCacheCreationTokens: number;
    contextWindowTokens: number;
    conversationSize: number;
  }) => Promise<void>;

  getMessagesForThread: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<AgentMessageDocument[]>;

  queueMessage: (args: {
    threadId: string;
    text: string;
    id?: string;
    fileAttachments?: AiChatFileAttachment[];
    workspaceId: string;
    userWorkspaceId: string;
  }) => Promise<AgentMessageDocument>;

  getQueuedMessages: (args: {
    threadId: string;
    workspaceId: string;
  }) => Promise<AgentMessageDocument[]>;

  findQueuedMessage: (args: {
    messageId: string;
    workspaceId: string;
  }) => Promise<AgentMessageDocument | null>;

  deleteQueuedMessage: (args: {
    messageId: string;
    workspaceId: string;
  }) => Promise<boolean>;

  promoteQueuedMessage: (args: {
    messageId: string;
    threadId: string;
    workspaceId: string;
  }) => Promise<string | null>;

  updateThreadTitle: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
    title: string;
  }) => Promise<AgentChatThreadDocument>;

  archiveThread: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<AgentChatThreadDocument>;

  unarchiveThread: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<AgentChatThreadDocument>;

  hardDeleteThread: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<void>;

  notifyThreadActivityUpdated: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<void>;

  notifyThreadUsageUpdated: (args: {
    threadId: string;
    userWorkspaceId: string;
    workspaceId: string;
  }) => Promise<void>;

  generateTitleIfNeeded: (args: {
    threadId: string;
    messageContent: string;
    workspaceId: string;
  }) => Promise<string | null>;
};

export function createAgentChatService(
  deps: AgentChatServiceDeps,
): AgentChatService {
  const {
    findThread,
    findThreads,
    insertThread,
    updateThread,
    deleteThread,
    insertTurn,
    deleteTurn,
    findMessages,
    findMessage,
    insertMessage,
    updateMessage,
    deleteMessage,
    insertMessageParts,
    findFilesByIds,
    getLastMessageAt,
    getRankedThreadIds,
    broadcast,
    titleGenerationService,
  } = deps;

  async function broadcastThreadUpdated(
    thread: AgentChatThreadDocument,
    updatedFields: (keyof AgentChatThreadDTO)[],
    userWorkspaceId: string,
  ): Promise<void> {
    const lastMessageAt = await getLastMessageAt(
      thread.workspaceId,
      thread.id,
    );

    await broadcast(thread.workspaceId, [
      {
        type: 'updated',
        entityName: 'agentChatThread',
        recordId: thread.id,
        recipientUserWorkspaceIds: [userWorkspaceId],
        properties: {
          updatedFields,
          after: serializeThreadForBroadcast(thread, lastMessageAt),
        },
      },
    ]);
  }

  const service: AgentChatService = {
    async createThread({ userWorkspaceId, workspaceId }) {
      const savedThread = await insertThread(workspaceId, { userWorkspaceId });

      await broadcast(workspaceId, [
        {
          type: 'created',
          entityName: 'agentChatThread',
          recordId: savedThread.id,
          recipientUserWorkspaceIds: [userWorkspaceId],
          properties: {
            after: serializeThreadForBroadcast(savedThread, null),
          },
        },
      ]);

      return savedThread;
    },

    async getThreadById({ threadId, userWorkspaceId, workspaceId }) {
      const thread = await findThread(workspaceId, {
        id: threadId,
        userWorkspaceId,
      });

      if (!thread) {
        throw new Error('THREAD_NOT_FOUND: Thread not found');
      }

      return thread;
    },

    async getThreadStatusById({ threadId, workspaceId }) {
      return findThread(workspaceId, { id: threadId });
    },

    async getThreadsForUser({ userWorkspaceId, workspaceId }) {
      const rankedThreads = await getRankedThreadIds(
        workspaceId,
        userWorkspaceId,
      );

      if (rankedThreads.length === 0) {
        return [];
      }

      const rankedIds = rankedThreads.map((t) => t.id);

      const threads = await findThreads(workspaceId, { userWorkspaceId });
      const threadById = new Map(threads.map((t) => [t.id, t]));

      return rankedThreads.flatMap((rankedThread) => {
        const thread = threadById.get(rankedThread.id);

        return thread
          ? [{ ...thread, lastMessageAt: rankedThread.lastMessageAt ?? null }]
          : [];
      });
    },

    async getLastMessageAtForThread({ threadId, workspaceId }) {
      return getLastMessageAt(workspaceId, threadId);
    },

    async addMessage({ threadId, uiMessage, agentId, turnId, id, workspaceId }) {
      let actualTurnId = turnId;

      if (!actualTurnId) {
        const turn = await insertTurn(workspaceId, {
          threadId,
          agentId: agentId ?? null,
        });
        actualTurnId = turn.id;
      }

      const messageValues: Partial<AgentMessageDocument> = {
        ...(id ? { id } : {}),
        threadId,
        turnId: actualTurnId,
        role: uiMessage.role as AgentMessageRole,
        agentId: agentId ?? null,
        processedAt: new Date(),
      };

      const inserted = await insertMessage(workspaceId, messageValues);
      const savedMessageId = id ?? inserted.id;

      if (uiMessage.parts && uiMessage.parts.length > 0) {
        const dbParts = mapUIMessagePartsToDBParts(
          uiMessage.parts,
          savedMessageId,
          workspaceId,
        );
        await insertMessageParts(workspaceId, dbParts);
      }

      return {
        id: savedMessageId,
        threadId,
        turnId: actualTurnId,
        role: uiMessage.role as AgentMessageRole,
        agentId: agentId ?? null,
        processedAt: new Date(),
        workspaceId,
      } as AgentMessageDocument;
    },

    async updateThreadUsage({
      threadId,
      workspaceId,
      streamUsage,
      totalCacheCreationTokens,
      contextWindowTokens,
      conversationSize,
    }) {
      // PORT-NOTE: TypeORM increment expressions replaced with Mongo $inc semantics
      // via the updateThread helper which must handle increments server-side.
      await updateThread(workspaceId, { id: threadId }, {
        $inc: {
          totalInputTokens: streamUsage.inputTokens,
          totalOutputTokens: streamUsage.outputTokens,
          totalInputCredits: streamUsage.inputCredits,
          totalOutputCredits: streamUsage.outputCredits,
          totalCacheReadTokens: streamUsage.cacheReadTokens,
          totalCacheCreationTokens,
        },
        contextWindowTokens,
        conversationSize,
      } as unknown as Partial<AgentChatThreadDocument>);
    },

    async getMessagesForThread({ threadId, userWorkspaceId, workspaceId }) {
      await service.getThreadById({ threadId, userWorkspaceId, workspaceId });

      return findMessages(workspaceId, { threadId }, {
        sort: { processedAt: 1 },
        relations: ['parts', 'parts.file'],
      });
    },

    async queueMessage({ threadId, text, id, fileAttachments, workspaceId, userWorkspaceId }) {
      const messageValues: Partial<AgentMessageDocument> = {
        ...(id ? { id } : {}),
        threadId,
        turnId: null,
        role: AgentMessageRole.USER,
        agentId: null,
        status: AgentMessageStatus.QUEUED,
      };

      const inserted = await insertMessage(workspaceId, messageValues);
      const savedMessageId = id ?? inserted.id;

      const validFiles =
        fileAttachments && fileAttachments.length > 0
          ? await findFilesByIds(
              workspaceId,
              fileAttachments.map((a) => a.id),
            )
          : [];

      const validFileIds = new Set(validFiles.map((f) => f.id));

      const parts = [
        {
          messageId: savedMessageId,
          orderIndex: 0,
          type: 'text',
          textContent: text,
        },
        ...(fileAttachments ?? [])
          .filter((a) => validFileIds.has(a.id))
          .map((a, index) => ({
            messageId: savedMessageId,
            orderIndex: index + 1,
            type: 'file',
            fileId: a.id,
            fileFilename: a.filename,
          })),
      ];

      await insertMessageParts(workspaceId, parts);

      await service.notifyThreadActivityUpdated({ threadId, userWorkspaceId, workspaceId });

      return {
        id: savedMessageId,
        ...messageValues,
        workspaceId,
      } as AgentMessageDocument;
    },

    async getQueuedMessages({ threadId, workspaceId }) {
      return findMessages(workspaceId, { threadId, status: AgentMessageStatus.QUEUED }, {
        sort: { createdAt: 1 },
        relations: ['parts', 'parts.file'],
      });
    },

    async findQueuedMessage({ messageId, workspaceId }) {
      return findMessage(workspaceId, { id: messageId, status: AgentMessageStatus.QUEUED });
    },

    async deleteQueuedMessage({ messageId, workspaceId }) {
      const result = await deleteMessage(workspaceId, {
        id: messageId,
        status: AgentMessageStatus.QUEUED,
      });

      return (result.deletedCount ?? 0) > 0;
    },

    async promoteQueuedMessage({ messageId, threadId, workspaceId }) {
      const turn = await insertTurn(workspaceId, { threadId, agentId: null });
      const savedTurnId = turn.id;

      const result = await updateMessage(
        workspaceId,
        { id: messageId, threadId, status: AgentMessageStatus.QUEUED },
        {
          status: AgentMessageStatus.SENT,
          processedAt: new Date(),
          turnId: savedTurnId,
        },
      );

      if ((result.modifiedCount ?? 0) === 0) {
        await deleteTurn(workspaceId, { id: savedTurnId });

        return null;
      }

      return savedTurnId;
    },

    async updateThreadTitle({ threadId, userWorkspaceId, workspaceId, title }) {
      const trimmed = title.trim();

      if (trimmed.length === 0) {
        throw new Error('INVALID_CHAT_THREAD_TITLE: Chat thread title cannot be empty');
      }

      const result = await updateThread(
        workspaceId,
        { id: threadId, userWorkspaceId },
        { title: trimmed },
      );

      if (result.modifiedCount === 0) {
        throw new Error('THREAD_NOT_FOUND: Thread not found');
      }

      const updated = await service.getThreadById({ threadId, userWorkspaceId, workspaceId });

      await broadcastThreadUpdated(updated, ['title'], userWorkspaceId);

      return updated;
    },

    async archiveThread({ threadId, userWorkspaceId, workspaceId }) {
      const thread = await service.getThreadById({ threadId, userWorkspaceId, workspaceId });

      if (thread.deletedAt) {
        return thread;
      }

      const deletedAt = new Date();

      const result = await updateThread(
        workspaceId,
        { id: threadId, userWorkspaceId, deletedAt: null },
        { deletedAt, activeStreamId: null },
      );

      if ((result.modifiedCount ?? 0) === 0) {
        return thread;
      }

      thread.deletedAt = deletedAt;
      thread.activeStreamId = null;

      await broadcastThreadUpdated(thread, ['deletedAt'], userWorkspaceId);

      return thread;
    },

    async unarchiveThread({ threadId, userWorkspaceId, workspaceId }) {
      const thread = await service.getThreadById({ threadId, userWorkspaceId, workspaceId });

      if (!thread.deletedAt) {
        return thread;
      }

      const result = await updateThread(
        workspaceId,
        { id: threadId, userWorkspaceId },
        { deletedAt: null },
      );

      if ((result.modifiedCount ?? 0) === 0) {
        return thread;
      }

      thread.deletedAt = null;

      await broadcastThreadUpdated(thread, ['deletedAt'], userWorkspaceId);

      return thread;
    },

    async hardDeleteThread({ threadId, userWorkspaceId, workspaceId }) {
      const thread = await findThread(workspaceId, {
        id: threadId,
        userWorkspaceId,
      });

      if (!thread) {
        throw new Error('THREAD_NOT_FOUND: Thread not found');
      }

      const result = await deleteThread(workspaceId, { id: threadId, userWorkspaceId });

      if ((result.deletedCount ?? 0) === 0) {
        console.warn(
          `hardDeleteThread: thread ${threadId} vanished between fetch and delete`,
        );

        return;
      }

      await broadcast(thread.workspaceId, [
        {
          type: 'deleted',
          entityName: 'agentChatThread',
          recordId: threadId,
          recipientUserWorkspaceIds: [userWorkspaceId],
          properties: {
            before: serializeThreadForBroadcast(thread, null),
          },
        },
      ]);
    },

    async notifyThreadActivityUpdated({ threadId, userWorkspaceId, workspaceId }) {
      const thread = await service.getThreadById({ threadId, userWorkspaceId, workspaceId });

      await broadcastThreadUpdated(thread, ['lastMessageAt'], userWorkspaceId);
    },

    async notifyThreadUsageUpdated({ threadId, userWorkspaceId, workspaceId }) {
      const thread = await service.getThreadById({ threadId, userWorkspaceId, workspaceId });

      await broadcastThreadUpdated(
        thread,
        [
          'totalInputTokens',
          'totalOutputTokens',
          'totalInputCredits',
          'totalOutputCredits',
          'conversationSize',
          'contextWindowTokens',
        ],
        userWorkspaceId,
      );
    },

    async generateTitleIfNeeded({ threadId, messageContent, workspaceId }) {
      const thread = await findThread(workspaceId, { id: threadId });

      if (!thread || thread.title || !messageContent) {
        return null;
      }

      const title = await titleGenerationService.generateThreadTitle(
        messageContent,
        workspaceId,
        thread.userWorkspaceId,
      );

      await updateThread(workspaceId, { id: threadId }, { title });

      await broadcastThreadUpdated(
        { ...thread, title },
        ['title'],
        thread.userWorkspaceId,
      );

      return title;
    },
  };

  return service;
}
