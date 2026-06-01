// PORT-NOTE: NestJS @Module() has no direct Next.js equivalent.
// This registry file re-exports all ported workspace pieces so that
// import paths remain stable across the codebase.
//
// Wired NestJS providers/modules (original):
//   TypeORMModule, TypeOrmModule.forFeature([WorkspaceEntity, BillingSubscriptionEntity])
//   MetricsModule, StandardObjectsPrefillModule
//   NestjsQueryGraphQLModule.forFeature({...})
//   WorkspaceService, WorkspaceGaugeService, WorkspaceEntityCacheProviderService
//   WorkspaceResolver, BillingDisabledGuard
//   CheckCustomDomainValidRecordsCronCommand / CronJob
//   + ~20 imported modules (billing, file, token, etc.)
//
// In Next.js: import each piece directly from its target path.

export {
  getWorkspaceCollection,
  getWorkspaceCollectionAsync,
  ensureWorkspaceIndexes,
  type WorkspaceDocument,
  WORKSPACE_DOCUMENT_DEFAULTS,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.entity";

export {
  WorkspaceException,
  WorkspaceExceptionCode,
  WorkspaceNotFoundDefaultError,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.exception";

export {
  workspaceGraphqlApiExceptionHandler,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/utils/workspace-graphql-api-exception-handler.util";

export {
  getAuthProvidersByWorkspace,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/utils/get-auth-providers-by-workspace.util";

export {
  registerWorkspaceGauges,
  getWorkspaceCountByStatus,
  getDeletedWorkspacesCount,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace-gauge.service";

export {
  workspaceValidator,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.validate";

export {
  workspaceAutoResolverOpts,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.auto-resolver-opts";
