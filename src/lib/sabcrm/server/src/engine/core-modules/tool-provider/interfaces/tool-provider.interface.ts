// PORT-NOTE: Pure interface file.
// twenty-shared/ai ToolCategory inlined since twenty-shared is not in the
// SabNode workspace. Replace with the real import if twenty-shared is added.

import { type GenerateDescriptorOptions } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/generate-descriptor-options.type';
import { type ToolProviderContext } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider-context.type';
import { type ToolDescriptor } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-descriptor.type';
import { type ToolIndexEntry } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-index-entry.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-output.type';

/**
 * Mirrors twenty-shared/ai ToolCategory.
 */
export enum ToolCategory {
  ACTION = 'ACTION',
  DATABASE = 'DATABASE',
  LOGIC_FUNCTION = 'LOGIC_FUNCTION',
  METADATA = 'METADATA',
  NAVIGATION = 'NAVIGATION',
  VIEW = 'VIEW',
  WEBHOOK = 'WEBHOOK',
  WORKFLOW = 'WORKFLOW',
  DASHBOARD = 'DASHBOARD',
}

export interface ToolProvider {
  readonly category: ToolCategory;

  isAvailable(context: ToolProviderContext): Promise<boolean>;

  generateDescriptors(
    context: ToolProviderContext,
    options?: GenerateDescriptorOptions,
  ): Promise<(ToolIndexEntry | ToolDescriptor)[]>;

  // Execute a tool whose descriptor has `executionRef.kind === 'static'` and
  // `descriptor.category === this.category`. Providers own the execution of
  // the tools they emit.
  //
  // Providers that never emit 'static' descriptors (database CRUD, logic
  // functions) should throw — the call is unreachable by construction.
  executeStaticTool(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolProviderContext,
  ): Promise<ToolOutput>;
}
