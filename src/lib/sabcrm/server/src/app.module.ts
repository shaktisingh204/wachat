// PORT-NOTE: app.module.ts — NestJS AppModule root wiring.
// In SabNode (Next.js + Mongo) there is no NestJS bootstrap. This registry
// documents the top-level modules that the original Twenty server wired together
// so downstream porting can track which features are in scope.

export const APP_MODULE_IMPORTS = [
  // GraphQL API layers
  'CoreGraphQLApiModule',
  'MetadataGraphQLApiModule',
  'AdminPanelGraphQLApiModule',
  // REST + MCP
  'RestApiModule',
  'McpModule',
  // Core engine
  'CoreEngineModule',
  // Business modules
  'ModulesModule',
  // ORM / data
  'TwentyORMModule',
  'GlobalWorkspaceDataSourceModule',
  'ClickHouseModule',
  // Middleware
  'MiddlewareModule',
  'WorkspaceMetadataVersionModule',
  'WorkspaceCacheStorageModule',
  // i18n
  'I18nModule',
] as const;

export type AppModuleImport = (typeof APP_MODULE_IMPORTS)[number];
