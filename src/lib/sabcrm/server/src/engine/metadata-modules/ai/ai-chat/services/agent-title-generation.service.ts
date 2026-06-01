import "server-only";

import {
  type LanguageModelUsage,
  type StepResult,
  type ToolSet,
  generateText,
} from 'ai';

import { AI_TELEMETRY_CONFIG } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/constants/ai-telemetry.const';
import { extractCacheCreationTokensFromSteps } from '@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/extract-cache-creation-tokens.util';

// PORT-NOTE: NestJS @Injectable() removed. Use createAgentTitleGenerationService()
// as a factory. AiModelRegistryService / AiBillingService / BillingUsageService
// are passed as callbacks to keep DI-agnostic.

export type AgentTitleGenerationService = {
  generateThreadTitle: (
    messageContent: string,
    workspaceId: string,
    userWorkspaceId: string | null,
  ) => Promise<string>;
};

export type AgentTitleGenerationServiceDeps = {
  getDefaultSpeedModel: () => {
    model: Parameters<typeof generateText>[0]['model'];
    modelId: string;
  } | null;
  hasAvailableCreditsOrThrow: (workspaceId: string) => Promise<void>;
  calculateAndBillUsage: (
    modelId: string,
    usage: { usage: LanguageModelUsage; cacheCreationTokens: number },
    workspaceId: string,
    operationType: string,
    agentId: null,
    userWorkspaceId: string | null,
  ) => Promise<void>;
};

export function createAgentTitleGenerationService(
  deps: AgentTitleGenerationServiceDeps,
): AgentTitleGenerationService {
  const {
    getDefaultSpeedModel,
    hasAvailableCreditsOrThrow,
    calculateAndBillUsage,
  } = deps;

  function generateFallbackTitle(messageContent: string): string {
    const cleanContent = messageContent.trim().replace(/\s+/g, ' ');
    const title = cleanContent.substring(0, 50);

    return cleanContent.length > 50 ? `${title}...` : title;
  }

  function cleanTitle(title: string): string {
    return title
      .replace(/^["']|["']$/g, '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  return {
    async generateThreadTitle(
      messageContent: string,
      workspaceId: string,
      userWorkspaceId: string | null,
    ): Promise<string> {
      await hasAvailableCreditsOrThrow(workspaceId);

      const defaultModel = getDefaultSpeedModel();

      if (!defaultModel) {
        console.warn('[AgentTitleGenerationService] No default AI model available for title generation');

        return generateFallbackTitle(messageContent);
      }

      let usage: LanguageModelUsage | undefined;
      let steps: StepResult<ToolSet>[] | undefined;

      try {
        const result = await generateText({
          model: defaultModel.model,
          prompt: `Generate a concise, descriptive title (maximum 60 characters) for a chat thread based on the following message. The title should capture the main topic or purpose of the conversation. Return only the title, nothing else. Message: "${messageContent}"`,
          experimental_telemetry: AI_TELEMETRY_CONFIG,
        });

        usage = result.usage;
        steps = result.steps;

        return cleanTitle(result.text);
      } catch (error) {
        console.error('[AgentTitleGenerationService] Failed to generate title with AI:', error);

        return generateFallbackTitle(messageContent);
      } finally {
        if (usage) {
          const cacheCreationTokens = steps
            ? extractCacheCreationTokensFromSteps(steps)
            : 0;

          void calculateAndBillUsage(
            defaultModel.modelId,
            { usage, cacheCreationTokens },
            workspaceId,
            'AI_CHAT_TOKEN',
            null,
            userWorkspaceId,
          );
        }
      }
    },
  };
}
