import "server-only";

import { type ToolSet } from "ai";
import { PermissionFlagType } from "@/lib/sabcrm/shared/constants";

import { type GenerateDescriptorOptions } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type";
import { type ToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider.interface";
import { type ToolProviderContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type";

import { ToolCategory } from "@/lib/sabcrm/shared/ai";
import { type ToolDescriptor } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-descriptor.type";
import { type ToolIndexEntry } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type";
import { executeToolFromToolSet } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/execute-tool-from-tool-set.util";
import { toolSetToDescriptors } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/tool-set-to-descriptors.util";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type FieldMetadataToolsFactory } from "@/lib/sabcrm/server/src/engine/metadata-modules/field-metadata/tools/field-metadata-tools.factory";
import { type ObjectMetadataToolsFactory } from "@/lib/sabcrm/server/src/engine/metadata-modules/object-metadata/tools/object-metadata-tools.factory";
import { type PermissionsService } from "@/lib/sabcrm/server/src/engine/metadata-modules/permissions/permissions.service";

// PORT-NOTE: NestJS @Injectable() / DI removed; construct directly.
export class MetadataToolProvider implements ToolProvider {
  readonly category = ToolCategory.METADATA;

  constructor(
    private readonly objectMetadataToolsFactory: ObjectMetadataToolsFactory,
    private readonly fieldMetadataToolsFactory: FieldMetadataToolsFactory,
    private readonly permissionsService: PermissionsService,
  ) {}

  async isAvailable(context: ToolProviderContext): Promise<boolean> {
    return this.permissionsService.checkRolesPermissions(
      context.rolePermissionConfig,
      context.workspaceId,
      PermissionFlagType.DATA_MODEL,
    );
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const toolSet = this.buildToolSet(context);

    return toolSetToDescriptors(toolSet, ToolCategory.METADATA, {
      includeSchemas: options?.includeSchemas ?? true,
      icon: "IconSettings",
    });
  }

  async executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput> {
    const toolSet = this.buildToolSet(context);

    return executeToolFromToolSet(
      toolSet,
      toolName,
      args,
      ToolCategory.METADATA,
    );
  }

  private buildToolSet(context: ToolProviderContext): ToolSet {
    return {
      ...this.objectMetadataToolsFactory.generateTools(context.workspaceId),
      ...this.fieldMetadataToolsFactory.generateTools(context.workspaceId),
    };
  }
}
