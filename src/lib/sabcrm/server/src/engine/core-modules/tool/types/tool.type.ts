import { type ZodTypeAny } from 'zod';

import { type ToolExecutionContext } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-execution-context.type';
import { type ToolInput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-input.type';
import { type ToolOutput } from '@/lib/sabcrm/server/src/engine/core-modules/tool/types/tool-output.type';

// PORT-NOTE: FlexibleSchema<unknown> from @ai-sdk/provider-utils is not available in
// the SabNode dependency tree. We substitute ZodTypeAny which covers the practical
// use (every tool in the Twenty source uses a Zod schema). If the ai-sdk package is
// later added, this can be tightened.
export type FlexibleSchema = ZodTypeAny;

// PORT-NOTE: PermissionFlagType is sourced from twenty-shared/constants. We keep
// the flag as a plain string union type to avoid pulling in the vendored package.
export type PermissionFlagType = string;

export type Tool = {
  description: string;
  inputSchema: FlexibleSchema;
  execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput>;
  flag?: PermissionFlagType;
};
