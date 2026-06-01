// PORT-NOTE: Pure type file.
// twenty-shared/ai ToolCategory inlined; replace with the real import if
// twenty-shared is added to the SabNode workspace.

import { type ToolCategory } from '@/lib/sabcrm/server/src/engine/core-modules/tool-provider/interfaces/tool-provider.interface';

export type ToolRetrievalOptions = {
  categories?: ToolCategory[];
  excludeTools?: string[];
  wrapWithErrorContext?: boolean;
  includeLoadingMessage?: boolean;
  // Apply output compaction (strip nulls/empty values) to dispatch results
  // before returning. Chat enables this to reduce token usage in the
  // conversation context; MCP and workflow agents leave raw output intact.
  compactOutput?: boolean;
};
