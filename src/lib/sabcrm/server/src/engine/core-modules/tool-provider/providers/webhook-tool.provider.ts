import "server-only";

import { type ToolSet } from "ai";
import { ToolCategory } from "@/lib/sabcrm/shared/ai";
import { PermissionFlagType } from "@/lib/sabcrm/shared/constants";

import { type GenerateDescriptorOptions } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type";
import { type ToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider.interface";
import { type ToolProviderContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type";
import { type ToolDescriptor } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-descriptor.type";
import { type ToolIndexEntry } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type";
import { executeToolFromToolSet } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/execute-tool-from-tool-set.util";
import { toolSetToDescriptors } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/tool-set-to-descriptors.util";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type PermissionsService } from "@/lib/sabcrm/server/src/engine/metadata-modules/permissions/permissions.service";
import { type WebhookToolWorkspaceService } from "@/lib/sabcrm/server/src/engine/metadata-modules/webhook/tools/services/webhook-tool.workspace-service";

// PORT-NOTE: NestJS @Injectable() / DI removed; construct directly.
export class WebhookToolProvider implements ToolProvider {
  readonly category = ToolCategory.WEBHOOK;

  constructor(
    private readonly webhookToolService: WebhookToolWorkspaceService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async isAvailable(context: ToolProviderContext): Promise<boolean> {
    return this.permissionsService.checkRolesPermissions(
      context.rolePermissionConfig,
      context.workspaceId,
      PermissionFlagType.API_KEYS_AND_WEBHOOKS,
    );
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    return toolSetToDescriptors(
      this.buildToolSet(context),
      ToolCategory.WEBHOOK,
      { includeSchemas: options?.includeSchemas ?? true },
    );
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    return executeToolFromToolSet(
      this.buildToolSet(context),
      toolName,
      args,
      ToolCategory.WEBHOOK,
    );
  }

  private buildToolSet(context: ToolProviderContext): ToolSet {
    return this.webhookToolService.generateWebhookTools(context.workspaceId);
  }
}
