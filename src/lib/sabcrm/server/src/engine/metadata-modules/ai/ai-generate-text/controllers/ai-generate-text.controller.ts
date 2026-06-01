import "server-only";

import { generateText } from 'ai';

import type { GenerateTextInput } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-generate-text/dtos/generate-text.input';

// PORT-NOTE: NestJS @Controller / @Post / @UseGuards / @UseFilters removed.
// Expose as a plain async function callable from a Next.js Route Handler or
// Server Action. Auth/billing guards must be applied by the caller.

export type GenerateTextWorkspaceContext = {
  id: string;
  fastModel?: string;
};

export type GenerateTextDeps = {
  getAvailableModels: () => unknown[];
  hasAvailableCreditsOrThrow: (workspaceId: string) => Promise<void>;
  validateModelAvailability: (
    modelId: string | undefined,
    workspace: GenerateTextWorkspaceContext,
  ) => void;
  resolveModelForAgent: (args: { modelId: string | undefined }) => Promise<{
    model: Parameters<typeof generateText>[0]['model'];
  }>;
  calculateAndBillUsage: (
    modelId: string,
    usage: {
      usage: Awaited<ReturnType<typeof generateText>>['usage'];
      cacheCreationTokens: number;
    },
    workspaceId: string,
    operationType: string,
    agentId: null,
    userWorkspaceId: string,
  ) => Promise<void>;
};

export type GenerateTextResult = {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};

// handleGenerateText — equivalent to POST /rest/ai/generate-text
export async function handleGenerateText(
  body: GenerateTextInput,
  workspace: GenerateTextWorkspaceContext,
  userWorkspaceId: string,
  deps: GenerateTextDeps,
): Promise<GenerateTextResult> {
  const {
    getAvailableModels,
    hasAvailableCreditsOrThrow,
    validateModelAvailability,
    resolveModelForAgent,
    calculateAndBillUsage,
  } = deps;

  if (getAvailableModels().length === 0) {
    throw new Error(
      'API_KEY_NOT_CONFIGURED: No AI models are available. Please configure at least one AI provider API key.',
    );
  }

  await hasAvailableCreditsOrThrow(workspace.id);

  const resolvedModelId = body.modelId ?? workspace.fastModel;

  validateModelAvailability(resolvedModelId, workspace);

  const registeredModel = await resolveModelForAgent({ modelId: resolvedModelId });

  let result: Awaited<ReturnType<typeof generateText>> | undefined;

  try {
    result = await generateText({
      model: registeredModel.model,
      system: body.systemPrompt,
      prompt: body.userPrompt,
    });

    return {
      text: result.text,
      usage: {
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      },
    };
  } finally {
    if (result) {
      void calculateAndBillUsage(
        resolvedModelId ?? '',
        {
          usage: result.usage,
          cacheCreationTokens:
            result.usage.inputTokenDetails?.cacheWriteTokens ?? 0,
        },
        workspace.id,
        'AI_WORKFLOW_TOKEN',
        null,
        userWorkspaceId,
      );
    }
  }
}
