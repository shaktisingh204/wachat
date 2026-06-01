import "server-only";

import { isDefined } from "@/lib/sabcrm/shared/utils";
import { DEFAULT_TOOL_INPUT_SCHEMA } from "@/lib/sabcrm/shared/logic-function";

import { type GenerateDescriptorOptions } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type";
import { type ToolProvider } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider.interface";
import { type ToolProviderContext } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type";

import { ToolCategory } from "@/lib/sabcrm/shared/ai";
import { type ToolDescriptor } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-descriptor.type";
import { type ToolIndexEntry } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type";
import { type ToolOutput } from "@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type";
import { type WorkspaceManyOrAllFlatEntityMapsCacheService } from "@/lib/sabcrm/server/src/engine/metadata-modules/flat-entity/services/workspace-many-or-all-flat-entity-maps-cache.service";
import { type FlatLogicFunction } from "@/lib/sabcrm/server/src/engine/metadata-modules/logic-function/types/flat-logic-function.type";

// PORT-NOTE: NestJS @Injectable() / DI removed; construct directly.
export class LogicFunctionToolProvider implements ToolProvider {
  readonly category = ToolCategory.LOGIC_FUNCTION;

  constructor(
    private readonly flatEntityMapsCacheService: WorkspaceManyOrAllFlatEntityMapsCacheService,
  ) {}

  async isAvailable(_context: ToolProviderContext): Promise<boolean> {
    return true;
  }

  // Logic function tools emit `executionRef.kind === 'logic_function'`
  // descriptors and are dispatched inline by ToolExecutorService. The
  // static-tool path is unreachable for this provider; this method exists
  // only to satisfy the interface.
  async executeStaticTool(
    toolName: string,
    _args: Record<string, unknown>,
    _context: ToolProviderContext,
  ): Promise<ToolOutput> {
    throw new Error(
      `LogicFunctionToolProvider does not emit static-kind descriptors (tool: ${toolName})`,
    );
  }

  async generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]> {
    const includeSchemas = options?.includeSchemas ?? true;

    const { flatLogicFunctionMaps } =
      await this.flatEntityMapsCacheService.getOrRecomputeManyOrAllFlatEntityMaps(
        {
          workspaceId: context.workspaceId,
          flatMapsKeys: ["flatLogicFunctionMaps"],
        },
      );

    const logicFunctionsWithSchema = Object.values(
      flatLogicFunctionMaps.byUniversalIdentifier,
    ).filter(
      (fn): fn is FlatLogicFunction =>
        isDefined(fn) &&
        isDefined(fn.toolTriggerSettings) &&
        fn.deletedAt === null,
    );

    const descriptors: (ToolIndexEntry | ToolDescriptor)[] = [];

    for (const logicFunction of logicFunctionsWithSchema) {
      const toolName = this.buildLogicFunctionToolName(logicFunction.name);

      const base: ToolIndexEntry = {
        name: toolName,
        description:
          logicFunction.description ||
          `Execute the ${logicFunction.name} logic function`,
        category: ToolCategory.LOGIC_FUNCTION,
        executionRef: {
          kind: "logic_function",
          logicFunctionId: logicFunction.id,
        },
      };

      if (includeSchemas) {
        descriptors.push({
          ...base,
          inputSchema:
            (logicFunction.toolTriggerSettings?.inputSchema as object) ??
            DEFAULT_TOOL_INPUT_SCHEMA,
        });
      } else {
        descriptors.push(base);
      }
    }

    return descriptors;
  }

  private buildLogicFunctionToolName(functionName: string): string {
    return `app_${functionName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")}`;
  }
}
