# Metadata & AI Modules - Function Reference
Complete documentation of all exported functions, services, resolvers, and types in the backend metadata-modules area.

## Scope & Summary

**Directories Covered:** 18

- ai, agent, skill, flat-agent, flat-skill
- field-metadata, flat-field-metadata, search-field-metadata
- object-metadata, flat-object-metadata, flat-entity
- index-metadata, flat-index-metadata, minimal-metadata
- data-source, workspace-metadata-version, workspace-feature-flags-map-cache
- types, utils

**Statistics:**

- Total Files: 512
- Total Exports: 671

## AI

**Files:** 134 | **Exports:** 194

### file:ai/ai-agent-execution/ai-agent-execution.module.ts:65

**Classs:** 1
- `AiAgentExecutionModule` (line 65)

### file:ai/ai-agent-execution/constants/workflow-agent-registry-tool-categories.const.ts:3

**Constants:** 1
- `WORKFLOW_AGENT_REGISTRY_TOOL_CATEGORIES` (line 3)

### file:ai/ai-agent-execution/dtos/agent-message-part.dto.ts:9

**Classs:** 1
- `AgentMessagePartDTO` (line 9)

### file:ai/ai-agent-execution/dtos/agent-message.dto.ts:9

**Classs:** 1
- `AgentMessageDTO` (line 9)

### file:ai/ai-agent-execution/dtos/agent-turn.dto.ts:10

**Classs:** 1
- `AgentTurnDTO` (line 10)

### file:ai/ai-agent-execution/entities/agent-message-part.entity.ts:18

**Classs:** 1
- `AgentMessagePartEntity` (line 18)

### file:ai/ai-agent-execution/entities/agent-message.entity.ts:18

**Classs:** 1
- `AgentMessageEntity` (line 30)

**Enums:** 2
- `AgentMessageRole` (line 18)
- `AgentMessageStatus` (line 24)

### file:ai/ai-agent-execution/entities/agent-turn.entity.ts:19

**Classs:** 1
- `AgentTurnEntity` (line 19)

### file:ai/ai-agent-execution/resolvers/agent-message-part.resolver.ts:12

**Classs:** 1
- `AgentMessagePartResolver` (line 12)

### file:ai/ai-agent-execution/services/agent-actor-context.service.ts:15

**Types:** 2
- `UserContext` (line 15)
- `AgentActorContext` (line 22)

### file:ai/ai-agent-execution/services/agent-async-executor.service.ts:71

**NestJS Services:** 1
- `AgentAsyncExecutorService` (line 71)

### file:ai/ai-agent-execution/types/agent-execution-result.type.ts:3

**Interfaces:** 1
- `AgentExecutionResult` (line 3)

### file:ai/ai-agent-execution/utils/mapDBPartToUIMessagePart.ts:12

**Constants:** 1
- `mapDBPartToUIMessagePart` (line 12)

### file:ai/ai-agent-execution/utils/mapDBPartsToUIMessageParts.ts:6

**Constants:** 1
- `mapDBPartsToUIMessageParts` (line 6)

### file:ai/ai-agent-execution/utils/mapUIMessagePartsToDBParts.ts:13

**Constants:** 1
- `mapUIMessagePartsToDBParts` (line 13)

### file:ai/ai-agent-monitor/ai-agent-monitor.module.ts:45

**Classs:** 1
- `AiAgentMonitorModule` (line 45)

### file:ai/ai-agent-monitor/dtos/agent-turn-evaluation.dto.ts:8

**Classs:** 1
- `AgentTurnEvaluationDTO` (line 8)

### file:ai/ai-agent-monitor/entities/agent-turn-evaluation.entity.ts:16

**Classs:** 1
- `AgentTurnEvaluationEntity` (line 16)

### file:ai/ai-agent-monitor/jobs/evaluate-agent-turn.job.ts:8

**Classs:** 1
- `EvaluateAgentTurnJob` (line 14)

**Types:** 1
- `EvaluateAgentTurnJobData` (line 8)

### file:ai/ai-agent-monitor/jobs/run-evaluation-input.job.ts:15

**Classs:** 1
- `RunEvaluationInputJob` (line 24)

**Types:** 1
- `RunEvaluationInputJobData` (line 15)

### file:ai/ai-agent-monitor/resolvers/agent-turn.resolver.ts:32

**Classs:** 1
- `AgentTurnResolver` (line 32)

**GraphQL Mutations:** 2
- `evaluateAgentTurn` (line 59)
- `runEvaluationInput` (line 67)

**GraphQL Querys:** 1
- `agentTurns` (line 47)

### file:ai/ai-agent-monitor/services/agent-turn-grader.service.ts:15

**NestJS Services:** 1
- `AgentTurnGraderService` (line 15)

### file:ai/ai-agent-role/ai-agent-role.module.ts:24

**Classs:** 1
- `AiAgentRoleModule` (line 24)

### file:ai/ai-agent-role/ai-agent-role.service.ts:17

**NestJS Services:** 1
- `AiAgentRoleService` (line 17)

### file:ai/ai-agent/agent.resolver.ts:30

**Classs:** 1
- `AgentResolver` (line 30)

**GraphQL Querys:** 2
- `findManyAgents` (line 37)
- `findOneAgent` (line 47)

### file:ai/ai-agent/agent.service.ts:28

**NestJS Services:** 1
- `AgentService` (line 28)

### file:ai/ai-agent/ai-agent.module.ts:52

**Classs:** 1
- `AiAgentModule` (line 52)

### file:ai/ai-agent/constants/agent-config.const.ts:1

**Constants:** 1
- `AGENT_CONFIG` (line 1)

### file:ai/ai-agent/constants/agent-system-prompts.const.ts:4

**Constants:** 1
- `WORKFLOW_SYSTEM_PROMPTS` (line 4)

### file:ai/ai-agent/dtos/agent-id.input.ts:6

**Classs:** 1
- `AgentIdInput` (line 6)

### file:ai/ai-agent/dtos/agent.dto.ts:17

**Classs:** 1
- `AgentDTO` (line 17)

### file:ai/ai-agent/dtos/create-agent.input.ts:23

**Classs:** 1
- `CreateAgentInput` (line 23)

### file:ai/ai-agent/dtos/update-agent.input.ts:23

**Classs:** 1
- `UpdateAgentInput` (line 23)

### file:ai/ai-agent/entities/agent.entity.ts:24

**Classs:** 1
- `AgentEntity` (line 24)

### file:ai/ai-agent/types/agent-response-format.type.ts:3

**Types:** 4
- `AgentResponseFormatType` (line 3)
- `AgentTextResponseFormat` (line 5)
- `AgentJsonResponseFormat` (line 6)
- `AgentResponseFormat` (line 10)

### file:ai/ai-agent/types/browsingContext.type.ts:1

**Types:** 1
- `BrowsingContextType` (line 1)

### file:ai/ai-agent/utils/from-create-agent-input-to-flat-agent.util.ts:16

**Constants:** 1
- `fromCreateAgentInputToFlatAgent` (line 23)

**Types:** 1
- `FromCreateAgentInputToFlatAgentArgs` (line 16)

### file:ai/ai-agent/utils/from-update-agent-input-to-flat-agent-to-update.util.ts:92

**Constants:** 1
- `fromUpdateAgentInputToFlatAgentToUpdate` (line 98)

**Types:** 1
- `FromUpdateAgentInputToFlatAgentToUpdateArgs` (line 92)

### file:ai/ai-agent/utils/is-workflow-related-object.util.ts:11

**Constants:** 1
- `isWorkflowRelatedObject` (line 11)

### file:ai/ai-agent/utils/is-workflow-run-object.util.ts:13

**Constants:** 1
- `isWorkflowRelatedObject` (line 13)

### file:ai/ai-agent/utils/repair-tool-call.util.ts:32

**Constants:** 1
- `repairToolCall` (line 32)

### file:ai/ai-agent/validators/agent-response-format-json.validator.ts:3

**Classs:** 1
- `AgentResponseFormatJson` (line 3)

### file:ai/ai-agent/validators/agent-response-format-text.validator.ts:3

**Classs:** 1
- `AgentResponseFormatText` (line 3)

### file:ai/ai-billing/ai-billing.module.ts:19

**Classs:** 1
- `AiBillingModule` (line 19)

### file:ai/ai-billing/constants/dollar-to-credit-multiplier.ts:2

**Constants:** 1
- `DOLLAR_TO_CREDIT_MULTIPLIER` (line 2)

### file:ai/ai-billing/constants/native-web-search-cost-per-call-dollars.ts:3

**Constants:** 1
- `NATIVE_WEB_SEARCH_COST_PER_CALL_DOLLARS` (line 3)

### file:ai/ai-billing/services/ai-billing.service.ts:20

**NestJS Services:** 1
- `AiBillingService` (line 26)

**Types:** 1
- `BillingUsageInput` (line 20)

### file:ai/ai-billing/utils/compute-cost-breakdown.util.ts:4

**Constants:** 1
- `computeCostBreakdown` (line 38)

**Types:** 2
- `TokenUsageInput` (line 4)
- `CostBreakdown` (line 12)

### file:ai/ai-billing/utils/convert-dollars-to-billing-credits.util.ts:3

**Constants:** 1
- `convertDollarsToBillingCredits` (line 3)

### file:ai/ai-billing/utils/count-native-web-search-calls-from-steps.util.ts:5

**Constants:** 1
- `countNativeWebSearchCallsFromSteps` (line 5)

### file:ai/ai-billing/utils/extract-cache-creation-tokens.util.ts:6

**Constants:** 2
- `extractCacheCreationTokensFromSteps` (line 6)
- `extractCacheCreationTokens` (line 14)

### file:ai/ai-billing/utils/merge-language-model-usage.util.ts:6

**Constants:** 1
- `mergeLanguageModelUsage` (line 6)

### file:ai/ai-chat/ai-chat.module.ts:94

**Classs:** 1
- `AiChatModule` (line 94)

### file:ai/ai-chat/constants/ai-chat-tool-names-to-preload.const.ts:3

**Constants:** 1
- `AI_CHAT_TOOL_NAMES_TO_PRELOAD` (line 3)

### file:ai/ai-chat/constants/chat-system-prompts.const.ts:2

**Constants:** 1
- `CHAT_SYSTEM_PROMPTS` (line 2)

### file:ai/ai-chat/dtos/agent-chat-event.dto.ts:8

**Classs:** 1
- `AgentChatEventDTO` (line 8)

### file:ai/ai-chat/dtos/agent-chat-thread.dto.ts:4

**Classs:** 1
- `AgentChatThreadDTO` (line 4)

### file:ai/ai-chat/dtos/ai-system-prompt-preview.dto.ts:4

**Classs:** 2
- `AiSystemPromptSectionDTO` (line 4)
- `AiSystemPromptPreviewDTO` (line 16)

### file:ai/ai-chat/dtos/chat-stream-catchup-chunks.dto.ts:6

**Classs:** 1
- `ChatStreamCatchupChunksDTO` (line 6)

### file:ai/ai-chat/dtos/file-attachment.input.ts:6

**Classs:** 1
- `FileAttachmentInput` (line 6)

### file:ai/ai-chat/dtos/send-chat-message-result.dto.ts:4

**Classs:** 1
- `SendChatMessageResultDTO` (line 4)

### file:ai/ai-chat/entities/agent-chat-thread.entity.ts:21

**Classs:** 1
- `AgentChatThreadEntity` (line 21)

### file:ai/ai-chat/jobs/stream-agent-chat-job-name.constant.ts:1

**Constants:** 1
- `STREAM_AGENT_CHAT_JOB_NAME` (line 1)

### file:ai/ai-chat/jobs/stream-agent-chat-job.types.ts:8

**Types:** 1
- `StreamAgentChatJobData` (line 8)

### file:ai/ai-chat/jobs/stream-agent-chat.job.ts:38

**Classs:** 1
- `StreamAgentChatJob` (line 38)

### file:ai/ai-chat/resolvers/agent-chat-subscription.resolver.ts:28

**Classs:** 1
- `AgentChatSubscriptionResolver` (line 28)

### file:ai/ai-chat/resolvers/agent-chat.resolver.ts:49

**Classs:** 1
- `AgentChatResolver` (line 49)

**GraphQL Mutations:** 8
- `createChatThread` (line 115)
- `sendChatMessage` (line 126)
- `stopAgentChatStream` (line 215)
- `renameChatThread` (line 242)
- `archiveChatThread` (line 257)
- `unarchiveChatThread` (line 272)
- `deleteChatThread` (line 285)
- `deleteQueuedChatMessage` (line 320)

**GraphQL Querys:** 5
- `chatThreads` (line 63)
- `chatThread` (line 74)
- `chatMessages` (line 87)
- `chatStreamCatchupChunks` (line 100)
- `getAiSystemPromptPreview` (line 365)

### file:ai/ai-chat/services/agent-chat-cancel-subscriber.service.ts:12

**NestJS Services:** 1
- `AgentChatCancelSubscriberService` (line 12)

### file:ai/ai-chat/services/agent-chat-event-publisher.service.ts:11

**NestJS Services:** 1
- `AgentChatEventPublisherService` (line 11)

### file:ai/ai-chat/services/agent-chat-streaming.service.ts:48

**NestJS Services:** 1
- `AgentChatStreamingService` (line 48)

### file:ai/ai-chat/services/agent-chat.service.ts:52

**NestJS Services:** 1
- `AgentChatService` (line 52)

### file:ai/ai-chat/services/agent-title-generation.service.ts:18

**NestJS Services:** 1
- `AgentTitleGenerationService` (line 18)

### file:ai/ai-chat/services/chat-execution.service.ts:68

**NestJS Services:** 1
- `ChatExecutionService` (line 87)

**Types:** 2
- `ChatExecutionOptions` (line 68)
- `ChatExecutionResult` (line 80)

### file:ai/ai-chat/services/message-pruning.service.ts:8

**NestJS Services:** 1
- `MessagePruningService` (line 15)

**Types:** 1
- `PruningResult` (line 8)

### file:ai/ai-chat/services/system-prompt-builder.service.ts:22

**NestJS Services:** 1
- `SystemPromptBuilderService` (line 37)

**Types:** 2
- `SystemPromptSection` (line 22)
- `SystemPromptPreview` (line 28)

### file:ai/ai-chat/types/ai-chat-file-attachment.type.ts:1

**Types:** 1
- `AiChatFileAttachment` (line 1)

### file:ai/ai-chat/utils/extract-code-interpreter-files.util.ts:20

**Constants:** 1
- `extractCodeInterpreterFiles` (line 31)

**Types:** 2
- `ExtractedFile` (line 20)
- `ExtractCodeInterpreterFilesResult` (line 26)

### file:ai/ai-chat/utils/get-cancel-channel.util.ts:1

**Constants:** 1
- `getCancelChannel` (line 1)

### file:ai/ai-chat/utils/inject-cache-breakpoint.util.ts:9

**Constants:** 3
- `getCallLevelCacheProviderOptions` (line 9)
- `getCacheProviderOptions` (line 19)
- `injectCacheBreakpoint` (line 29)

### file:ai/ai-generate-text/ai-generate-text.module.ts:21

**Classs:** 1
- `AiGenerateTextModule` (line 21)

### file:ai/ai-generate-text/controllers/ai-generate-text.controller.ts:32

**Classs:** 1
- `AiGenerateTextController` (line 32)

### file:ai/ai-generate-text/dtos/generate-text.input.ts:3

**Classs:** 1
- `GenerateTextInput` (line 3)

### file:ai/ai-models/ai-models.module.ts:34

**Classs:** 1
- `AiModelsModule` (line 34)

### file:ai/ai-models/constants/ai-sdk-package.const.ts:1

**Constants:** 8
- `AI_SDK_OPENAI` (line 1)
- `AI_SDK_ANTHROPIC` (line 2)
- `AI_SDK_GOOGLE` (line 3)
- `AI_SDK_MISTRAL` (line 4)
- `AI_SDK_XAI` (line 5)
- `AI_SDK_BEDROCK` (line 6)
- `AI_SDK_OPENAI_COMPATIBLE` (line 7)
- `AI_SDK_AZURE` (line 8)

### file:ai/ai-models/constants/ai-telemetry.const.ts:1

**Constants:** 1
- `AI_TELEMETRY_CONFIG` (line 1)

### file:ai/ai-models/constants/model-family-labels.const.ts:3

**Constants:** 1
- `MODEL_FAMILY_LABELS` (line 3)

### file:ai/ai-models/constants/models-dev.const.ts:1

**Constants:** 1
- `MODELS_DEV_API_URL` (line 1)

### file:ai/ai-models/constants/native-model-tools-by-sdk-package.const.ts:15

**Constants:** 1
- `NATIVE_MODEL_TOOLS_BY_SDK_PACKAGE` (line 15)

### file:ai/ai-models/services/ai-model-config.service.ts:23

**NestJS Services:** 1
- `AiModelConfigService` (line 23)

### file:ai/ai-models/services/ai-model-preferences.service.ts:8

**NestJS Services:** 1
- `AiModelPreferencesService` (line 8)

### file:ai/ai-models/services/ai-model-registry.service.ts:37

**Interfaces:** 1
- `RegisteredAiModel` (line 37)

**NestJS Services:** 1
- `AiModelRegistryService` (line 47)

### file:ai/ai-models/services/default-ai-catalog.service.ts:12

**NestJS Services:** 1
- `DefaultAiCatalogService` (line 12)

### file:ai/ai-models/services/models-dev-catalog.service.ts:8

**NestJS Services:** 1
- `ModelsDevCatalogService` (line 44)

**Types:** 2
- `ModelsDevModelSuggestion` (line 8)
- `ModelsDevProviderSuggestion` (line 23)

### file:ai/ai-models/services/native-tool-binder.interface.ts:8

**Interfaces:** 1
- `NativeToolBinder` (line 8)

### file:ai/ai-models/services/native-tool-binder.service.ts:11

**NestJS Services:** 1
- `NativeToolBinderService` (line 11)

### file:ai/ai-models/services/provider-config.service.ts:12

**NestJS Services:** 1
- `ProviderConfigService` (line 12)

### file:ai/ai-models/services/sdk-provider-factory.service.ts:27

**NestJS Services:** 1
- `SdkProviderFactoryService` (line 34)

**Types:** 1
- `AiSdkProviderInstance` (line 27)

### file:ai/ai-models/types/ai-model-config.type.ts:5

**Types:** 1
- `AiModelConfig` (line 5)

### file:ai/ai-models/types/ai-model-preferences.schema.ts:3

**Constants:** 1
- `aiModelPreferencesSchema` (line 3)

### file:ai/ai-models/types/ai-model-preferences.type.ts:2

**Types:** 1
- `AiModelPreferences` (line 2)

### file:ai/ai-models/types/ai-model-role.enum.ts:1

**Enums:** 1
- `AiModelRole` (line 1)

### file:ai/ai-models/types/ai-provider-auth-type.schema.ts:3

**Constants:** 1
- `aiProviderAuthTypeSchema` (line 3)

### file:ai/ai-models/types/ai-provider-auth-type.type.ts:5

**Types:** 1
- `AiProviderAuthType` (line 5)

### file:ai/ai-models/types/ai-provider-config.schema.ts:8

**Constants:** 1
- `aiProviderConfigSchema` (line 8)

### file:ai/ai-models/types/ai-provider-config.type.ts:6

**Types:** 1
- `AiProviderConfig` (line 6)

### file:ai/ai-models/types/ai-provider-model-config.schema.ts:6

**Constants:** 1
- `aiProviderModelConfigSchema` (line 6)

### file:ai/ai-models/types/ai-provider-model-config.type.ts:5

**Types:** 2
- `AiModelSource` (line 5)
- `AiProviderModelConfig` (line 7)

### file:ai/ai-models/types/ai-providers-config.schema.ts:5

**Constants:** 1
- `aiProvidersConfigSchema` (line 5)

### file:ai/ai-models/types/ai-providers-config.type.ts:3

**Types:** 1
- `AiProvidersConfig` (line 3)

### file:ai/ai-models/types/default-context-window-tokens.const.ts:1

**Constants:** 1
- `DEFAULT_CONTEXT_WINDOW_TOKENS` (line 1)

### file:ai/ai-models/types/default-max-output-tokens.const.ts:1

**Constants:** 1
- `DEFAULT_MAX_OUTPUT_TOKENS` (line 1)

### file:ai/ai-models/types/long-context-cost.schema.ts:3

**Constants:** 1
- `longContextCostSchema` (line 3)

### file:ai/ai-models/types/long-context-cost.type.ts:5

**Types:** 1
- `LongContextCost` (line 5)

### file:ai/ai-models/types/model-family.enum.ts:1

**Enums:** 1
- `ModelFamily` (line 1)

### file:ai/ai-models/types/model-id.type.ts:2

**Types:** 1
- `ModelId` (line 2)

### file:ai/ai-models/types/models-dev-data.type.ts:3

**Types:** 1
- `ModelsDevData` (line 3)

### file:ai/ai-models/types/models-dev-model.type.ts:1

**Types:** 1
- `ModelsDevModel` (line 1)

### file:ai/ai-models/types/models-dev-provider.type.ts:3

**Types:** 1
- `ModelsDevProvider` (line 3)

### file:ai/ai-models/types/native-model-tool-key.type.ts:1

**Types:** 1
- `NativeModelToolKey` (line 1)

### file:ai/ai-models/types/native-model-tool-options.type.ts:3

**Types:** 1
- `NativeModelToolOptions` (line 3)

### file:ai/ai-models/types/native-model-tools.type.ts:3

**Types:** 1
- `NativeModelTools` (line 3)

### file:ai/ai-models/utils/composite-model-id.util.ts:3

**Constants:** 1
- `buildCompositeModelId` (line 3)

### file:ai/ai-models/utils/extract-config-variable-name.util.ts:3

**Constants:** 1
- `extractConfigVariableName` (line 3)

### file:ai/ai-models/utils/get-native-model-capabilities.util.ts:6

**Constants:** 1
- `getNativeModelCapabilities` (line 6)

### file:ai/ai-models/utils/get-native-model-tools-for-sdk-package.util.ts:6

**Constants:** 1
- `getNativeModelToolsForSdkPackage` (line 6)

### file:ai/ai-models/utils/infer-model-family.util.ts:22

**Constants:** 1
- `inferModelFamily` (line 22)

### file:ai/ai-models/utils/is-model-allowed.util.ts:3

**Constants:** 1
- `isModelAllowedByWorkspace` (line 8)

**Types:** 1
- `WorkspaceModelAvailabilitySettings` (line 3)

### file:ai/ai-models/utils/is-provider-configured.util.ts:3

**Constants:** 1
- `isProviderConfigured` (line 3)

### file:ai/ai-models/utils/load-default-model-preferences.util.ts:5

**Constants:** 5
- `DEFAULT_FAST_MODELS` (line 5)
- `DEFAULT_SMART_MODELS` (line 13)
- `DEFAULT_RECOMMENDED_MODELS` (line 21)
- `DEFAULT_DISABLED_MODELS` (line 30)
- `DEFAULT_MODEL_PREFERENCES` (line 32)

### file:ai/ai-models/utils/normalize-ai-providers.util.ts:4

**Constants:** 1
- `normalizeAiProviders` (line 4)

### file:ai/ai.exception.ts:7

**Classs:** 1
- `AiException` (line 53)

**Enums:** 1
- `AiExceptionCode` (line 7)

### file:ai/filters/ai-api-exception.filter.ts:16

**Classs:** 1
- `AiRestApiExceptionFilter` (line 16)

### file:ai/interceptors/ai-graphql-api-exception.interceptor.ts:13

**NestJS Services:** 1
- `AiGraphqlApiExceptionInterceptor` (line 13)

### file:ai/utils/ai-graphql-api-exception-handler.util.ts:15

**Constants:** 1
- `aiGraphqlApiExceptionHandler` (line 15)


## DATA SOURCE

**Files:** 1 | **Exports:** 2

### file:data-source/data-source.entity.ts:13

**Classs:** 1
- `DataSourceEntity` (line 19)

**Types:** 1
- `DataSourceType` (line 13)


## FIELD METADATA

**Files:** 52 | **Exports:** 74

### file:field-metadata/constants/field-metadata-standard-overrides-properties.constant.ts:3

**Constants:** 1
- `FIELD_METADATA_STANDARD_OVERRIDES_PROPERTIES` (line 3)

### file:field-metadata/controllers/field-metadata.controller.ts:71

**Classs:** 1
- `FieldMetadataController` (line 71)

### file:field-metadata/dtos/create-field.input.ts:12

**Classs:** 2
- `CreateFieldInput` (line 12)
- `CreateOneFieldMetadataInput` (line 50)

### file:field-metadata/dtos/delete-field.input.ts:9

**Classs:** 1
- `DeleteOneFieldInput` (line 9)

### file:field-metadata/dtos/field-metadata.dto.ts:61

**Classs:** 1
- `FieldMetadataDTO` (line 61)

### file:field-metadata/dtos/field-standard-overrides.dto.ts:10

**Classs:** 1
- `FieldStandardOverridesDTO` (line 10)

### file:field-metadata/dtos/options.input.ts:4

**Classs:** 2
- `FieldMetadataDefaultOption` (line 16)
- `FieldMetadataComplexOption` (line 33)

**Types:** 1
- `TagColor` (line 4)

### file:field-metadata/dtos/relation.dto.ts:17

**Classs:** 1
- `RelationDTO` (line 17)

### file:field-metadata/dtos/update-field.input.ts:23

**Classs:** 2
- `UpdateFieldInput` (line 23)
- `UpdateOneFieldMetadataInput` (line 48)

### file:field-metadata/field-metadata.entity.ts:59

**Classs:** 1
- `FieldMetadataEntity` (line 59)

### file:field-metadata/field-metadata.exception.ts:11

**Classs:** 1
- `FieldMetadataException` (line 70)

**Constants:** 1
- `FieldMetadataExceptionCode` (line 11)

**Types:** 1
- `FieldMetadataExceptionCode` (line 30)

### file:field-metadata/field-metadata.module.ts:104

**Classs:** 1
- `FieldMetadataModule` (line 104)

### file:field-metadata/field-metadata.resolver.ts:42

**Classs:** 1
- `FieldMetadataResolver` (line 42)

**GraphQL Mutations:** 3
- `createOneField` (line 95)
- `updateOneField` (line 113)
- `deleteOneField` (line 131)

### file:field-metadata/filters/field-metadata-rest-api-exception.filter.ts:38

**Classs:** 1
- `FieldMetadataRestApiExceptionFilter` (line 38)

### file:field-metadata/interceptors/field-metadata-graphql-api-exception.interceptor.ts:13

**NestJS Services:** 1
- `FieldMetadataGraphqlApiExceptionInterceptor` (line 13)

### file:field-metadata/interfaces/relation-type.interface.ts:1

**Enums:** 1
- `RelationType` (line 1)

### file:field-metadata/services/field-metadata.service.ts:37

**NestJS Services:** 1
- `FieldMetadataService` (line 37)

### file:field-metadata/tools/field-metadata-tools.factory.ts:166

**NestJS Services:** 1
- `FieldMetadataToolsFactory` (line 166)

### file:field-metadata/types/assign-if-is-given-field-metadata-type.type.ts:3

**Types:** 1
- `AssignIfIsGivenFieldMetadataType` (line 3)

### file:field-metadata/types/assign-type-if-is-morph-or-relation-field-metadata-type.type.ts:6

**Types:** 1
- `AssignTypeIfIsMorphOrRelationFieldMetadataType` (line 6)

### file:field-metadata/types/composite-field-metadata-type.type.ts:14

**Constants:** 1
- `COMPOSITE_FIELD_TYPES` (line 16)

**Types:** 1
- `CompositeFieldMetadataType` (line 14)

### file:field-metadata/types/enum-field-metadata-type.type.ts:9

**Constants:** 1
- `ENUM_FIELD_TYPES` (line 11)

**Types:** 1
- `EnumFieldMetadataType` (line 9)

### file:field-metadata/types/field-metadata-standard-overrides-properties.type.ts:3

**Types:** 1
- `FieldMetadataStandardOverridesProperties` (line 3)

### file:field-metadata/types/morph-or-relation-field-metadata-type.type.ts:3

**Constants:** 1
- `MORPH_OR_RELATION_FIELD_TYPES` (line 3)

**Types:** 1
- `MorphOrRelationFieldMetadataType` (line 8)

### file:field-metadata/utils/compute-column-name.util.ts:15

**Functions:** 2
- `computeColumnName` (line 21)
- `computeCompositeColumnName` (line 43)

**Types:** 1
- `FieldTypeAndNameMetadata` (line 15)

### file:field-metadata/utils/compute-morph-or-relation-field-join-column-name.util.ts:5

**Constants:** 1
- `computeMorphOrRelationFieldJoinColumnName` (line 5)

### file:field-metadata/utils/compute-morph-relation-flat-field-name.util.ts:16

**Constants:** 1
- `computeMorphRelationFlatFieldName` (line 16)

### file:field-metadata/utils/field-metadata-exception-code-to-http-status.util.ts:5

**Constants:** 1
- `fieldMetadataExceptionCodeToHttpStatus` (line 5)

### file:field-metadata/utils/field-metadata-graphql-api-exception-handler.util.ts:17

**Constants:** 1
- `fieldMetadataGraphqlApiExceptionHandler` (line 17)

### file:field-metadata/utils/from-field-metadata-entity-to-field-metadata-dto.util.ts:8

**Constants:** 1
- `fromFieldMetadataEntityToFieldMetadataDto` (line 8)

### file:field-metadata/utils/from-object-metadata-entity-to-object-metadata-dto.util.ts:4

**Constants:** 1
- `fromObjectMetadataEntityToObjectMetadataDto` (line 4)

### file:field-metadata/utils/generate-default-value.ts:8

**Functions:** 1
- `generateDefaultValue` (line 8)

### file:field-metadata/utils/generate-nullable.ts:1

**Functions:** 1
- `generateNullable` (line 1)

### file:field-metadata/utils/generate-rating-optionts.util.ts:10

**Functions:** 1
- `generateRatingOptions` (line 10)

### file:field-metadata/utils/get-composite-type-or-throw.util.ts:12

**Constants:** 1
- `getCompositeTypeOrThrow` (line 12)

### file:field-metadata/utils/get-groupable-sub-fields-for-composite-type.util.ts:8

**Constants:** 1
- `getGroupableSubFieldsForCompositeType` (line 8)

### file:field-metadata/utils/is-composite-field-metadata-type.util.ts:2

**Constants:** 1
- `isCompositeFieldMetadataType` (line 2)

### file:field-metadata/utils/is-composite-property-supported-in-group-by.util.ts:3

**Constants:** 1
- `isCompositePropertySupportedInGroupBy` (line 3)

### file:field-metadata/utils/is-enum-field-metadata-type.util.ts:3

**Constants:** 2
- `fieldMetadataEnumTypes` (line 3)
- `isEnumFieldMetadataType` (line 12)

**Types:** 1
- `EnumFieldMetadataUnionType` (line 9)

### file:field-metadata/utils/is-field-metadata-settings-of-type.util.ts:10

**Constants:** 2
- `isFieldMetadataSettingsOfType` (line 10)
- `isUniversalFieldMetadataSettingsOftype` (line 29)

### file:field-metadata/utils/is-field-metadata-type-relation.util.ts:5

**Constants:** 1
- `isFieldMetadataTypeRelation` (line 5)

### file:field-metadata/utils/is-function-default-value.util.ts:8

**Constants:** 1
- `isFunctionDefaultValue` (line 8)

### file:field-metadata/utils/is-supported-in-group-by.util.ts:19

**Constants:** 1
- `isFlatFieldMetadataSupportedInGroupBy` (line 19)

### file:field-metadata/utils/resolve-field-metadata-standard-override.util.ts:10

**Constants:** 1
- `resolveFieldMetadataStandardOverride` (line 10)

### file:field-metadata/utils/serialize-default-value.ts:10

**Constants:** 1
- `serializeDefaultValue` (line 10)

### file:field-metadata/utils/serialize-function-default-value.util.ts:3

**Constants:** 1
- `serializeFunctionDefaultValue` (line 3)

### file:field-metadata/utils/should-exclude-field-from-agent-tool-schema.util.ts:4

**Constants:** 1
- `shouldExcludeFieldFromAgentToolSchema` (line 4)

### file:field-metadata/utils/to-legacy-field-metadata-response.util.ts:4

**Constants:** 5
- `toLegacyFieldMetadataListResponse` (line 4)
- `toLegacyFieldMetadataFindOneResponse` (line 18)
- `toLegacyFieldMetadataCreateResponse` (line 22)
- `toLegacyFieldMetadataUpdateResponse` (line 26)
- `toLegacyFieldMetadataDeleteResponse` (line 30)

### file:field-metadata/utils/unserialize-default-value.ts:3

**Constants:** 1
- `unserializeDefaultValue` (line 3)

### file:field-metadata/utils/validate-options-for-type.util.ts:19

**Constants:** 2
- `optionsValidatorsMap` (line 19)
- `validateOptionsForType` (line 25)

### file:field-metadata/utils/validate-relation-creation-payload-or-throw.util.ts:30

**Constants:** 1
- `validateRelationCreationPayloadOrThrow` (line 30)

### file:field-metadata/validators/is-quoted-string.validator.ts:7

**Functions:** 1
- `IsQuotedString` (line 7)


## FLAT AGENT

**Files:** 7 | **Exports:** 8

### file:flat-agent/constants/flat-agent-editable-properties.constant.ts:3

**Constants:** 1
- `FLAT_AGENT_EDITABLE_PROPERTIES` (line 3)

### file:flat-agent/flat-agent.module.ts:34

**Classs:** 1
- `FlatAgentModule` (line 34)

### file:flat-agent/types/flat-agent-maps.type.ts:4

**Types:** 1
- `FlatAgentMaps` (line 4)

### file:flat-agent/types/flat-agent.type.ts:4

**Types:** 2
- `FlatAgent` (line 4)
- `FlatAgentWithRoleId` (line 6)

### file:flat-agent/types/flat-role-target-by-agent-id-maps.type.ts:3

**Types:** 1
- `FlatRoleTargetByAgentIdMaps` (line 3)

### file:flat-agent/utils/from-agent-entity-to-agent-dto.util.ts:4

**Constants:** 1
- `fromFlatAgentWithRoleIdToAgentDto` (line 4)

### file:flat-agent/utils/transform-agent-entity-to-flat-agent.util.ts:10

**Constants:** 1
- `transformAgentEntityToFlatAgent` (line 10)


## FLAT ENTITY

**Files:** 78 | **Exports:** 98

### file:flat-entity/constant/all-entity-properties-configuration-by-metadata-name.constant.ts:41

**Constants:** 1
- `ALL_ENTITY_PROPERTIES_CONFIGURATION_BY_METADATA_NAME` (line 41)

**Types:** 3
- `MetadataEntityPropertyName` (line 1663)
- `MetadataEntityComparablePropertyName` (line 1670)
- `MetadataEntityOverridablePropertyName` (line 1679)

### file:flat-entity/constant/all-flat-entity-maps-properties.constant.ts:5

**Constants:** 1
- `ALL_FLAT_ENTITY_MAPS_PROPERTIES` (line 5)

### file:flat-entity/constant/all-many-to-one-metadata-foreign-key.constant.ts:35

**Constants:** 1
- `ALL_MANY_TO_ONE_METADATA_FOREIGN_KEY` (line 35)

### file:flat-entity/constant/all-many-to-one-metadata-relations.constant.ts:63

**Constants:** 1
- `ALL_MANY_TO_ONE_METADATA_RELATIONS` (line 63)

### file:flat-entity/constant/all-metadata-entity-by-metadata-name.constant.ts:35

**Constants:** 1
- `ALL_METADATA_ENTITY_BY_METADATA_NAME` (line 35)

### file:flat-entity/constant/all-metadata-names-sorted-atomically.constant.ts:3

**Constants:** 1
- `ALL_METADATA_NAMES_SORTED_ATOMICALLY` (line 3)

### file:flat-entity/constant/all-metadata-required-metadata-for-validation.constant.ts:14

**Constants:** 1
- `ALL_METADATA_REQUIRED_METADATA_FOR_VALIDATION` (line 19)

**Types:** 1
- `MetadataRelatedMetadataNameForValidation` (line 14)

### file:flat-entity/constant/all-metadata-serialized-relation.constant.ts:15

**Constants:** 1
- `ALL_METADATA_SERIALIZED_RELATION` (line 18)

**Types:** 1
- `MetadataSerializedRelatedMetadataName` (line 15)

### file:flat-entity/constant/all-one-to-many-metadata-relations.constant.ts:34

**Constants:** 1
- `ALL_ONE_TO_MANY_METADATA_RELATIONS` (line 34)

### file:flat-entity/constant/all-overridable-properties-by-metadata-name.constant.ts:22

**Constants:** 1
- `ALL_OVERRIDABLE_PROPERTIES_BY_METADATA_NAME` (line 22)

### file:flat-entity/constant/all-universal-flat-entity-properties-to-compare-and-stringify.constant.ts:75

**Constants:** 1
- `ALL_UNIVERSAL_FLAT_ENTITY_PROPERTIES_TO_COMPARE_AND_STRINGIFY` (line 75)

### file:flat-entity/constant/create-empty-all-flat-entity-maps.constant.ts:10

**Constants:** 1
- `createEmptyAllFlatEntityMaps` (line 10)

### file:flat-entity/constant/create-empty-flat-entity-maps.constant.ts:4

**Constants:** 1
- `createEmptyFlatEntityMaps` (line 4)

### file:flat-entity/exceptions/flat-entity-maps.exception.ts:10

**Classs:** 1
- `FlatEntityMapsException` (line 33)

**Constants:** 1
- `FlatEntityMapsExceptionCode` (line 10)

### file:flat-entity/filters/flat-entity-maps-graphql-api-exception.filter.ts:14

**NestJS Services:** 1
- `FlatEntityMapsGraphqlApiExceptionFilter` (line 14)

### file:flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.module.ts:141

**Classs:** 1
- `WorkspaceManyOrAllFlatEntityMapsCacheModule` (line 141)

### file:flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service.ts:8

**NestJS Services:** 1
- `WorkspaceManyOrAllFlatEntityMapsCacheService` (line 13)

**Types:** 1
- `FlatEntityMapsCacheKeyName` (line 8)

### file:flat-entity/types/add-suffix-to-entity-many-to-one-properties.type.ts:6

**Types:** 1
- `AddSuffixToEntityManyToOneProperties` (line 6)

### file:flat-entity/types/add-suffix-to-entity-one-to-many-properties.type.ts:6

**Types:** 1
- `AddSuffixToEntityOneToManyProperties` (line 6)

### file:flat-entity/types/all-flat-entities.type.ts:3

**Types:** 1
- `AllFlatEntities` (line 3)

### file:flat-entity/types/all-flat-entity-maps.type.ts:6

**Types:** 1
- `AllFlatEntityMaps` (line 6)

### file:flat-entity/types/all-flat-entity-types-by-metadata-name.ts:331

**Types:** 1
- `AllFlatEntityTypesByMetadataName` (line 331)

### file:flat-entity/types/cast-record-typeorm-date-properties-to-string.type.ts:1

**Types:** 1
- `CastRecordTypeOrmDatePropertiesToString` (line 1)

### file:flat-entity/types/extract-entity-many-to-one-entity-relation-properties.type.ts:4

**Types:** 1
- `ExtractEntityManyToOneEntityRelationProperties` (line 4)

### file:flat-entity/types/extract-entity-one-to-many-entity-relation-properties.type.ts:4

**Types:** 1
- `ExtractEntityOneToManyEntityRelationProperties` (line 4)

### file:flat-entity/types/extract-entity-related-entity-properties.type.ts:6

**Types:** 1
- `ExtractEntityRelatedEntityProperties` (line 6)

### file:flat-entity/types/flat-entity-from.type.ts:9

**Types:** 2
- `SyncableFlatEntity` (line 9)
- `FlatEntityFrom` (line 16)

### file:flat-entity/types/flat-entity-maps-key-to-metadata.ts:3

**Types:** 1
- `FlatEntityMapsKeyToMetadata` (line 3)

### file:flat-entity/types/flat-entity-maps.type.ts:4

**Types:** 1
- `FlatEntityMaps` (line 4)

### file:flat-entity/types/flat-entity-to-create-delete-update.type.ts:5

**Types:** 1
- `FlatEntityToCreateDeleteUpdate` (line 5)

### file:flat-entity/types/flat-entity-update.type.ts:16

**Types:** 1
- `FlatEntityUpdate` (line 16)

### file:flat-entity/types/from-metadata-entity-to-metadata-name.type.ts:9

**Types:** 1
- `FromMetadataEntityToMetadataName` (line 9)

### file:flat-entity/types/metadata-entity.type.ts:5

**Types:** 1
- `MetadataEntity` (line 5)

### file:flat-entity/types/metadata-flat-entity-and-related-flat-entity-maps-for-validation.type.ts:8

**Types:** 1
- `MetadataUniversalFlatEntityAndRelatedFlatEntityMapsForValidation` (line 8)

### file:flat-entity/types/metadata-flat-entity-maps.type.ts:7

**Types:** 1
- `MetadataFlatEntityMaps` (line 7)

### file:flat-entity/types/metadata-flat-entity.type.ts:5

**Types:** 1
- `MetadataFlatEntity` (line 5)

### file:flat-entity/types/metadata-many-to-one-join-column.type.ts:9

**Types:** 1
- `MetadataManyToOneJoinColumn` (line 9)

### file:flat-entity/types/metadata-many-to-one-related-metadata-names.type.ts:9

**Types:** 1
- `MetadataManyToOneRelatedMetadataNames` (line 9)

### file:flat-entity/types/metadata-name-and-relations.type.ts:23

**Types:** 1
- `MetadataNameAndRelations` (line 23)

### file:flat-entity/types/metadata-one-to-many-related-metadata-names.type.ts:9

**Types:** 1
- `MetadataOneToManyRelatedMetadataNames` (line 9)

### file:flat-entity/types/metadata-related-flat-entity-maps-keys.type.ts:6

**Types:** 1
- `MetadataRelatedFlatEntityMapsKeys` (line 6)

### file:flat-entity/types/metadata-related-types.type.ts:9

**Types:** 3
- `MetadataUniversalFlatEntityAndRelatedUniversalFlatEntityMaps` (line 9)
- `MetadataFlatEntityAndRelatedFlatEntityMaps` (line 16)
- `MetadataValidationRelatedUniversalFlatEntityMaps` (line 23)

### file:flat-entity/types/metadata-to-flat-entity-maps-key.ts:3

**Types:** 1
- `MetadataToFlatEntityMapsKey` (line 3)

### file:flat-entity/types/metadata-universal-flat-entity.type.ts:5

**Types:** 1
- `MetadataUniversalFlatEntity` (line 5)

### file:flat-entity/types/metadata-validation-related-metadata-names.type.ts:5

**Types:** 1
- `MetadataValidationRelatedMetadataNames` (line 5)

### file:flat-entity/types/metadata-workspace-migration-action.type.ts:6

**Types:** 4
- `WorkspaceMigrationActionType` (line 6)
- `MetadataUniversalWorkspaceMigrationActionsRecord` (line 10)
- `MetadataUniversalWorkspaceMigrationAction` (line 19)
- `MetadataFlatWorkspaceMigrationAction` (line 24)

### file:flat-entity/types/scalar-flat-entity.type.ts:4

**Types:** 1
- `ScalarFlatEntity` (line 4)

### file:flat-entity/utils/add-flat-entity-to-flat-entity-and-related-entity-maps-through-mutation-or-throw.util.ts:27

**Constants:** 1
- `addFlatEntityToFlatEntityAndRelatedEntityMapsThroughMutationOrThrow` (line 27)

### file:flat-entity/utils/add-flat-entity-to-flat-entity-maps-or-throw.util.ts:15

**Constants:** 1
- `addFlatEntityToFlatEntityMapsOrThrow` (line 15)

### file:flat-entity/utils/delete-flat-entity-from-flat-entity-and-related-entity-maps-through-mutation-or-throw.util.ts:27

**Constants:** 1
- `deleteFlatEntityFromFlatEntityAndRelatedEntityMapsThroughMutationOrThrow` (line 27)

### file:flat-entity/utils/delete-flat-entity-from-flat-entity-maps-or-throw.util.ts:11

**Constants:** 1
- `deleteFlatEntityFromFlatEntityMapsOrThrow` (line 18)

**Types:** 1
- `DeleteFlatEntityFromFlatEntityMapsOrThrowArgs` (line 11)

### file:flat-entity/utils/find-flat-entities-by-application-id.util.ts:6

**Constants:** 1
- `findFlatEntitiesByApplicationId` (line 6)

### file:flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps-or-throw.util.ts:11

**Constants:** 1
- `findFlatEntityByIdInFlatEntityMapsOrThrow` (line 17)

**Types:** 1
- `FindFlatEntityByIdInFlatEntityMapsOrThrowArgs` (line 11)

### file:flat-entity/utils/find-flat-entity-by-id-in-flat-entity-maps.util.ts:7

**Constants:** 1
- `findFlatEntityByIdInFlatEntityMaps` (line 7)

### file:flat-entity/utils/find-flat-entity-by-universal-identifier-or-throw.util.ts:12

**Constants:** 1
- `findFlatEntityByUniversalIdentifierOrThrow` (line 12)

### file:flat-entity/utils/find-flat-entity-by-universal-identifier.util.ts:5

**Constants:** 1
- `findFlatEntityByUniversalIdentifier` (line 5)

### file:flat-entity/utils/find-many-flat-entity-by-id-in-flat-entity-maps-or-throw.util.ts:7

**Constants:** 1
- `findManyFlatEntityByIdInFlatEntityMapsOrThrow` (line 13)

**Types:** 1
- `FindManyFlatEntityByIdInFlatEntityMapsOrThrowArgs` (line 7)

### file:flat-entity/utils/find-many-flat-entity-by-id-in-flat-entity-maps.util.ts:7

**Constants:** 1
- `findManyFlatEntityByIdInFlatEntityMaps` (line 14)

**Types:** 1
- `FindManyFlatEntityByIdInFlatEntityMapsArgs` (line 7)

### file:flat-entity/utils/find-many-flat-entity-by-universal-identifier-in-universal-flat-entity-maps-or-throw.util.ts:6

**Constants:** 1
- `findManyFlatEntityByUniversalIdentifierInUniversalFlatEntityMapsOrThrow` (line 13)

**Types:** 1
- `FindManyFlatEntityByUniversalIdentifierInUniversalFlatEntityMapsOrThrowArgs` (line 6)

### file:flat-entity/utils/find-many-flat-entity-by-universal-identifier-in-universal-flat-entity-maps.util.ts:8

**Constants:** 1
- `findManyFlatEntityByUniversalIdentifierInUniversalFlatEntityMaps` (line 15)

**Types:** 1
- `FindManyFlatEntityByUniversalIdentifierInUniversalFlatEntityMapsArgs` (line 8)

### file:flat-entity/utils/flat-entity-maps-exception-code-to-http-status.util.ts:5

**Constants:** 1
- `flatEntityMapsExceptionCodeToHttpStatus` (line 5)

### file:flat-entity/utils/get-metadata-entity-relation-properties.util.ts:6

**Constants:** 1
- `getMetadataEntityRelationProperties` (line 6)

### file:flat-entity/utils/get-metadata-flat-entity-maps-key.util.ts:6

**Constants:** 1
- `getMetadataFlatEntityMapsKey` (line 6)

### file:flat-entity/utils/get-metadata-many-to-one-related-names.util.ts:6

**Constants:** 1
- `getMetadataManyToOneRelatedNames` (line 6)

### file:flat-entity/utils/get-metadata-name-from-flat-entity-maps-key.util.ts:5

**Constants:** 1
- `getMetadataNameFromFlatEntityMapsKey` (line 5)

### file:flat-entity/utils/get-metadata-one-to-many-related-names.util.ts:6

**Constants:** 1
- `getMetadataOneToManyRelatedNames` (line 6)

### file:flat-entity/utils/get-metadata-related-metadata-names-for-validation.util.ts:8

**Constants:** 1
- `getMetadataRelatedMetadataNamesForValidation` (line 8)

### file:flat-entity/utils/get-metadata-related-metadata-names.util.ts:8

**Constants:** 1
- `getMetadataRelatedMetadataNames` (line 8)

### file:flat-entity/utils/get-metadata-serialized-relation-names.util.ts:8

**Constants:** 1
- `getMetadataSerializedRelationNames` (line 8)

### file:flat-entity/utils/get-sub-flat-entity-by-ids-maps-or-throw.util.ts:7

**Constants:** 1
- `getSubFlatEntityByIdsMapsOrThrow` (line 7)

### file:flat-entity/utils/get-sub-flat-entity-maps-by-application-ids-or-throw.util.ts:6

**Constants:** 1
- `getSubFlatEntityMapsByApplicationIdsOrThrow` (line 6)

### file:flat-entity/utils/get-sub-universal-flat-entity-by-universal-identifiers-maps-or-throw.util.ts:7

**Constants:** 1
- `getSubUniversalFlatEntityByUniversalIdentifiersMapsOrThrow` (line 7)

### file:flat-entity/utils/order-object-properties.util.ts:1

**Functions:** 1
- `orderObjectProperties` (line 1)

### file:flat-entity/utils/replace-flat-entity-in-flat-entity-maps-or-throw.util.ts:6

**Constants:** 1
- `replaceFlatEntityInFlatEntityMapsOrThrow` (line 13)

**Types:** 1
- `ReplaceFlatEntityInFlatEntityMapsOrThrowArgs` (line 6)

### file:flat-entity/utils/resolve-entity-relation-universal-identifiers.util.ts:56

**Constants:** 1
- `resolveEntityRelationUniversalIdentifiers` (line 56)

### file:flat-entity/utils/sort-metadata-names-children-first.util.ts:16

**Constants:** 1
- `sortMetadataNamesChildrenFirst` (line 16)

### file:flat-entity/utils/split-entities-by-removal-strategy.util.ts:5

**Constants:** 1
- `splitEntitiesByRemovalStrategy` (line 5)

### file:flat-entity/utils/split-entities-by-reset-strategy.util.ts:7

**Constants:** 1
- `splitEntitiesByResetStrategy` (line 7)


## FLAT FIELD METADATA

**Files:** 90 | **Exports:** 111

### file:flat-field-metadata/__mocks__/attachment-flat-fields.mock.ts:12

**Constants:** 1
- `ATTACHMENT_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/__mocks__/company-flat-fields.mock.ts:12

**Constants:** 1
- `COMPANY_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/__mocks__/get-flat-field-metadata.mock.ts:13

**Constants:** 2
- `getFlatFieldMetadataMock` (line 13)
- `getStandardFlatFieldMetadataMock` (line 65)

### file:flat-field-metadata/__mocks__/get-morph-or-relation-target-flat-field-metadata-mock.ts:23

**Constants:** 1
- `getRelationTargetFlatFieldMetadataMock` (line 23)

### file:flat-field-metadata/__mocks__/note-flat-fields.mock.ts:8

**Constants:** 1
- `NOTE_FLAT_FIELDS_MOCK` (line 8)

### file:flat-field-metadata/__mocks__/notetarget-flat-fields.mock.ts:12

**Constants:** 1
- `NOTETARGET_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/__mocks__/opportunity-flat-fields.mock.ts:12

**Constants:** 1
- `OPPORTUNITY_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/__mocks__/person-flat-fields.mock.ts:12

**Constants:** 1
- `PERSON_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/__mocks__/pet-flat-fields.mock.ts:8

**Constants:** 1
- `PET_FLAT_FIELDS_MOCK` (line 8)

### file:flat-field-metadata/__mocks__/rocket-flat-fields.mock.ts:8

**Constants:** 1
- `ROCKET_FLAT_FIELDS_MOCK` (line 8)

### file:flat-field-metadata/__mocks__/task-flat-fields.mock.ts:12

**Constants:** 1
- `TASK_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/__mocks__/tasktarget-flat-fields.mock.ts:12

**Constants:** 1
- `TASKTARGET_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/__mocks__/timelineactivity-flat-fields.mock.ts:12

**Constants:** 1
- `TIMELINEACTIVITY_FLAT_FIELDS_MOCK` (line 12)

### file:flat-field-metadata/constants/flat-field-metadata-editable-properties.constant.ts:3

**Constants:** 1
- `FLAT_FIELD_METADATA_EDITABLE_PROPERTIES` (line 3)

### file:flat-field-metadata/constants/flat-field-metadata-morph-relation-editable-properties-on-sibling-morph-relation-update.constant.ts:3

**Constants:** 1
- `FLAT_FIELD_METADATA_MORPH_RELATION_EDITABLE_PROPERTIES_ON_SIBLING_MORPH_RELATION_UPDATE_CONSTANT` (line 3)

### file:flat-field-metadata/constants/flat-field-metadata-relation-editable-properties-on-sibling-morph-or-relation-update.constant.ts:3

**Constants:** 1
- `FLAT_FIELD_METADATA_RELATION_EDITABLE_PROPERTIES_ON_SIBLING_MORPH_OR_RELATION_UPDATE_CONSTANT` (line 3)

### file:flat-field-metadata/constants/flat-field-metadata-relation-properties-to-compare.constant.ts:3

**Constants:** 1
- `FLAT_FIELD_METADATA_RELATION_PROPERTIES_TO_COMPARE` (line 3)

### file:flat-field-metadata/flat-field-metadata.module.ts:18

**Classs:** 1
- `FlatFieldMetadataModule` (line 18)

### file:flat-field-metadata/services/flat-field-metadata-type-validator.service.ts:49

**NestJS Services:** 1
- `FlatFieldMetadataTypeValidatorService` (line 49)

### file:flat-field-metadata/types/field-input-transpilation-result.type.ts:3

**Types:** 3
- `FailedFieldInputTranspilation` (line 3)
- `SuccessfulFieldInputTranspilation` (line 7)
- `FieldInputTranspilationResult` (line 11)

### file:flat-field-metadata/types/field-metadata-minimal-information.type.ts:3

**Types:** 1
- `FieldMetadataMinimalInformation` (line 3)

### file:flat-field-metadata/types/flat-field-metadata-editable-properties.constant.ts:3

**Types:** 1
- `FlatFieldMetadataEditableProperties` (line 3)

### file:flat-field-metadata/types/flat-field-metadata-relation-properties-to-compare.type.ts:3

**Types:** 1
- `FlatFieldMetadataRelationPropertiesToCompare` (line 3)

### file:flat-field-metadata/types/flat-field-metadata-type-validator.type.ts:8

**Types:** 2
- `FlatFieldMetadataTypeValidationArgs` (line 8)
- `FlatFieldMetadataTypeValidator` (line 18)

### file:flat-field-metadata/types/flat-field-metadata-validation-error.type.ts:5

**Types:** 1
- `FlatFieldMetadataValidationError` (line 5)

### file:flat-field-metadata/types/flat-field-metadata.type.ts:6

**Types:** 1
- `FlatFieldMetadata` (line 6)

### file:flat-field-metadata/utils/build-field-maps-from-flat-object-metadata.util.ts:10

**Constants:** 1
- `buildFieldMapsFromFlatObjectMetadata` (line 15)

**Types:** 1
- `FieldMapsForObject` (line 10)

### file:flat-field-metadata/utils/compare-two-flat-field-metadata-enum-options.util.ts:14

**Constants:** 1
- `compareTwoFlatFieldMetadataEnumOptions` (line 20)

**Types:** 1
- `CompareToFlatFieldMetadataEnumOptionsArgs` (line 14)

### file:flat-field-metadata/utils/compute-flat-field-metadata-related-flat-field-metadata.util.ts:10

**Constants:** 1
- `computeFlatFieldMetadataRelatedFlatFieldMetadata` (line 10)

### file:flat-field-metadata/utils/compute-flat-field-to-update-and-related-flat-field-to-update.util.ts:40

**Constants:** 1
- `computeFlatFieldToUpdateAndRelatedFlatFieldToUpdate` (line 40)

### file:flat-field-metadata/utils/compute-flat-field-to-update-from-morph-relation-update-payload.util.ts:29

**Constants:** 1
- `computeFlatFieldToUpdateFromMorphRelationUpdatePayload` (line 29)

### file:flat-field-metadata/utils/extract-junction-target-settings-from-settings.util.ts:11

**Constants:** 1
- `extractJunctionTargetSettingsFromSettings` (line 11)

### file:flat-field-metadata/utils/find-all-others-morph-relation-flat-field-metadatas-or-throw.util.ts:15

**Constants:** 1
- `findAllOthersMorphRelationFlatFieldMetadatasOrThrow` (line 20)

**Types:** 1
- `FindAllMorphRelationFlatFieldMetadatasOrThrowArgs` (line 15)

### file:flat-field-metadata/utils/find-field-related-index.util.ts:7

**Constants:** 1
- `findFieldRelatedIndexes` (line 7)

### file:flat-field-metadata/utils/find-flat-field-metadatas-related-to-morph-relation-or-throw.util.ts:9

**Constants:** 1
- `findFlatFieldMetadatasRelatedToMorphRelationOrThrow` (line 19)

**Types:** 1
- `FindFlatFieldMetadatasRelatedToMorphRelationOrThrowArgs` (line 9)

### file:flat-field-metadata/utils/find-relation-flat-field-metadatas-target-flat-field-metadata-or-throw.util.ts:13

**Constants:** 1
- `findRelationFlatFieldMetadataTargetFlatFieldMetadataOrThrow` (line 18)

**Types:** 1
- `GetRelationFlatFieldMetadatasUtilArgs` (line 13)

### file:flat-field-metadata/utils/from-create-field-input-to-flat-field-metadatas-to-create.util.ts:27

**Constants:** 1
- `fromCreateFieldInputToFlatFieldMetadatasToCreate` (line 32)

**Types:** 1
- `FromCreateFieldInputToFlatObjectMetadataArgs` (line 27)

### file:flat-field-metadata/utils/from-delete-field-input-to-flat-field-metadatas-to-delete.util.ts:28

**Constants:** 1
- `fromDeleteFieldInputToFlatFieldMetadatasToDelete` (line 28)

### file:flat-field-metadata/utils/from-field-metadata-entity-to-flat-field-metadata.util.ts:13

**Constants:** 1
- `fromFieldMetadataEntityToFlatFieldMetadata` (line 13)

### file:flat-field-metadata/utils/from-flat-field-metadata-to-field-metadata-dto.util.ts:4

**Constants:** 1
- `fromFlatFieldMetadataToFieldMetadataDto` (line 4)

### file:flat-field-metadata/utils/from-morph-or-relation-flat-field-metadata-to-relation-dto.util.ts:13

**Constants:** 1
- `fromMorphOrRelationFlatFieldMetadataToRelationDto` (line 13)

### file:flat-field-metadata/utils/from-morph-relation-create-field-input-to-flat-field-metadatas.util.ts:31

**Constants:** 1
- `fromMorphRelationCreateFieldInputToFlatFieldMetadatas` (line 31)

### file:flat-field-metadata/utils/from-relation-create-field-input-to-flat-field-metadatas.util.ts:29

**Constants:** 1
- `fromRelationCreateFieldInputToFlatFieldMetadatas` (line 29)

### file:flat-field-metadata/utils/from-update-field-input-to-flat-field-metadata.util.ts:44

**Constants:** 1
- `fromUpdateFieldInputToFlatFieldMetadata` (line 44)

### file:flat-field-metadata/utils/generate-index-for-flat-field-metadata.util.ts:14

**Constants:** 1
- `generateIndexForFlatFieldMetadata` (line 14)

### file:flat-field-metadata/utils/generate-morph-or-relation-flat-field-metadata-pair.util.ts:67

**Constants:** 1
- `generateMorphOrRelationFlatFieldMetadataPair` (line 72)

**Types:** 1
- `SourceTargetMorphOrRelationFlatFieldAndFlatIndex` (line 67)

### file:flat-field-metadata/utils/get-default-flat-field-metadata-from-create-field-input.util.ts:17

**Constants:** 1
- `getDefaultFlatFieldMetadata` (line 17)

### file:flat-field-metadata/utils/get-object-field-names-and-join-column-names.util.ts:14

**Constants:** 1
- `getObjectFieldNamesAndJoinColumnNames` (line 14)

### file:flat-field-metadata/utils/handle-enum-flat-field-metadata-update-side-effects.util.ts:36

**Constants:** 1
- `handleEnumFlatFieldMetadataUpdateSideEffects` (line 36)

### file:flat-field-metadata/utils/handle-field-metadata-deactivation-side-effects.util.ts:23

**Constants:** 1
- `handleFieldMetadataDeactivationSideEffects` (line 30)

**Types:** 1
- `FieldMetadataDeactivationSideEffect` (line 23)

### file:flat-field-metadata/utils/handle-flat-field-metadata-update-side-effect.util.ts:23

**Constants:** 2
- `FLAT_FIELD_METADATA_UPDATE_EMPTY_SIDE_EFFECTS` (line 48)
- `handleFlatFieldMetadataUpdateSideEffect` (line 64)

**Types:** 1
- `FlatFieldMetadataUpdateSideEffects` (line 23)

### file:flat-field-metadata/utils/handle-index-changes-during-field-update.util.ts:19

**Constants:** 1
- `handleIndexChangesDuringFieldUpdate` (line 42)

**Types:** 1
- `FieldMetadataUpdateIndexSideEffect` (line 19)

### file:flat-field-metadata/utils/handle-label-identifier-changes-during-field-update.util.ts:20

**Constants:** 1
- `handleLabelIdentifierChangesDuringFieldUpdate` (line 20)

### file:flat-field-metadata/utils/is-composite-flat-field-metadata.util.ts:9

**Constants:** 2
- `isCompositeFlatFieldMetadata` (line 9)
- `isCompositeUniversalFlatFieldMetadata` (line 14)

### file:flat-field-metadata/utils/is-enum-flat-field-metadata.util.ts:9

**Constants:** 2
- `isEnumFlatFieldMetadata` (line 9)
- `isEnumUniversalFlatFieldMetadata` (line 14)

### file:flat-field-metadata/utils/is-flat-field-metadata-name-synced-with-label.util.ts:7

**Constants:** 1
- `isFlatFieldMetadataNameSyncedWithLabel` (line 7)

### file:flat-field-metadata/utils/is-flat-field-metadata-of-type.util.ts:5

**Functions:** 1
- `isFlatFieldMetadataOfType` (line 5)

### file:flat-field-metadata/utils/is-flat-field-metadata-of-types.util.ts:5

**Functions:** 1
- `isFlatFieldMetadataOfTypes` (line 5)

### file:flat-field-metadata/utils/is-morph-or-relation-flat-field-metadata.util.ts:9

**Constants:** 2
- `isMorphOrRelationFlatFieldMetadata` (line 9)
- `isMorphOrRelationUniversalFlatFieldMetadata` (line 16)

### file:flat-field-metadata/utils/is-null-equivalent-text-default-value.util.ts:1

**Constants:** 1
- `isNullEquivalentTextDefaultValue` (line 1)

### file:flat-field-metadata/utils/nullify-empty-actor-default-value.util.ts:6

**Constants:** 1
- `nullifyEmptyActorDefaultValue` (line 6)

### file:flat-field-metadata/utils/nullify-empty-address-default-value.util.ts:6

**Constants:** 1
- `nullifyEmptyAddressDefaultValue` (line 6)

### file:flat-field-metadata/utils/nullify-empty-composite-default-value.util.ts:18

**Constants:** 1
- `nullifyEmptyCompositeDefaultValue` (line 18)

### file:flat-field-metadata/utils/nullify-empty-currency-default-value.util.ts:6

**Constants:** 1
- `nullifyEmptyCurrencyDefaultValue` (line 6)

### file:flat-field-metadata/utils/nullify-empty-emails-default-value.util.ts:8

**Constants:** 1
- `nullifyEmptyEmailsDefaultValue` (line 8)

### file:flat-field-metadata/utils/nullify-empty-full-name-default-value.util.ts:6

**Constants:** 1
- `nullifyEmptyFullNameDefaultValue` (line 6)

### file:flat-field-metadata/utils/nullify-empty-links-default-value.util.ts:8

**Constants:** 1
- `nullifyEmptyLinksDefaultValue` (line 8)

### file:flat-field-metadata/utils/nullify-empty-phones-default-value.util.ts:8

**Constants:** 1
- `nullifyEmptyPhonesDefaultValue` (line 8)

### file:flat-field-metadata/utils/nullify-empty-rich-text-default-value.util.ts:6

**Constants:** 1
- `nullifyEmptyRichTextDefaultValue` (line 6)

### file:flat-field-metadata/utils/recompute-index-on-flat-field-metadata-name-update.util.ts:16

**Constants:** 1
- `recomputeIndexOnFlatFieldMetadataNameUpdate` (line 16)

### file:flat-field-metadata/utils/recompute-view-filters-on-flat-field-metadata-options-update.util.ts:20

**Constants:** 1
- `recomputeViewFiltersOnFlatFieldMetadataOptionsUpdate` (line 24)

**Types:** 1
- `FlatViewFiltersToDeleteAndUpdate` (line 20)

### file:flat-field-metadata/utils/recompute-view-groups-on-enum-flat-field-metadata-is-nullable-update.util.ts:28

**Constants:** 1
- `recomputeViewGroupsOnEnumFlatFieldMetadataIsNullableUpdate` (line 28)

### file:flat-field-metadata/utils/recompute-view-groups-on-flat-field-metadata-options-update.util.ts:23

**Constants:** 1
- `recomputeViewGroupsOnFlatFieldMetadataOptionsUpdate` (line 28)

**Types:** 1
- `FlatViewGroupsToDeleteUpdateAndCreate` (line 23)

### file:flat-field-metadata/utils/resolve-morph-relations-from-flat-field-metadata.util.ts:19

**Constants:** 1
- `resolveMorphRelationsFromFlatFieldMetadata` (line 19)

### file:flat-field-metadata/utils/resolve-relation-from-flat-field-metadata.util.ts:21

**Constants:** 1
- `resolveRelationFromFlatFieldMetadata` (line 21)

### file:flat-field-metadata/utils/sanitize-raw-update-field-input.ts:25

**Constants:** 1
- `sanitizeRawUpdateFieldInput` (line 25)

### file:flat-field-metadata/utils/throw-on-field-input-transpilations-error.util.ts:13

**Constants:** 1
- `throwOnFieldInputTranspilationsError` (line 13)

### file:flat-field-metadata/validators/utils/validate-enum-flat-field-metadata.util.ts:356

**Constants:** 1
- `validateEnumSelectFlatFieldMetadata` (line 356)

### file:flat-field-metadata/validators/utils/validate-files-flat-field-metadata.util.ts:10

**Constants:** 1
- `validateFilesFlatFieldMetadata` (line 10)

### file:flat-field-metadata/validators/utils/validate-flat-field-metadata-name-availability.util.ts:42

**Constants:** 1
- `validateFlatFieldMetadataNameAvailability` (line 42)

### file:flat-field-metadata/validators/utils/validate-flat-field-metadata-name.util.ts:16

**Constants:** 1
- `validateFlatFieldMetadataName` (line 16)

### file:flat-field-metadata/validators/utils/validate-junction-target-settings.util.ts:31

**Constants:** 1
- `validateJunctionTargetSettings` (line 31)

### file:flat-field-metadata/validators/utils/validate-morph-or-relation-flat-field-join-column-name.util.ts:13

**Constants:** 1
- `validateMorphOrRelationFlatFieldJoinColumName` (line 13)

### file:flat-field-metadata/validators/utils/validate-morph-or-relation-flat-field-metadata.util.ts:23

**Constants:** 2
- `validateMorphOrRelationFlatFieldMetadataUpdates` (line 23)
- `validateMorphOrRelationFlatFieldMetadata` (line 91)

### file:flat-field-metadata/validators/utils/validate-morph-or-relation-flat-field-on-delete.util.ts:10

**Constants:** 1
- `validateMorphOrRelationFlatFieldOnDelete` (line 10)

### file:flat-field-metadata/validators/utils/validate-morph-relation-creation-payload.util.ts:26

**Constants:** 1
- `validateMorphRelationCreationPayload` (line 26)

### file:flat-field-metadata/validators/utils/validate-morph-relation-flat-field-metadata.util.ts:12

**Constants:** 1
- `validateMorphRelationFlatFieldMetadata` (line 12)

### file:flat-field-metadata/validators/utils/validate-position-flat-field-metadata.util.ts:8

**Constants:** 1
- `validatePositionFlatFieldMetadata` (line 8)

### file:flat-field-metadata/validators/utils/validate-relation-creation-payload.util.ts:22

**Constants:** 1
- `validateRelationCreationPayload` (line 22)

### file:flat-field-metadata/validators/utils/validate-ts-vector-flat-field-metadata.util.ts:8

**Constants:** 1
- `validateTsVectorFlatFieldMetadata` (line 8)


## FLAT INDEX METADATA

**Files:** 5 | **Exports:** 7

### file:flat-index-metadata/__mocks__/get-flat-index-metadata.mock.ts:16

**Constants:** 2
- `getFlatIndexMetadataMock` (line 16)
- `getStandardFlatIndexMetadataMock` (line 38)

### file:flat-index-metadata/exceptions/index-exception-code.ts:1

**Enums:** 1
- `IndexExceptionCode` (line 1)

### file:flat-index-metadata/types/flat-index-metadata.type.ts:6

**Types:** 2
- `FlatIndexFieldMetadata` (line 6)
- `FlatIndexMetadata` (line 8)

### file:flat-index-metadata/utils/from-flat-index-metadata-to-index-metadata-dto.util.ts:4

**Constants:** 1
- `fromFlatIndexMetadataToIndexMetadataDto` (line 4)

### file:flat-index-metadata/utils/from-index-metadata-entity-to-flat-index-metadata.util.ts:11

**Constants:** 1
- `fromIndexMetadataEntityToFlatIndexMetadata` (line 11)


## FLAT OBJECT METADATA

**Files:** 41 | **Exports:** 44

### file:flat-object-metadata/__mocks__/all-flat-object-metadatas.mock.ts:13

**Constants:** 1
- `ALL_FLAT_OBJECT_METADATA_MOCKS` (line 13)

### file:flat-object-metadata/__mocks__/attachment-flat-object.mock.ts:3

**Constants:** 1
- `ATTACHMENT_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/company-flat-object.mock.ts:3

**Constants:** 1
- `COMPANY_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/flat-object-metadata-maps.mock.ts:5

**Constants:** 1
- `FLAT_OBJECT_METADATA_MAPS_MOCKS` (line 5)

### file:flat-object-metadata/__mocks__/get-flat-object-metadata.mock.ts:9

**Constants:** 2
- `getFlatObjectMetadataMock` (line 9)
- `getStandardFlatObjectMetadataMock` (line 65)

### file:flat-object-metadata/__mocks__/note-flat-object.mock.ts:3

**Constants:** 1
- `NOTE_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/note-target-flat-object.mock.ts:3

**Constants:** 1
- `NOTE_TARGET_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/opportunity-flat-object.mock.ts:3

**Constants:** 1
- `OPPORTUNITY_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/person-flat-object.mock.ts:3

**Constants:** 1
- `PERSON_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/pet-flat-object.mock.ts:3

**Constants:** 1
- `PET_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/rocket-flat-object.mock.ts:3

**Constants:** 1
- `ROCKET_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/standard-relation-target-flat-object-metadata.mocks.ts:7

**Constants:** 1
- `STANDARD_RELATION_TARGET_FLAT_OBJECT_METADATA_MOCKS` (line 7)

### file:flat-object-metadata/__mocks__/task-flat-object.mock.ts:3

**Constants:** 1
- `TASK_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/task-target-flat-object.mock.ts:3

**Constants:** 1
- `TASK_TARGET_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/__mocks__/timeline-activity-flat-object.mock.ts:3

**Constants:** 1
- `TIMELINE_ACTIVITY_FLAT_OBJECT_MOCK` (line 3)

### file:flat-object-metadata/constants/flat-object-metadata-editable-properties.constant.ts:3

**Constants:** 1
- `FLAT_OBJECT_METADATA_EDITABLE_PROPERTIES` (line 3)

### file:flat-object-metadata/types/flat-object-metadata-validation-error.type.ts:5

**Types:** 1
- `FlatObjectMetadataValidationError` (line 5)

### file:flat-object-metadata/types/flat-object-metadata.type.ts:7

**Types:** 1
- `FlatObjectMetadata` (line 7)

### file:flat-object-metadata/types/object-metadata-minimal-information.type.ts:3

**Types:** 1
- `ObjectMetadataMinimalInformation` (line 3)

### file:flat-object-metadata/utils/are-flat-object-metadata-names-synced-with-labels.util.ts:7

**Constants:** 1
- `areFlatObjectMetadataNamesSyncedWithLabels` (line 7)

### file:flat-object-metadata/utils/build-object-id-by-name-maps.util.ts:6

**Constants:** 1
- `buildObjectIdByNameMaps` (line 6)

### file:flat-object-metadata/utils/from-create-object-input-to-flat-object-metadata-and-flat-field-metadatas-to-create.util.ts:22

**Constants:** 1
- `fromCreateObjectInputToFlatObjectMetadataAndFlatFieldMetadatasToCreate` (line 22)

### file:flat-object-metadata/utils/from-delete-object-input-to-flat-field-metadatas-to-delete.util.ts:26

**Constants:** 1
- `fromDeleteObjectInputToFlatFieldMetadatasToDelete` (line 26)

### file:flat-object-metadata/utils/from-flat-object-metadata-to-object-metadata-dto.util.ts:4

**Constants:** 1
- `fromFlatObjectMetadataToObjectMetadataDto` (line 4)

### file:flat-object-metadata/utils/from-object-metadata-entity-to-flat-object-metadata.util.ts:16

**Constants:** 1
- `fromObjectMetadataEntityToFlatObjectMetadata` (line 16)

### file:flat-object-metadata/utils/from-update-object-input-to-flat-object-metadata-and-related-flat-entities.util.ts:35

**Constants:** 1
- `fromUpdateObjectInputToFlatObjectMetadataAndRelatedFlatEntities` (line 35)

### file:flat-object-metadata/utils/get-flat-object-metadata-many-to-one-target-morph-relation-flat-field-metadatas-or-throw.util.ts:11

**Constants:** 1
- `getFlatObjectMetadataTargetMorphRelationFlatFieldMetadatasOrThrow` (line 11)

### file:flat-object-metadata/utils/get-morph-name-from-morph-field-metadata-name.util.ts:7

**Constants:** 1
- `getMorphNameFromMorphFieldMetadataName` (line 7)

### file:flat-object-metadata/utils/handle-flat-object-metadata-update-side-effect.util.ts:15

**Constants:** 1
- `handleFlatObjectMetadataUpdateSideEffect` (line 36)

**Types:** 1
- `FlatObjectMetadataUpdateSideEffects` (line 15)

### file:flat-object-metadata/utils/recompute-index-after-flat-object-metadata-singular-name-update.util.ts:11

**Constants:** 1
- `recomputeIndexAfterFlatObjectMetadataSingularNameUpdate` (line 11)

### file:flat-object-metadata/utils/recompute-search-vector-field-after-label-identifier-update.util.ts:25

**Constants:** 1
- `recomputeSearchVectorFieldAfterLabelIdentifierUpdate` (line 25)

### file:flat-object-metadata/utils/recompute-view-field-identifier-after-flat-object-identifier-update.util.ts:23

**Constants:** 1
- `recomputeViewFieldIdentifierAfterFlatObjectIdentifierUpdate` (line 23)

### file:flat-object-metadata/utils/rename-related-morph-field-on-object-names-update.util.ts:78

**Constants:** 1
- `renameRelatedMorphFieldOnObjectNamesUpdate` (line 78)

### file:flat-object-metadata/utils/sanitize-raw-update-object-input.ts:22

**Constants:** 1
- `sanitizeRawUpdateObjectInput` (line 22)

### file:flat-object-metadata/utils/search-and-replace-last.util.ts:1

**Constants:** 1
- `searchAndReplaceLast` (line 1)

### file:flat-object-metadata/validators/utils/validate-flat-object-metadata-identifiers.util.ts:15

**Constants:** 1
- `validateFlatObjectMetadataIdentifiers` (line 15)

### file:flat-object-metadata/validators/utils/validate-flat-object-metadata-label.util.ts:10

**Constants:** 1
- `validateFlatObjectMetadataLabel` (line 10)

### file:flat-object-metadata/validators/utils/validate-flat-object-metadata-name-and-labels.util.ts:20

**Constants:** 2
- `doesOtherObjectWithSameNameExists` (line 20)
- `validateFlatObjectMetadataNameAndLabels` (line 41)

### file:flat-object-metadata/validators/utils/validate-flat-object-metadata-name.util.ts:16

**Constants:** 1
- `validateFlatObjectMetadataNames` (line 16)

### file:flat-object-metadata/validators/utils/validate-object-metadata-cross-entity.util.ts:24

**Constants:** 1
- `validateObjectMetadataCrossEntity` (line 24)

### file:flat-object-metadata/validators/utils/validate-object-metadata-system-fields-integrity.util.ts:17

**Constants:** 1
- `validateObjectMetadataSystemFieldsIntegrity` (line 17)


## FLAT SKILL

**Files:** 9 | **Exports:** 9

### file:flat-skill/constants/flat-skill-editable-properties.constant.ts:3

**Constants:** 1
- `FLAT_SKILL_EDITABLE_PROPERTIES` (line 3)

### file:flat-skill/flat-skill.module.ts:21

**Classs:** 1
- `FlatSkillModule` (line 21)

### file:flat-skill/types/flat-skill-maps.type.ts:4

**Types:** 1
- `FlatSkillMaps` (line 4)

### file:flat-skill/types/flat-skill.type.ts:4

**Types:** 1
- `FlatSkill` (line 4)

### file:flat-skill/utils/from-create-skill-input-to-flat-skill-to-create.util.ts:8

**Constants:** 1
- `fromCreateSkillInputToUniversalFlatSkillToCreate` (line 8)

### file:flat-skill/utils/from-delete-skill-input-to-flat-skill-or-throw.util.ts:11

**Constants:** 1
- `fromDeleteSkillInputToFlatSkillOrThrow` (line 11)

### file:flat-skill/utils/from-flat-skill-to-skill-dto.util.ts:4

**Constants:** 1
- `fromFlatSkillToSkillDto` (line 4)

### file:flat-skill/utils/from-skill-entity-to-flat-skill.util.ts:10

**Constants:** 1
- `fromSkillEntityToFlatSkill` (line 10)

### file:flat-skill/utils/from-update-skill-input-to-flat-skill-to-update-or-throw.util.ts:14

**Constants:** 1
- `fromUpdateSkillInputToFlatSkillToUpdateOrThrow` (line 14)


## INDEX METADATA

**Files:** 25 | **Exports:** 29

### file:index-metadata/dtos/create-index-field.input.ts:8

**Classs:** 1
- `CreateIndexFieldInput` (line 8)

### file:index-metadata/dtos/create-index.input.ts:18

**Classs:** 1
- `CreateIndexInput` (line 18)

### file:index-metadata/dtos/create-one-index.input.ts:9

**Classs:** 1
- `CreateOneIndexInput` (line 9)

### file:index-metadata/dtos/delete-index.input.ts:9

**Classs:** 1
- `DeleteOneIndexInput` (line 9)

### file:index-metadata/dtos/index-field-metadata.dto.ts:42

**Classs:** 1
- `IndexFieldMetadataDTO` (line 42)

### file:index-metadata/dtos/index-metadata.dto.ts:50

**Classs:** 1
- `IndexMetadataDTO` (line 50)

### file:index-metadata/index-field-metadata.entity.ts:19

**Classs:** 1
- `IndexFieldMetadataEntity` (line 19)

### file:index-metadata/index-field-metadata.exception.ts:6

**Classs:** 1
- `IndexMetadataException` (line 6)

**Enums:** 1
- `IndexMetadataExceptionCode` (line 19)

### file:index-metadata/index-metadata.entity.ts:30

**Classs:** 1
- `IndexMetadataEntity` (line 30)

### file:index-metadata/index-metadata.module.ts:58

**Classs:** 1
- `IndexMetadataModule` (line 58)

### file:index-metadata/index-metadata.resolver.ts:31

**Classs:** 1
- `IndexMetadataResolver` (line 31)

**GraphQL Mutations:** 2
- `createOneIndex` (line 58)
- `deleteOneIndex` (line 76)

### file:index-metadata/interfaces/index-field-metadata.interface.ts:5

**Interfaces:** 1
- `IndexFieldMetadataInterface` (line 5)

### file:index-metadata/interfaces/index-metadata.interface.ts:5

**Interfaces:** 1
- `IndexMetadataInterface` (line 5)

### file:index-metadata/services/index-metadata.service.ts:29

**NestJS Services:** 1
- `IndexMetadataService` (line 29)

### file:index-metadata/types/indexType.types.ts:1

**Enums:** 1
- `IndexType` (line 1)

### file:index-metadata/utils/compute-unique-field-metadata-ids-from-flat-index-maps.util.ts:7

**Constants:** 1
- `computeUniqueFieldMetadataIdsFromFlatIndexMaps` (line 7)

### file:index-metadata/utils/compute-unique-field-metadata-ids-from-index-entities.util.ts:4

**Constants:** 1
- `computeUniqueFieldMetadataIdsFromIndexEntities` (line 4)

### file:index-metadata/utils/compute-unique-field-metadata-ids-from-indexes.util.ts:16

**Constants:** 1
- `computeUniqueFieldMetadataIdsFromIndexes` (line 16)

### file:index-metadata/utils/generate-deterministic-index-name-v2.ts:18

**Constants:** 1
- `generateDeterministicIndexNameV2` (line 18)

### file:index-metadata/utils/generate-deterministic-index-name.ts:3

**Constants:** 1
- `generateDeterministicIndexName` (line 3)

### file:index-metadata/utils/generate-flat-index.util.ts:17

**Constants:** 1
- `generateFlatIndexMetadataWithNameOrThrow` (line 23)

**Types:** 1
- `GenerateFlatIndexArgs` (line 17)

### file:index-metadata/utils/index-metadata-graphql-api-exception-handler.util.ts:17

**Constants:** 1
- `indexMetadataGraphqlApiExceptionHandler` (line 17)

### file:index-metadata/utils/validate-can-create-unique-index.util.ts:14

**Constants:** 1
- `validateCanCreateUniqueIndex` (line 14)

### file:index-metadata/utils/validate-index-type-against-fields.util.ts:22

**Constants:** 1
- `validateIndexTypeAgainstFieldsOrThrow` (line 22)

### file:index-metadata/utils/validate-no-duplicate-unique-index.util.ts:19

**Constants:** 1
- `validateNoDuplicateUniqueIndexOrThrow` (line 19)


## MINIMAL METADATA

**Files:** 7 | **Exports:** 8

### file:minimal-metadata/dtos/collection-hash.dto.ts:9

**Classs:** 1
- `CollectionHashDTO` (line 9)

### file:minimal-metadata/dtos/minimal-metadata.dto.ts:8

**Classs:** 1
- `MinimalMetadataDTO` (line 8)

### file:minimal-metadata/dtos/minimal-object-metadata.dto.ts:8

**Classs:** 1
- `MinimalObjectMetadataDTO` (line 8)

### file:minimal-metadata/dtos/minimal-view.dto.ts:9

**Classs:** 1
- `MinimalViewDTO` (line 9)

### file:minimal-metadata/minimal-metadata.module.ts:13

**Classs:** 1
- `MinimalMetadataModule` (line 13)

### file:minimal-metadata/minimal-metadata.resolver.ts:16

**Classs:** 1
- `MinimalMetadataResolver` (line 16)

**GraphQL Querys:** 1
- `minimalMetadata` (line 22)

### file:minimal-metadata/minimal-metadata.service.ts:35

**NestJS Services:** 1
- `MinimalMetadataService` (line 35)


## OBJECT METADATA

**Files:** 35 | **Exports:** 48

### file:object-metadata/constants/object-metadata-standard-overrides-properties.constant.ts:3

**Constants:** 1
- `OBJECT_METADATA_STANDARD_OVERRIDES_PROPERTIES` (line 3)

### file:object-metadata/constants/object-metadata.constants.ts:1

**Constants:** 1
- `DEFAULT_LABEL_IDENTIFIER_FIELD_NAME` (line 1)

### file:object-metadata/constants/partial-system-flat-field-metadatas.constant.ts:250

**Constants:** 1
- `PARTIAL_SYSTEM_FLAT_FIELD_METADATAS` (line 250)

### file:object-metadata/controllers/object-metadata.controller.ts:73

**Classs:** 1
- `ObjectMetadataController` (line 73)

### file:object-metadata/dtos/create-object.input.ts:20

**Classs:** 2
- `CreateObjectInput` (line 20)
- `CreateOneObjectInput` (line 94)

### file:object-metadata/dtos/delete-object.input.ts:9

**Classs:** 1
- `DeleteOneObjectInput` (line 9)

### file:object-metadata/dtos/object-metadata-with-fields.dto.ts:4

**Types:** 1
- `ObjectMetadataWithFieldsDTO` (line 4)

### file:object-metadata/dtos/object-metadata.dto.ts:31

**Classs:** 1
- `ObjectMetadataDTO` (line 31)

### file:object-metadata/dtos/object-record-count.dto.ts:4

**Classs:** 1
- `ObjectRecordCountDTO` (line 4)

### file:object-metadata/dtos/object-standard-overrides.dto.ts:8

**Classs:** 1
- `ObjectStandardOverridesDTO` (line 8)

### file:object-metadata/dtos/update-object.input.ts:17

**Classs:** 2
- `UpdateObjectPayload` (line 17)
- `UpdateOneObjectInput` (line 87)

### file:object-metadata/filters/object-metadata-rest-api-exception.filter.ts:38

**Classs:** 1
- `ObjectMetadataRestApiExceptionFilter` (line 38)

### file:object-metadata/interceptors/object-metadata-graphql-api-exception.interceptor.ts:13

**NestJS Services:** 1
- `ObjectMetadataGraphqlApiExceptionInterceptor` (line 13)

### file:object-metadata/object-metadata.entity.ts:31

**Classs:** 1
- `ObjectMetadataEntity` (line 31)

### file:object-metadata/object-metadata.exception.ts:8

**Classs:** 1
- `ObjectMetadataException` (line 53)

**Enums:** 1
- `ObjectMetadataExceptionCode` (line 8)

### file:object-metadata/object-metadata.module.ts:106

**Classs:** 1
- `ObjectMetadataModule` (line 106)

### file:object-metadata/object-metadata.resolver.ts:44

**Classs:** 1
- `ObjectMetadataResolver` (line 44)

**GraphQL Mutations:** 3
- `createOneObject` (line 137)
- `deleteOneObject` (line 156)
- `updateOneObject` (line 175)

**GraphQL Querys:** 1
- `objectRecordCounts` (line 53)

### file:object-metadata/object-metadata.service.ts:56

**NestJS Services:** 1
- `ObjectMetadataService` (line 56)

### file:object-metadata/object-record-count.service.ts:12

**NestJS Services:** 1
- `ObjectRecordCountService` (line 12)

### file:object-metadata/tools/object-metadata-tools.factory.ts:101

**NestJS Services:** 1
- `ObjectMetadataToolsFactory` (line 101)

### file:object-metadata/types/object-metadata-standard-overrides-properties.types.ts:3

**Types:** 1
- `ObjectMetadataStandardOverridesProperties` (line 3)

### file:object-metadata/utils/assert-mutation-not-on-remote-object.util.ts:7

**Constants:** 1
- `assertMutationNotOnRemoteObject` (line 7)

### file:object-metadata/utils/build-default-flat-field-metadatas-for-custom-object.util.ts:17

**Constants:** 1
- `buildDefaultFlatFieldMetadatasForCustomObject` (line 113)

**Types:** 1
- `DefaultFlatFieldForCustomObjectMaps` (line 17)

### file:object-metadata/utils/build-default-index-for-custom-object.util.ts:10

**Constants:** 1
- `buildDefaultIndexesForCustomObject` (line 10)

### file:object-metadata/utils/build-default-relation-flat-field-metadatas-for-custom-object.util.ts:36

**Constants:** 1
- `buildDefaultRelationFlatFieldMetadatasForCustomObject` (line 54)

**Types:** 1
- `BuildDefaultRelationFieldsForCustomObjectArgs` (line 36)

### file:object-metadata/utils/build-description-for-relation-field-on-from-field.util.ts:2

**Constants:** 1
- `buildDescriptionForRelationFieldMetadataOnFromField` (line 2)

### file:object-metadata/utils/build-description-for-relation-field-on-to-field.util.ts:2

**Constants:** 1
- `buildDescriptionForRelationFieldMetadataOnToField` (line 2)

### file:object-metadata/utils/compute-flat-default-record-page-layout-to-create.util.ts:16

**Constants:** 1
- `computeFlatDefaultRecordPageLayoutToCreate` (line 16)

### file:object-metadata/utils/compute-flat-record-page-fields-view-to-create.util.ts:12

**Constants:** 1
- `computeFlatRecordPageFieldsViewToCreate` (line 12)

### file:object-metadata/utils/compute-flat-view-fields-to-create.util.ts:9

**Constants:** 1
- `computeFlatViewFieldsToCreate` (line 9)

### file:object-metadata/utils/from-object-metadata-entity-to-object-metadata-dto.util.ts:4

**Constants:** 1
- `fromObjectMetadataEntityToObjectMetadataDto` (line 4)

### file:object-metadata/utils/object-metadata-exception-code-to-http-status.util.ts:5

**Constants:** 1
- `objectMetadataExceptionCodeToHttpStatus` (line 5)

### file:object-metadata/utils/object-metadata-graphql-api-exception-handler.util.ts:18

**Constants:** 1
- `objectMetadataGraphqlApiExceptionHandler` (line 18)

### file:object-metadata/utils/resolve-object-metadata-standard-override.util.ts:9

**Constants:** 1
- `resolveObjectMetadataStandardOverride` (line 9)

### file:object-metadata/utils/to-legacy-object-metadata-response.util.ts:5

**Constants:** 5
- `toLegacyObjectMetadataListResponse` (line 5)
- `toLegacyObjectMetadataFindOneResponse` (line 19)
- `toLegacyObjectMetadataCreateResponse` (line 23)
- `toLegacyObjectMetadataUpdateResponse` (line 27)
- `toLegacyObjectMetadataDeleteResponse` (line 31)


## SEARCH FIELD METADATA

**Files:** 3 | **Exports:** 3

### file:search-field-metadata/constants/search-vector-field.constants.ts:3

**Constants:** 1
- `SEARCH_VECTOR_FIELD` (line 3)

### file:search-field-metadata/search-field-metadata.entity.ts:25

**Classs:** 1
- `SearchFieldMetadataEntity` (line 25)

### file:search-field-metadata/search-field-metadata.module.ts:11

**Classs:** 1
- `SearchFieldMetadataModule` (line 11)


## SKILL

**Files:** 10 | **Exports:** 18

### file:skill/dtos/create-skill.input.ts:8

**Classs:** 1
- `CreateSkillInput` (line 8)

### file:skill/dtos/skill.dto.ts:14

**Classs:** 1
- `SkillDTO` (line 14)

### file:skill/dtos/update-skill.input.ts:14

**Classs:** 1
- `UpdateSkillInput` (line 14)

### file:skill/entities/skill.entity.ts:18

**Classs:** 1
- `SkillEntity` (line 18)

### file:skill/interceptors/skill-graphql-api-exception.interceptor.ts:13

**NestJS Services:** 1
- `SkillGraphqlApiExceptionInterceptor` (line 13)

### file:skill/skill.exception.ts:7

**Classs:** 1
- `SkillException` (line 29)

**Enums:** 1
- `SkillExceptionCode` (line 7)

### file:skill/skill.module.ts:29

**Classs:** 1
- `SkillModule` (line 29)

### file:skill/skill.resolver.ts:28

**Classs:** 1
- `SkillResolver` (line 28)

**GraphQL Mutations:** 5
- `createSkill` (line 47)
- `updateSkill` (line 55)
- `deleteSkill` (line 63)
- `activateSkill` (line 71)
- `deactivateSkill` (line 79)

**GraphQL Querys:** 2
- `skills` (line 32)
- `skill` (line 39)

### file:skill/skill.service.ts:25

**NestJS Services:** 1
- `SkillService` (line 25)

### file:skill/utils/skill-graphql-api-exception-handler.util.ts:14

**Constants:** 1
- `skillGraphqlApiExceptionHandler` (line 14)


## TYPES

**Files:** 1 | **Exports:** 1

### file:types/field-metadata-map.ts:3

**Types:** 1
- `FieldMetadataMap` (line 3)


## UTILS

**Files:** 10 | **Exports:** 12

### file:utils/belongs-to-twenty-standard-app.util.ts:4

**Constants:** 1
- `belongsToTwentyStandardApp` (line 4)

### file:utils/compute-metadata-name-from-label-or-throw.util.ts:11

**Constants:** 1
- `computeMetadataNameFromLabelOrThrow` (line 11)

### file:utils/constants/identifier-min-char-length.constants.ts:1

**Constants:** 1
- `IDENTIFIER_MIN_CHAR_LENGTH` (line 1)

### file:utils/exceptions/invalid-metadata.exception.ts:7

**Classs:** 1
- `InvalidMetadataException` (line 46)

**Enums:** 1
- `InvalidMetadataExceptionCode` (line 7)

### file:utils/is-caller-overriding-entity.util.ts:1

**Constants:** 1
- `isCallerOverridingEntity` (line 1)

### file:utils/is-caller-twenty-standard-app.util.ts:4

**Constants:** 1
- `isCallerTwentyStandardApp` (line 4)

### file:utils/resolve-flat-entity-overridable-properties.util.ts:8

**Constants:** 1
- `resolveFlatEntityOverridableProperties` (line 8)

### file:utils/resolve-overridable-entity-property.util.ts:1

**Constants:** 1
- `resolveOverridableEntityProperty` (line 1)

### file:utils/sanitize-overridable-entity-input.util.ts:12

**Constants:** 1
- `sanitizeOverridableEntityInput` (line 12)

### file:utils/validate-database-identifier-length.utils.ts:4

**Constants:** 2
- `exceedsDatabaseIdentifierMaximumLength` (line 4)
- `beneathDatabaseIdentifierMinimumLength` (line 7)


## WORKSPACE FEATURE FLAGS MAP CACHE

**Files:** 1 | **Exports:** 1

### file:workspace-feature-flags-map-cache/workspace-feature-flags-map-cache.module.ts:15

**Classs:** 1
- `WorkspaceFeatureFlagsMapCacheModule` (line 15)


## WORKSPACE METADATA VERSION

**Files:** 3 | **Exports:** 4

### file:workspace-metadata-version/exceptions/workspace-metadata-version.exception.ts:7

**Classs:** 1
- `WorkspaceMetadataVersionException` (line 22)

**Enums:** 1
- `WorkspaceMetadataVersionExceptionCode` (line 7)

### file:workspace-metadata-version/services/workspace-metadata-version.service.ts:16

**NestJS Services:** 1
- `WorkspaceMetadataVersionService` (line 16)

### file:workspace-metadata-version/workspace-metadata-version.module.ts:20

**Classs:** 1
- `WorkspaceMetadataVersionModule` (line 20)


