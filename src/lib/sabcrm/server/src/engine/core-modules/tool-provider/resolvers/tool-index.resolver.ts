import "server-only";

// PORT-NOTE: NestJS GraphQL resolver converted to plain server-logic functions.
// The original resolver exposed two GraphQL queries:
//   - getToolIndex(workspaceId, userWorkspaceId) → ToolIndexEntry[]
//   - getToolInputSchema(toolName, workspaceId, userWorkspaceId) → object | null
// These are expressed here as plain async functions. Wire them into Next.js
// Route Handlers or Server Actions as needed.

import { type ToolIndexEntry } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type";
import { type ToolRegistryService } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/services/tool-registry.service";
import { type UserRoleService } from "@/lib/sabcrm/server/src/engine/metadata-modules/user-role/user-role.service";

// DTO shape (mirrors the original GraphQL @ObjectType)
export type ToolIndexEntryDTO = {
  name: string;
  description: string;
  category: string;
  objectName?: string;
  icon?: string;
  inputSchema?: object;
};

export type GetToolIndexOptions = {
  workspaceId: string;
  userWorkspaceId: string;
  userId?: string;
};

export type GetToolInputSchemaOptions = {
  toolName: string;
  workspaceId: string;
  userWorkspaceId: string;
  userId?: string;
};

export class ToolIndexResolver {
  constructor(
    private readonly toolRegistryService: ToolRegistryService,
    private readonly userRoleService: UserRoleService,
  ) {}

  // Equivalent of the GraphQL `getToolIndex` query.
  async getToolIndex(
    options: GetToolIndexOptions,
  ): Promise<ToolIndexEntryDTO[]> {
    const { workspaceId, userWorkspaceId, userId } = options;

    const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
      userWorkspaceId,
      workspaceId,
    });

    if (!roleId) {
      return [];
    }

    const entries = await this.toolRegistryService.buildToolIndex(
      workspaceId,
      roleId,
      { userId, userWorkspaceId },
    );

    return entries as ToolIndexEntryDTO[];
  }

  // Equivalent of the GraphQL `getToolInputSchema` query.
  // Resolves the inputSchema for a single tool on demand.
  async getToolInputSchema(
    options: GetToolInputSchemaOptions,
  ): Promise<object | null> {
    const { toolName, workspaceId, userWorkspaceId, userId } = options;

    const roleId = await this.userRoleService.getRoleIdForUserWorkspace({
      userWorkspaceId,
      workspaceId,
    });

    if (!roleId) {
      return null;
    }

    const schemas = await this.toolRegistryService.resolveSchemas([toolName], {
      workspaceId,
      roleId,
      rolePermissionConfig: { unionOf: [roleId] },
      userId,
      userWorkspaceId,
    });

    return schemas.get(toolName) ?? null;
  }
}

// Standalone action-style wrappers for use from Next.js Route Handlers.
export function createToolIndexResolver(
  toolRegistryService: ToolRegistryService,
  userRoleService: UserRoleService,
): ToolIndexResolver {
  return new ToolIndexResolver(toolRegistryService, userRoleService);
}

export type { ToolIndexEntry };
