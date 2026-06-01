import "server-only";

// PORT-NOTE: Originally from twenty-server (NestJS @Injectable service).
// Ported to SabNode: NestJS DI removed; constructor dependencies become
// constructor params passed explicitly by callers. Logger replaced with
// console.log. WorkspaceEventEmitter, BillingService, BillingUsageService,
// AiModelRegistryService, WorkspaceCacheService are imported by structural
// type — callers must supply concrete implementations.

import type { LanguageModelUsage } from "ai";

import { NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/constants/native-web-search-cost-per-call-dollars";
import { computeCostBreakdown } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/compute-cost-breakdown.util";
import { convertDollarsToBillingCredits } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-billing/utils/convert-dollars-to-billing-credits.util";
import { UsageOperationType } from "@/lib/sabcrm/server/src/engine/core-modules/usage/enums/usage-operation-type.enum";
import { UsageResourceType } from "@/lib/sabcrm/server/src/engine/core-modules/usage/enums/usage-resource-type.enum";
import { UsageUnit } from "@/lib/sabcrm/server/src/engine/core-modules/usage/enums/usage-unit.enum";
import type { UsageEvent } from "@/lib/sabcrm/server/src/engine/core-modules/usage/types/usage-event.type";
import type { ModelId } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/model-id.type";
import type { AiModelConfig } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/ai-model-config.type";

// ---------------------------------------------------------------------------
// Structural interfaces for injected dependencies
// ---------------------------------------------------------------------------

export type BillingUsageInput = {
  usage: LanguageModelUsage;
  cacheCreationTokens?: number;
};

/** Subset of AiModelRegistryService used by this service. */
export interface IAiModelRegistryService {
  getEffectiveModelConfig(modelId: ModelId): AiModelConfig;
}

/** Subset of BillingService used by this service. */
export interface IBillingService {
  isBillingEnabled(): boolean;
}

/** Subset of BillingUsageService used by this service. */
export interface IBillingUsageService {
  decrementAvailableCreditsInCache(params: {
    workspaceId: string;
    usedCredits: number;
  }): Promise<number>;
}

/** Subset of WorkspaceCacheService used by this service. */
export interface IWorkspaceCacheService {
  getOrRecompute(
    workspaceId: string,
    keys: string[],
  ): Promise<{ billingSubscription: { currentPeriodStart: Date } }>;
}

/** Subset of WorkspaceEventEmitter used by this service. */
export interface IWorkspaceEventEmitter {
  emitCustomBatchEvent<T>(
    eventName: string,
    events: T[],
    workspaceId: string,
  ): void;
}

// Constant re-exported from usage module (matches twenty-server source)
const USAGE_RECORDED = "usage.recorded";

// ---------------------------------------------------------------------------
// AiBillingService
// ---------------------------------------------------------------------------

export class AiBillingService {
  constructor(
    private readonly workspaceEventEmitter: IWorkspaceEventEmitter,
    private readonly aiModelRegistryService: IAiModelRegistryService,
    private readonly billingService: IBillingService,
    private readonly billingUsageService: IBillingUsageService,
    private readonly workspaceCacheService: IWorkspaceCacheService,
  ) {}

  calculateCost(modelId: ModelId, billingInput: BillingUsageInput): number {
    const model = this.aiModelRegistryService.getEffectiveModelConfig(modelId);
    const { usage, cacheCreationTokens = 0 } = billingInput;

    const breakdown = computeCostBreakdown(model, {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      reasoningTokens: usage.outputTokenDetails?.reasoningTokens,
      cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
      cacheCreationTokens,
    });

    console.log(
      `[AiBillingService] Cost for ${model.modelId}: $${breakdown.totalCostInDollars.toFixed(6)} ` +
        `(input: ${breakdown.tokenCounts.adjustedInputTokens}, ` +
        `cached: ${breakdown.tokenCounts.cachedInputTokens}, ` +
        `cacheCreation: ${breakdown.tokenCounts.cacheCreationTokens}, ` +
        `output: ${breakdown.tokenCounts.adjustedOutputTokens}, ` +
        `reasoning: ${breakdown.tokenCounts.reasoningTokens})`,
    );

    return breakdown.totalCostInDollars;
  }

  async calculateAndBillUsage(
    modelId: ModelId,
    billingInput: BillingUsageInput,
    workspaceId: string,
    operationType: UsageOperationType,
    agentId?: string | null,
    userWorkspaceId?: string | null,
  ): Promise<void> {
    const costInDollars = this.calculateCost(modelId, billingInput);
    const creditsUsedMicro = Math.round(
      convertDollarsToBillingCredits(costInDollars),
    );

    const totalTokens =
      (billingInput.usage.inputTokens ?? 0) +
      (billingInput.usage.outputTokens ?? 0) +
      (billingInput.cacheCreationTokens ?? 0);

    if (this.billingService.isBillingEnabled()) {
      await this.billingUsageService.decrementAvailableCreditsInCache({
        workspaceId,
        usedCredits: creditsUsedMicro,
      });
    }

    await this.emitAiTokenUsageEvent(
      workspaceId,
      creditsUsedMicro,
      totalTokens,
      modelId,
      operationType,
      agentId,
      userWorkspaceId,
    );
  }

  async decrementAndCheckAvailableCredits(
    modelId: ModelId,
    billingInput: BillingUsageInput,
    workspaceId: string,
  ): Promise<{ hasNoMoreAvailableCredits: boolean }> {
    if (!this.billingService.isBillingEnabled()) {
      return { hasNoMoreAvailableCredits: false };
    }

    const costInDollars = this.calculateCost(modelId, billingInput);
    const creditsUsedMicro = Math.round(
      convertDollarsToBillingCredits(costInDollars),
    );

    const remainingCredits =
      await this.billingUsageService.decrementAvailableCreditsInCache({
        workspaceId,
        usedCredits: creditsUsedMicro,
      });

    return { hasNoMoreAvailableCredits: remainingCredits <= 0 };
  }

  async billNativeWebSearchUsage(
    nativeWebSearchCallCount: number,
    workspaceId: string,
    userWorkspaceId?: string | null,
  ): Promise<void> {
    if (nativeWebSearchCallCount <= 0) {
      return;
    }

    const costInDollars =
      nativeWebSearchCallCount * NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS;
    const creditsUsedMicro = Math.round(
      convertDollarsToBillingCredits(costInDollars),
    );

    console.log(
      `[AiBillingService] Native web search billing: ${nativeWebSearchCallCount} calls, $${costInDollars.toFixed(4)}`,
    );

    let periodStart: Date | undefined;

    if (this.billingService.isBillingEnabled()) {
      const {
        billingSubscription: { currentPeriodStart },
      } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
        "billingSubscription",
      ]);

      periodStart = currentPeriodStart;

      await this.billingUsageService.decrementAvailableCreditsInCache({
        workspaceId,
        usedCredits: creditsUsedMicro,
      });
    }

    this.workspaceEventEmitter.emitCustomBatchEvent<UsageEvent>(
      USAGE_RECORDED,
      [
        {
          resourceType: UsageResourceType.AI,
          operationType: UsageOperationType.WEB_SEARCH,
          creditsUsedMicro,
          quantity: nativeWebSearchCallCount,
          unit: UsageUnit.INVOCATION,
          userWorkspaceId: userWorkspaceId ?? null,
          periodStart,
        },
      ],
      workspaceId,
    );
  }

  async emitAiTokenUsageEvent(
    workspaceId: string,
    creditsUsedMicro: number,
    totalTokens: number,
    modelId: ModelId,
    operationType: UsageOperationType,
    agentId?: string | null,
    userWorkspaceId?: string | null,
  ): Promise<void> {
    let periodStart: Date | undefined;

    if (this.billingService.isBillingEnabled()) {
      const {
        billingSubscription: { currentPeriodStart },
      } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
        "billingSubscription",
      ]);

      periodStart = currentPeriodStart;
    }

    this.workspaceEventEmitter.emitCustomBatchEvent<UsageEvent>(
      USAGE_RECORDED,
      [
        {
          resourceType: UsageResourceType.AI,
          operationType,
          creditsUsedMicro,
          quantity: totalTokens,
          unit: UsageUnit.TOKEN,
          resourceId: agentId ?? null,
          resourceContext: modelId,
          userWorkspaceId: userWorkspaceId ?? null,
          periodStart,
        },
      ],
      workspaceId,
    );
  }
}
