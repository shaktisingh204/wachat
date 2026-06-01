// PORT-NOTE: workspaceAutoResolverOpts was generated for @ptc-org/nestjs-query-graphql
// auto-resolvers which have no equivalent in Next.js (App Router). This module
// exports a plain configuration object that documents what the auto-resolvers
// did so the equivalent API routes can be scaffolded manually.

import { type WorkspaceDocument } from "@/lib/sabcrm/server/src/engine/core-modules/workspace/workspace.entity";

/**
 * Documents the CRUD surface that the NestJS auto-resolver exposed.
 * In Next.js, create a /api/sabcrm/workspaces route for each enabled operation.
 */
export const workspaceAutoResolverOpts = {
  EntityClass: "WorkspaceDocument" as unknown as WorkspaceDocument,
  // UpdateDTOClass: UpdateWorkspaceInput — see workspace.service for updateWorkspaceById
  enableTotalCount: true,
  pagingStrategy: "CURSOR",
  read: {
    many: { disabled: true },
    one: { disabled: true },
  },
  create: {
    many: { disabled: true },
    one: { disabled: true },
  },
  update: {
    one: { disabled: true },
    many: { disabled: true },
  },
  delete: { many: { disabled: true }, one: { disabled: true } },
  // guards: [WorkspaceAuthGuard] — enforce via middleware in Next.js
} as const;
