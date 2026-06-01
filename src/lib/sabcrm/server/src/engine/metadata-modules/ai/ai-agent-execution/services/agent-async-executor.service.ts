import "server-only";

// PORT-NOTE: Ported from twenty-server AgentAsyncExecutorService.
// NestJS DI removed; becomes a plain exported async function.
// TypeORM Repository replaced with Mongo collection accessors.
// Service dependencies (AiModelRegistryService, ToolRegistryService, etc.)
// are injected as callbacks/interfaces so callers can wire them without NestJS.
//
// The AI SDK (generateText, Output, etc.) is used directly — same as the original.
// BillingUsageService / AiBillingService callbacks are provided via `deps`.

import {
  generateText,
  jsonSchema,
  type LanguageModelUsage,
  Output,
  stepCountIs,
  type ToolSet,
} from "ai";

import type { AgentExecutionResult } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/types/agent-execution-result.type";
import { WORKFLOW_AGENT_REGISTRY_TOOL_CATEGORIES } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/constants/workflow-agent-registry-tool-categories.const";

// ---------------------------------------------------------------------------
// Supporting types (mirrors twenty-shared/types and server internal types)
// ---------------------------------------------------------------------------

export type ActorMetadata = {
  workspaceMemberId?: string;
  [key: string]: unknown;
};

export type AgentEntity = {
  id: string;
  workspaceId: string;
  modelId: string;
  prompt: string;
  modelConfiguration?: {
    webSearch?: { enabled?: boolean };
    twitterSearch?: { enabled?: boolean };
  };
  responseFormat?: { type: string; schema?: object };
};

export type RegisteredModel = {
  model: Parameters<typeof generateText>[0]["model"];
  modelId: string;
};

export type ToolProviderContext = {
  workspaceId: string;
  roleId: string;
  rolePermissionConfig: { unionOf: string[] };
  authContext?: unknown;
  actorContext?: ActorMetadata;
  userId?: string;
  userWorkspaceId?: string;
};

export type AgentAsyncExecutorDeps = {
  /** Resolves/validates the registered AI model for an agent. */
  resolveModelForAgent: (agent: AgentEntity | null) => Promise<RegisteredModel>;
  /** Validates model availability against workspace config. */
  validateModelAvailability?: (
    modelId: string,
    workspace: { id: string },
  ) => void;
  /** Fetches the workspace record by id. */
  findWorkspace?: (
    workspaceId: string,
  ) => Promise<{ id: string } | null | undefined>;
  /** Returns the roleId assigned to an agent via the role-target table. */
  getAgentRoleId?: (
    agentId: string,
    workspaceId: string,
  ) => Promise<string | undefined>;
  /** Returns tool set for the given categories. */
  getToolsByCategories?: (
    ctx: ToolProviderContext,
    opts: { categories: string[]; wrapWithErrorContext: boolean },
  ) => Promise<ToolSet>;
  /** Binds native model tools (web search, etc.). */
  bindNativeTools?: (
    model: RegisteredModel,
    options: { webSearch: boolean; twitterSearch: boolean },
  ) => ToolSet;
  /** Returns provider options for reasoning models. */
  getReasoningProviderOptions?: (model: RegisteredModel) => object;
  /** Asserts billing credits are available; throws if not. */
  assertAvailableCredits: (workspaceId: string) => Promise<void>;
  /** Decrements credits after each step; returns whether credits exhausted. */
  decrementCredits: (
    modelId: string,
    step: { usage: LanguageModelUsage; cacheCreationTokens: number },
    workspaceId: string,
  ) => Promise<{ hasNoMoreAvailableCredits: boolean }>;
  /** Extracts cache-creation tokens from provider metadata. */
  extractCacheCreationTokens?: (providerMetadata: unknown) => number;
  /** Extracts accumulated cache-creation tokens from all steps. */
  extractCacheCreationTokensFromSteps?: (steps: unknown[]) => number;
  /** Counts native web-search calls across steps. */
  countNativeWebSearchCallsFromSteps?: (steps: unknown[]) => number;
  /** Merges two LanguageModelUsage objects. */
  mergeLanguageModelUsage?: (
    a: LanguageModelUsage,
    b: LanguageModelUsage,
  ) => LanguageModelUsage;
  /** Repairs a malformed tool call. */
  repairToolCall?: (params: {
    toolCall: unknown;
    tools: ToolSet;
    inputSchema: unknown;
    error: unknown;
    model: RegisteredModel["model"];
  }) => Promise<unknown>;
  /** Emits AI token usage telemetry. */
  emitAiTokenUsageEvent?: (
    workspaceId: string,
    creditsUsedMicro: number,
    totalTokens: number,
    modelId: string,
    operationType: string,
    agentId: string | null,
    userWorkspaceId?: string | null,
  ) => Promise<void>;
  /** Bills native web-search calls. */
  billNativeWebSearchUsage?: (
    callCount: number,
    workspaceId: string,
    userWorkspaceId?: string | null,
  ) => Promise<void>;
  /** Calculates cost in dollars. */
  calculateCost?: (
    modelId: string,
    opts: { usage: LanguageModelUsage; cacheCreationTokens: number },
  ) => number;
  /** Converts dollars to billing credits. */
  convertDollarsToBillingCredits?: (dollars: number) => number;
  /** Telemetry config for AI SDK experimental_telemetry. */
  telemetryConfig?: object;
  /** System prompts. */
  systemPrompts?: {
    BASE: string;
    OUTPUT_GENERATOR: string;
  };
  /** Max agent steps. */
  maxSteps?: number;
};

export type AgentAsyncExecutorInput = {
  agent: AgentEntity | null;
  userPrompt: string;
  actorContext?: ActorMetadata;
  authContext?: unknown;
  workspaceId: string;
  userWorkspaceId?: string | null;
  operationType?: string;
};

const EMPTY_USAGE: LanguageModelUsage = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  inputTokenDetails: {
    noCacheTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
  outputTokenDetails: {
    textTokens: 0,
    reasoningTokens: 0,
  },
};

const DEFAULT_SYSTEM_PROMPTS = {
  BASE: "You are a helpful AI assistant.",
  OUTPUT_GENERATOR: "Generate structured output based on the execution results.",
};

const DEFAULT_MAX_STEPS = 10;
const DEFAULT_OP_TYPE = "AI_WORKFLOW_TOKEN";

/**
 * Executes an AI agent asynchronously.
 *
 * Agent execution within workflows uses registry tools plus native model tools.
 * Workflow registry tools are intentionally excluded to avoid circular
 * dependencies and recursive workflow execution.
 *
 * All service dependencies are supplied via the `deps` object.
 */
export async function executeAgent(
  input: AgentAsyncExecutorInput,
  deps: AgentAsyncExecutorDeps,
): Promise<AgentExecutionResult> {
  const {
    agent,
    userPrompt,
    actorContext,
    authContext,
    workspaceId,
    userWorkspaceId,
    operationType = DEFAULT_OP_TYPE,
  } = input;

  await deps.assertAvailableCredits(workspaceId);

  let accumulatedUsage: LanguageModelUsage = EMPTY_USAGE;
  let cacheCreationTokens = 0;
  let nativeWebSearchCallCount = 0;

  const systemPrompts = deps.systemPrompts ?? DEFAULT_SYSTEM_PROMPTS;
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  const telemetry = deps.telemetryConfig ?? {};

  try {
    if (agent && deps.validateModelAvailability && deps.findWorkspace) {
      const workspace = await deps.findWorkspace(agent.workspaceId);
      if (workspace) {
        deps.validateModelAvailability(agent.modelId, workspace);
      }
    }

    const registeredModel = await deps.resolveModelForAgent(agent);

    let tools: ToolSet = {};
    let providerOptions: object = {};

    if (agent) {
      const agentRoleId = deps.getAgentRoleId
        ? await deps.getAgentRoleId(agent.id, agent.workspaceId)
        : undefined;

      const nativeModelToolOptions = {
        webSearch: agent.modelConfiguration?.webSearch?.enabled === true,
        twitterSearch:
          agent.modelConfiguration?.twitterSearch?.enabled === true,
      };

      let registryTools: ToolSet = {};

      if (agentRoleId !== undefined && deps.getToolsByCategories) {
        const agentRolePermissionConfig = { unionOf: [agentRoleId] };
        const toolProviderContext: ToolProviderContext = {
          workspaceId: agent.workspaceId,
          roleId: agentRoleId,
          rolePermissionConfig: agentRolePermissionConfig,
          authContext,
          actorContext,
          // isUserAuthContext check omitted — caller should pass userId/userWorkspaceId when present
          userId: undefined,
          userWorkspaceId: undefined,
        };

        registryTools = await deps.getToolsByCategories(toolProviderContext, {
          categories: WORKFLOW_AGENT_REGISTRY_TOOL_CATEGORIES,
          wrapWithErrorContext: false,
        });
      }

      const nativeTools = deps.bindNativeTools
        ? deps.bindNativeTools(registeredModel, nativeModelToolOptions)
        : {};

      tools = { ...registryTools, ...nativeTools };

      providerOptions = deps.getReasoningProviderOptions
        ? deps.getReasoningProviderOptions(registeredModel)
        : {};
    }

    let hasNoMoreAvailableCredits = false;

    const textResponse = await generateText({
      system: `${systemPrompts.BASE}\n\n${agent ? agent.prompt : ""}`,
      tools,
      model: registeredModel.model,
      prompt: userPrompt,
      stopWhen: (step) =>
        stepCountIs(maxSteps)(step) || hasNoMoreAvailableCredits,
      providerOptions,
      experimental_telemetry: telemetry,
      onStepFinish: async (step) => {
        const stepCacheCreationTokens = deps.extractCacheCreationTokens
          ? deps.extractCacheCreationTokens(step.providerMetadata)
          : 0;

        const { hasNoMoreAvailableCredits: stepExhausted } =
          await deps.decrementCredits(
            registeredModel.modelId,
            { usage: step.usage, cacheCreationTokens: stepCacheCreationTokens },
            workspaceId,
          );

        if (stepExhausted) {
          hasNoMoreAvailableCredits = true;
        }
      },
      experimental_repairToolCall: deps.repairToolCall
        ? async ({ toolCall, tools: toolsForRepair, inputSchema, error }) => {
            return deps.repairToolCall!({
              toolCall,
              tools: toolsForRepair,
              inputSchema,
              error,
              model: registeredModel.model,
            });
          }
        : undefined,
    });

    accumulatedUsage = textResponse.usage;
    cacheCreationTokens = deps.extractCacheCreationTokensFromSteps
      ? deps.extractCacheCreationTokensFromSteps(textResponse.steps)
      : 0;
    nativeWebSearchCallCount = deps.countNativeWebSearchCallsFromSteps
      ? deps.countNativeWebSearchCallsFromSteps(textResponse.steps)
      : 0;

    const agentSchema =
      agent?.responseFormat?.type === "json"
        ? agent.responseFormat.schema
        : undefined;

    if (!agentSchema) {
      return {
        result: { response: textResponse.text },
        usage: textResponse.usage,
        cacheCreationTokens,
        nativeWebSearchCallCount,
        hasNoMoreAvailableCredits,
      };
    }

    // Structured output pass
    const structuredResult = await generateText({
      system: systemPrompts.OUTPUT_GENERATOR,
      model: registeredModel.model,
      prompt: `Based on the following execution results, generate the structured output according to the schema:

               Execution Results: ${textResponse.text}

               Please generate the structured output based on the execution results and context above.`,
      output: Output.object({ schema: jsonSchema(agentSchema) }),
      experimental_telemetry: telemetry,
      onStepFinish: async (step) => {
        const stepCacheCreationTokens = deps.extractCacheCreationTokens
          ? deps.extractCacheCreationTokens(step.providerMetadata)
          : 0;

        const { hasNoMoreAvailableCredits: stepExhausted } =
          await deps.decrementCredits(
            registeredModel.modelId,
            { usage: step.usage, cacheCreationTokens: stepCacheCreationTokens },
            workspaceId,
          );

        if (stepExhausted) {
          hasNoMoreAvailableCredits = true;
        }
      },
    });

    accumulatedUsage = deps.mergeLanguageModelUsage
      ? deps.mergeLanguageModelUsage(textResponse.usage, structuredResult.usage)
      : textResponse.usage;

    if (structuredResult.output == null) {
      throw new Error(
        "Failed to generate structured output from execution results",
      );
    }

    return {
      result: structuredResult.output as object,
      usage: accumulatedUsage,
      cacheCreationTokens,
      nativeWebSearchCallCount,
      hasNoMoreAvailableCredits,
    };
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Agent execution failed");
  } finally {
    const modelId = agent?.modelId ?? "auto";
    const costInDollars =
      deps.calculateCost?.(modelId, {
        usage: accumulatedUsage,
        cacheCreationTokens,
      }) ?? 0;
    const creditsUsedMicro = Math.round(
      deps.convertDollarsToBillingCredits?.(costInDollars) ?? 0,
    );
    const totalTokens =
      (accumulatedUsage.inputTokens ?? 0) +
      (accumulatedUsage.outputTokens ?? 0) +
      cacheCreationTokens;

    if (deps.emitAiTokenUsageEvent) {
      void deps.emitAiTokenUsageEvent(
        workspaceId,
        creditsUsedMicro,
        totalTokens,
        modelId,
        operationType,
        agent?.id ?? null,
        userWorkspaceId,
      );
    }

    if (deps.billNativeWebSearchUsage) {
      void deps.billNativeWebSearchUsage(
        nativeWebSearchCallCount,
        workspaceId,
        userWorkspaceId,
      );
    }
  }
}
