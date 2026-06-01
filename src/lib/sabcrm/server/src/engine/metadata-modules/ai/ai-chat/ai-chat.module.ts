// PORT-NOTE: NestJS @Module has no Next.js equivalent.
// This file re-exports the pieces that AiChatModule wired together so
// consumers can import from a single entry point.
//
// Original NestJS wiring (summarised):
//   imports:  TypeOrmModule (AgentChatThreadEntity, FileEntity, ...),
//             AiAgentExecutionModule, BillingModule, ThrottlerModule, FileModule,
//             PermissionsModule, SkillModule, WorkspaceCacheStorageModule,
//             WorkspaceCacheModule, WorkspaceDomainsModule, TwentyORMModule,
//             TokenModule, UserWorkspaceModule, AiBillingModule, MetricsModule,
//             ToolProviderModule, DashboardToolsModule, WorkflowToolsModule
//   providers: AgentChatCancelSubscriberService, AgentChatEventPublisherService,
//              AgentChatResolver, AgentChatSubscriptionResolver, AgentChatService,
//              AgentChatStreamingService, AgentTitleGenerationService,
//              ChatExecutionService, MessagePruningService, StreamAgentChatJob,
//              SystemPromptBuilderService, AiGraphqlApiExceptionInterceptor,
//              + workspace-scoped repositories for the above entities
//   exports:  AgentChatService, AgentChatStreamingService,
//             TypeOrmModule.forFeature([AgentChatThreadEntity])

export type { AgentChatThreadDocument } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity";
export {
  getAgentChatThreadCollection,
  AGENT_CHAT_THREAD_COLLECTION,
} from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-chat/entities/agent-chat-thread.entity";
