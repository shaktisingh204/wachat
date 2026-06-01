import "server-only";

import { type ToolSet } from "ai";
import { ToolCategory } from "@/lib/sabcrm/shared/ai";

import { type GenerateDescriptorOptions } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type";
import { type ToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider.interface";
import { type ToolProviderContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type";
import { type ToolDescriptor } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-descriptor.type";
import { type ToolIndexEntry } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type";
import { executeToolFromToolSet } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/execute-tool-from-tool-set.util";
import { toolSetToDescriptors } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/utils/tool-set-to-descriptors.util";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type NavigationMenuItemToolWorkspaceService } from "@/lib/sabcrm/server/src/engine/metadata-modules/navigation-menu-item/tools/services/navigation-menu-item-tool.workspace-service";

// PORT-NOTE: NestJS @Injectable() / DI removed; construct directly.
export class NavigationMenuItemToolProvider implements ToolProvider {
  readonly category = ToolCategory.NAVIGATION_MENU_ITEM;

  constructor(
    private readonly navigationMenuItemToolService: NavigationMenuItemToolWorkspaceService,
  ) {}

  async isAvailable(_context: ToolProviderContext): Promise<boolean> {
    return true;
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    return toolSetToDescriptors(
      this.buildToolSet(context),
      ToolCategory.NAVIGATION_MENU_ITEM,
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
      ToolCategory.NAVIGATION_MENU_ITEM,
    );
  }

  private buildToolSet(context: ToolProviderContext): ToolSet {
    return this.navigationMenuItemToolService.generateNavigationMenuItemTools(
      context.workspaceId,
      context.userWorkspaceId,
    );
  }
}
