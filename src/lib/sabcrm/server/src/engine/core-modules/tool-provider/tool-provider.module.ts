// PORT-NOTE: NestJS @Module() has no direct Next.js equivalent.
// This file is a registry/index that documents what the original NestJS module
// wired together. Use it as a reference when constructing the service graph
// manually (e.g. in a server action or API route initialiser).
//
// Original module wired:
//   Providers:
//     - ToolIndexResolver
//     - ToolExecutorService
//     - ActionToolProvider
//     - DashboardToolProvider      (optional DASHBOARD_TOOL_SERVICE_TOKEN)
//     - DatabaseToolProvider
//     - MetadataToolProvider
//     - NavigationMenuItemToolProvider
//     - LogicFunctionToolProvider
//     - ViewToolProvider
//     - WebhookToolProvider
//     - WorkflowToolProvider        (optional WORKFLOW_TOOL_SERVICE_TOKEN)
//     - TOOL_PROVIDERS multi-token array of all above providers
//     - ToolRegistryService
//
//   Imports:
//     - ToolModule, RecordCrudModule, AiModelsModule, AiAgentExecutionModule (forwardRef)
//     - ObjectMetadataModule, FieldMetadataModule, PermissionsModule
//     - ViewModule, ViewFieldModule, ViewFilterModule, ViewSortModule
//     - WorkspaceCacheModule, WorkspaceManyOrAllFlatEntityMapsCacheModule
//     - LogicFunctionModule, NavigationMenuItemModule, WebhookModule
//     - UserRoleModule, TypeOrmModule.forFeature([UserEntity])
//
//   Exports: ToolRegistryService
//
// WorkflowToolsModule and DashboardToolsModule are NOT imported here to avoid
// circular dep via AiAgentExecutionModule; their services are injected as optional
// tokens (WORKFLOW_TOOL_SERVICE_TOKEN / DASHBOARD_TOOL_SERVICE_TOKEN).

export { DashboardToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/dashboard-tool.provider";
export { DatabaseToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/database-tool.provider";
export { LogicFunctionToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/logic-function-tool.provider";
export { MetadataToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/metadata-tool.provider";
export { NavigationMenuItemToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/navigation-menu-item-tool.provider";
export { ViewToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/view-tool.provider";
export { WebhookToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/webhook-tool.provider";
export { WorkflowToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/providers/workflow-tool.provider";
export {
  ToolExecutorService,
  createToolExecutorService,
} from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/services/tool-executor.service";
export {
  ToolRegistryService,
  createToolRegistryService,
} from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/services/tool-registry.service";
export {
  ToolIndexResolver,
  createToolIndexResolver,
} from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/resolvers/tool-index.resolver";
