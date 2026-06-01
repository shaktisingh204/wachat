import "server-only";

import { type ToolSet } from "ai";
import { PermissionFlagType } from "@/lib/sabcrm/shared/constants";

import { type GenerateDescriptorOptions } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type";
import { type ToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider.interface";
import { type ToolProviderContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type";

import { WORKFLOW_TOOL_SERVICE_TOKEN } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/constants/workflow-tool-service.token";
import { ToolCategory } from "@/lib/sabcrm/shared/ai";
import { CoreObjectNameSingular } from "@/lib/sabcrm/shared/types";
import { type ToolDescriptor } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-descriptor.type";
import { type ToolIndexEntry } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type";
import { executeToolFromToolSet } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/execute-tool-from-tool-set.util";
import { resolveObjectIcon } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/resolve-object-icon.util";
import { toolSetToDescriptors } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/tool-set-to-descriptors.util";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type WorkspaceManyOrAllFlatEntityMapsCacheService } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service";
import { type PermissionsService } from "@/lib/sabcrm/server/src/engine/metadata-modules/permissions/permissions.service";
import type { WorkflowToolWorkspaceService } from "@/lib/sabcrm/server/src/modules/workflow/workflow-tools/services/workflow-tool.workspace-service";

// PORT-NOTE: NestJS @Injectable() / @Inject() / @Optional() removed.
// workflowToolService is nullable (token-based optional injection in NestJS);
// pass null when the module is not available.
export { WORKFLOW_TOOL_SERVICE_TOKEN };

export class WorkflowToolProvider implements ToolProvider {
  readonly category = ToolCategory.WORKFLOW;

  constructor(
    private readonly workflowToolService: WorkflowToolWorkspaceService | null,
    private readonly permissionsService: PermissionsService,
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
  ) {}

  async isAvailable(context: ToolProviderContext): Promise<boolean> {
    if (!this.workflowToolService) {
      return false;
    }

    return this.permissionsService.checkRolesPermissions(
      context.rolePermissionConfig,
      context.workspaceId,
      PermissionFlagType.WORKFLOWS,
    );
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const toolSet = await this.buildToolSet(context);

    if (!toolSet) {
      return [];
    }

    const icon = await resolveObjectIcon(
      this.flatEntityMapsCacheService,
      context.workspaceId,
      CoreObjectNameSingular.Workflow,
    );

    return toolSetToDescriptors(toolSet, ToolCategory.WORKFLOW, {
      includeSchemas: options?.includeSchemas ?? true,
      icon,
    });
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const toolSet = await this.buildToolSet(context);

    if (!toolSet) {
      throw new Error(
        `Workflow tool service is not available (tool: ${toolName})`,
      );
    }

    return executeToolFromToolSet(
      toolSet,
      toolName,
      args,
      ToolCategory.WORKFLOW,
    );
  }

  private async buildToolSet(
    context: ToolProviderContext,
  ): Promise<ToolSet | null> {
    if (!this.workflowToolService) {
      return null;
    }

    return this.workflowToolService.generateWorkflowTools(
      context.workspaceId,
      context.rolePermissionConfig,
    );
  }
}
