import "server-only";

import {
  convertToModelMessages,
  type LanguageModelUsage,
  stepCountIs,
  type StepResult,
  streamText,
  type SystemModelMessage,
  type ToolSet,
  type UIDataTypes,
  type UIMessage,
  type UITools,
} from 'ai';
import type { ProviderOptions } from '@ai-sdk/provider-utils';

import type { BrowsingContextType } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/browsingContext.type';
import type { AiModelConfig } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-model-config.type';
import { AI_TELEMETRY_CONFIG } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import {
  extractCacheCreationTokens,
  extractCacheCreationTokensFromSteps,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/extract-cache-creation-tokens.util';
import { convertDollarsToBillingCredits } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/convert-dollars-to-billing-credits.util';
import { countNativeWebSearchCallsFromSteps } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/count-native-web-search-calls-from-steps.util';
import { MessagePruningService } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/services/message-pruning.service';
import {
  getCacheProviderOptions,
  getCallLevelCacheProviderOptions,
  injectCacheBreakpoint,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/utils/inject-cache-breakpoint.util';
import {
  extractCodeInterpreterFiles,
  type ExtractedFile,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/utils/extract-code-interpreter-files.util';

// PORT-NOTE: NestJS @Injectable() and all NestJS-specific decorators removed.
// Deps that required DI (ToolRegistryService, SkillService, etc.) are
// provided as plain callback functions via ChatExecutionServiceDeps.
// MetricsService is kept as an optional callback for observability.

export type CodeExecutionStreamEmitter = (data: unknown) => void;

export type ChatExecutionOptions = {
  workspace: { id: string; smartModel?: string; aiAdditionalInstructions?: string };
  userWorkspaceId: string;
  messages: UIMessage<unknown, UIDataTypes, UITools>[];
  browsingContext: BrowsingContextType | null;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
  onCompaction?: () => void;
  modelId?: string;
  abortSignal?: AbortSignal;
  conversationSizeTokens: number;
};

export type ChatExecutionResult = {
  stream: ReturnType<typeof streamText>;
  modelConfig: AiModelConfig;
  hasNoMoreAvailableCredits: () => boolean;
};

export type ChatExecutionServiceDeps = {
  buildToolIndex: (
    workspaceId: string,
    roleId: string,
    userContext: { userId: string; userWorkspaceId: string },
  ) => Promise<unknown[]>;
  getToolsByName: (
    toolNames: string[],
    context: unknown,
    options?: { compactOutput?: boolean },
  ) => Promise<ToolSet>;
  buildUserAndAgentActorContext: (
    userWorkspaceId: string,
    workspaceId: string,
  ) => Promise<{
    actorContext: unknown;
    roleId: string;
    userId: string;
    userContext: unknown;
  }>;
  findAllFlatSkills: (workspaceId: string) => Promise<Array<{ name: string; description?: string; label: string }>>;
  findFlatSkillsByNames: (names: string[], workspaceId: string) => Promise<unknown[]>;
  validateModelAvailability: (modelId: string | undefined, workspace: { id: string }) => void;
  resolveModelForAgent: (args: { modelId: string | undefined }) => Promise<{
    model: Parameters<typeof streamText>[0]['model'];
    modelId: string;
    sdkPackage: string;
  }>;
  getEffectiveModelConfig: (modelId: string) => AiModelConfig;
  getNativeTools: (registeredModel: { model: unknown; modelId: string; sdkPackage: string }) => ToolSet;
  createLearnToolsTool: (context: unknown) => ToolSet[string];
  createExecuteToolTool: (context: unknown, options: { compactOutput: boolean }) => ToolSet[string];
  createLoadSkillTool: (
    findSkills: (names: string[]) => Promise<unknown[]>,
    getAllSkillNames: () => Promise<string[]>,
  ) => ToolSet[string];
  buildSystemPrompt: (
    toolCatalog: unknown[],
    skillCatalog: unknown[],
    preloadedToolNames: string[],
    storedFiles: Array<{ filename: string; fileId: string }>,
    workspaceInstructions: string | undefined,
    userContext: unknown,
  ) => string;
  buildWorkspaceURL: (args: { workspace: { id: string }; pathname: string }) => string;
  isCodeInterpreterEnabled: () => boolean;
  decrementAndCheckAvailableCredits: (
    modelId: string,
    usage: { usage: LanguageModelUsage; cacheCreationTokens: number },
    workspaceId: string,
  ) => Promise<{ hasNoMoreAvailableCredits: boolean }>;
  calculateCost: (modelId: string, usage: { usage: LanguageModelUsage; cacheCreationTokens: number }) => number;
  emitAiTokenUsageEvent: (
    workspaceId: string,
    creditsUsedMicro: number,
    totalTokens: number,
    modelId: string,
    operationType: string,
    agentId: null,
    userWorkspaceId: string,
  ) => Promise<void>;
  billNativeWebSearchUsage: (count: number, workspaceId: string, userWorkspaceId: string) => Promise<void>;
  repairToolCall: (args: {
    toolCall: unknown;
    tools: ToolSet;
    inputSchema: unknown;
    error: unknown;
    model: unknown;
    billingContext: unknown;
  }) => Promise<unknown>;
  recordMetric?: (key: string, value: number, unit?: string, attributes?: Record<string, string>) => void;
  captureException?: (error: unknown) => void;
  messagePruningService: MessagePruningService;
  AI_CHAT_TOOL_NAMES_TO_PRELOAD: string[];
  AGENT_MAX_STEPS: number;
  LEARN_TOOLS_TOOL_NAME: string;
  EXECUTE_TOOL_TOOL_NAME: string;
  LOAD_SKILL_TOOL_NAME: string;
};

export type ChatExecutionService = {
  streamChat: (options: ChatExecutionOptions) => Promise<ChatExecutionResult>;
};

export function createChatExecutionService(
  deps: ChatExecutionServiceDeps,
): ChatExecutionService {
  const {
    buildToolIndex,
    getToolsByName,
    buildUserAndAgentActorContext,
    findAllFlatSkills,
    findFlatSkillsByNames,
    validateModelAvailability,
    resolveModelForAgent,
    getEffectiveModelConfig,
    getNativeTools,
    createLearnToolsTool,
    createExecuteToolTool,
    createLoadSkillTool,
    buildSystemPrompt,
    buildWorkspaceURL,
    isCodeInterpreterEnabled,
    decrementAndCheckAvailableCredits,
    calculateCost,
    emitAiTokenUsageEvent,
    billNativeWebSearchUsage,
    repairToolCall,
    recordMetric,
    captureException,
    messagePruningService,
    AI_CHAT_TOOL_NAMES_TO_PRELOAD,
    AGENT_MAX_STEPS,
    LEARN_TOOLS_TOOL_NAME,
    EXECUTE_TOOL_TOOL_NAME,
    LOAD_SKILL_TOOL_NAME,
  } = deps;

  function injectBrowsingContextIntoLastUserMessage(
    messages: UIMessage[],
    contextString: string,
  ): UIMessage[] {
    const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user');

    if (lastUserIndex === -1) {
      return messages;
    }

    const lastUserMessage = messages[lastUserIndex];
    const browsingContextPart = {
      type: 'text' as const,
      text: `<browsing_context note="Only use this if the user explicitly asks about the current page, record, or view. Do not call any tools based on this context.">\n${contextString}\n</browsing_context>`,
    };

    return [
      ...messages.slice(0, lastUserIndex),
      {
        ...lastUserMessage,
        parts: [...lastUserMessage.parts, browsingContextPart],
      },
      ...messages.slice(lastUserIndex + 1),
    ];
  }

  function buildContextFromBrowsingContext(
    workspace: { id: string },
    browsingContext: BrowsingContextType,
  ): string {
    if (browsingContext.type === 'recordPage') {
      const { objectNameSingular, recordId, pageLayoutId, activeTabId } =
        browsingContext;

      const resourceUrl = buildWorkspaceURL({
        workspace,
        pathname: `/objects/${objectNameSingular}/${recordId}`,
      });

      let context = `The user is viewing a ${objectNameSingular} record (ID: ${recordId}, URL: ${resourceUrl}). Use tools to fetch record details if needed.`;

      if (pageLayoutId != null) {
        context += `\nPage layout ID: ${pageLayoutId}.`;
      }

      if (activeTabId != null) {
        context += `\nActive tab ID: ${activeTabId}.`;
      }

      return context;
    }

    if (browsingContext.type === 'listView') {
      const { objectNameSingular, viewId, viewName, filterDescriptions } =
        browsingContext;

      let context = `The user is viewing a list of ${objectNameSingular} records in a view called "${viewName}" (viewId: ${viewId}).`;

      if (filterDescriptions.length > 0) {
        context += `\nFilters applied: ${filterDescriptions.join(', ')}`;
      }

      context += `\nUse get_view_query_parameters tool with this viewId to get the exact filter/sort parameters for querying records.`;

      return context;
    }

    return '';
  }

  async function storeExtractedFiles(
    files: ExtractedFile[],
    _workspaceId: string,
  ): Promise<Array<{ filename: string; fileId: string }>> {
    return files.map((file) => ({
      filename: file.filename,
      fileId: file.fileId,
    }));
  }

  return {
    async streamChat({
      workspace,
      userWorkspaceId,
      messages,
      browsingContext,
      onCodeExecutionUpdate,
      onCompaction,
      modelId,
      abortSignal,
      conversationSizeTokens,
    }): Promise<ChatExecutionResult> {
      const { actorContext, roleId, userId, userContext } =
        await buildUserAndAgentActorContext(userWorkspaceId, workspace.id);

      const toolContext = {
        workspaceId: workspace.id,
        roleId,
        actorContext,
        userId,
        userWorkspaceId,
        onCodeExecutionUpdate,
      };

      const toolCatalog = await buildToolIndex(workspace.id, roleId, {
        userId,
        userWorkspaceId,
      });

      const skillCatalog = await findAllFlatSkills(workspace.id);

      const preloadedTools = await getToolsByName(
        AI_CHAT_TOOL_NAMES_TO_PRELOAD,
        toolContext,
        { compactOutput: true },
      );

      const resolvedModelId = modelId ?? workspace.smartModel;

      validateModelAvailability(resolvedModelId, workspace);

      const registeredModel = await resolveModelForAgent({
        modelId: resolvedModelId,
      });

      const modelConfig = getEffectiveModelConfig(registeredModel.modelId);

      const nativeTools = getNativeTools(registeredModel);

      const directTools: ToolSet = {
        ...preloadedTools,
        ...nativeTools,
      };

      const preloadedToolNames = [
        ...Object.keys(preloadedTools),
        ...Object.keys(nativeTools),
      ];

      const activeTools: ToolSet = {
        ...directTools,
        [LEARN_TOOLS_TOOL_NAME]: createLearnToolsTool(toolContext),
        [EXECUTE_TOOL_TOOL_NAME]: createExecuteToolTool(toolContext, { compactOutput: true }),
        [LOAD_SKILL_TOOL_NAME]: createLoadSkillTool(
          (skillNames) =>
            findFlatSkillsByNames(skillNames, workspace.id),
          async () => {
            const allSkills = await findAllFlatSkills(workspace.id);

            return allSkills.map((skill) => skill.name);
          },
        ),
      };

      let processedMessages: UIMessage[] = messages;

      let storedFiles: Array<{ filename: string; fileId: string }> = [];

      if (isCodeInterpreterEnabled()) {
        const extracted = extractCodeInterpreterFiles(messages);

        processedMessages = extracted.processedMessages;

        if (extracted.extractedFiles.length > 0) {
          storedFiles = await storeExtractedFiles(
            extracted.extractedFiles,
            workspace.id,
          );
        }
      }

      if (browsingContext != null) {
        const contextString = buildContextFromBrowsingContext(workspace, browsingContext);

        processedMessages = injectBrowsingContextIntoLastUserMessage(
          processedMessages,
          contextString,
        );
      }

      const systemPrompt = buildSystemPrompt(
        toolCatalog,
        skillCatalog,
        preloadedToolNames,
        storedFiles,
        workspace.aiAdditionalInstructions ?? undefined,
        userContext,
      );

      const systemMessage: SystemModelMessage = {
        role: 'system',
        content: systemPrompt,
        providerOptions: getCacheProviderOptions(registeredModel.sdkPackage) as ProviderOptions | undefined,
      };

      const rawModelMessages = await convertToModelMessages(processedMessages);

      const pruningResult =
        messagePruningService.pruneIfOverContextWindowLimit(
          rawModelMessages,
          modelConfig.contextWindowTokens,
          conversationSizeTokens,
        );

      if (pruningResult.isStillOverLimit) {
        throw new Error(
          'This conversation is too long for the model to process. Please start a new thread.',
        );
      }

      if (pruningResult.wasPruned) {
        onCompaction?.();
      }

      const modelMessages = pruningResult.messages;

      let hasNoMoreAvailableCredits = false;
      const streamStartedAt = performance.now();
      let stepStartedAt = streamStartedAt;
      let ttftRecorded = false;

      const emitTurnUsageEvent = async (steps: StepResult<ToolSet>[]) => {
        const usage = steps.reduce<LanguageModelUsage>(
          (acc, step) => ({
            inputTokens: (acc.inputTokens ?? 0) + (step.usage.inputTokens ?? 0),
            outputTokens: (acc.outputTokens ?? 0) + (step.usage.outputTokens ?? 0),
            totalTokens: (acc.totalTokens ?? 0) + (step.usage.totalTokens ?? 0),
            inputTokenDetails: {
              noCacheTokens:
                (acc.inputTokenDetails?.noCacheTokens ?? 0) +
                (step.usage.inputTokenDetails?.noCacheTokens ?? 0),
              cacheReadTokens:
                (acc.inputTokenDetails?.cacheReadTokens ?? 0) +
                (step.usage.inputTokenDetails?.cacheReadTokens ?? 0),
              cacheWriteTokens:
                (acc.inputTokenDetails?.cacheWriteTokens ?? 0) +
                (step.usage.inputTokenDetails?.cacheWriteTokens ?? 0),
            },
            outputTokenDetails: {
              textTokens:
                (acc.outputTokenDetails?.textTokens ?? 0) +
                (step.usage.outputTokenDetails?.textTokens ?? 0),
              reasoningTokens:
                (acc.outputTokenDetails?.reasoningTokens ?? 0) +
                (step.usage.outputTokenDetails?.reasoningTokens ?? 0),
            },
          }),
          {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            inputTokenDetails: { noCacheTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 },
            outputTokenDetails: { textTokens: 0, reasoningTokens: 0 },
          },
        );

        const cacheCreationTokens = extractCacheCreationTokensFromSteps(steps);
        const totalTokens =
          (usage.inputTokens ?? 0) +
          (usage.outputTokens ?? 0) +
          cacheCreationTokens;

        const costInDollars = calculateCost(registeredModel.modelId, {
          usage,
          cacheCreationTokens,
        });
        const creditsUsedMicro = Math.round(
          convertDollarsToBillingCredits(costInDollars),
        );

        await emitAiTokenUsageEvent(
          workspace.id,
          creditsUsedMicro,
          totalTokens,
          registeredModel.modelId,
          'AI_CHAT_TOKEN',
          null,
          userWorkspaceId,
        );

        void billNativeWebSearchUsage(
          countNativeWebSearchCallsFromSteps(steps),
          workspace.id,
          userWorkspaceId,
        );

        recordMetric?.('AiChatInputTokens', usage.inputTokens ?? 0, undefined, { model: registeredModel.modelId });
        recordMetric?.('AiChatOutputTokens', usage.outputTokens ?? 0, undefined, { model: registeredModel.modelId });
        recordMetric?.('AiChatCacheReadTokens', usage.inputTokenDetails?.cacheReadTokens ?? 0, undefined, { model: registeredModel.modelId });
        recordMetric?.('AiChatCacheWriteTokens', cacheCreationTokens, undefined, { model: registeredModel.modelId });
        recordMetric?.('AiChatTurnLatencyMs', performance.now() - streamStartedAt, 'ms', { model: registeredModel.modelId });
      };

      const stream = streamText({
        model: registeredModel.model as Parameters<typeof streamText>[0]['model'],
        messages: [systemMessage, ...modelMessages],
        tools: activeTools,
        abortSignal,
        stopWhen: (step) =>
          stepCountIs(AGENT_MAX_STEPS)(step) || hasNoMoreAvailableCredits,
        experimental_telemetry: AI_TELEMETRY_CONFIG,
        providerOptions: getCallLevelCacheProviderOptions(registeredModel.sdkPackage) as ProviderOptions | undefined,
        prepareStep: ({ messages: stepMessages }) => {
          stepStartedAt = performance.now();

          return {
            messages: injectCacheBreakpoint(stepMessages, registeredModel.sdkPackage),
          };
        },
        onChunk: ({ chunk }) => {
          if (
            !ttftRecorded &&
            (chunk.type === 'text-delta' || chunk.type === 'tool-call')
          ) {
            ttftRecorded = true;
            recordMetric?.('AiChatTtftMs', performance.now() - streamStartedAt, 'ms', { model: registeredModel.modelId });
          }
        },
        onStepFinish: async (step) => {
          recordMetric?.('AiChatStepLatencyMs', performance.now() - stepStartedAt, 'ms', { model: registeredModel.modelId });

          const { hasNoMoreAvailableCredits: stepHasNoMoreCredits } =
            await decrementAndCheckAvailableCredits(
              registeredModel.modelId,
              {
                usage: step.usage,
                cacheCreationTokens: extractCacheCreationTokens(
                  step.providerMetadata,
                ),
              },
              workspace.id,
            );

          if (stepHasNoMoreCredits) {
            hasNoMoreAvailableCredits = true;
          }
        },
        onAbort: async ({ steps }) => {
          await emitTurnUsageEvent(steps);
        },
        experimental_repairToolCall: async ({
          toolCall,
          tools: toolsForRepair,
          inputSchema,
          error,
        }) => {
          return repairToolCall({
            toolCall,
            tools: toolsForRepair,
            inputSchema,
            error,
            model: registeredModel.model,
            billingContext: {
              modelId: registeredModel.modelId,
              workspaceId: workspace.id,
              userWorkspaceId,
              operationType: 'AI_CHAT_TOKEN',
            },
          }) as ReturnType<typeof repairToolCall>;
        },
      });

      Promise.all([stream.usage, stream.steps])
        .then(async ([, steps]) => {
          await emitTurnUsageEvent(steps);
        })
        .catch((error) => {
          if ((error as { name?: string })?.name === 'AbortError') {
            return;
          }
          captureException?.(error);
        });

      return {
        stream,
        modelConfig,
        hasNoMoreAvailableCredits: () => hasNoMoreAvailableCredits,
      };
    },
  };
}
