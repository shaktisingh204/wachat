// PORT-NOTE: workspace-iterator.module.ts — NestJS module wiring.
// In SabNode (Next.js + Mongo) there is no NestJS DI. Import
// WorkspaceIteratorService directly from its module path.
// See: src/lib/sabcrm/server/src/database/commands/command-runners/workspace-iterator.service.ts

export const WORKSPACE_ITERATOR_MODULE_PROVIDERS = [
  'WorkspaceIteratorService',
] as const;

export const WORKSPACE_ITERATOR_MODULE_EXPORTS = [
  'WorkspaceIteratorService',
] as const;
