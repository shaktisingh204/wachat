// PORT-NOTE: Ported from twenty-server workflow-agent-registry-tool-categories.const.ts.
// ToolCategory enum is re-exported from the ported shared layer.

import { ToolCategory } from "@/lib/sabcrm/shared/src/ai/constants/tool-category.const";

export const WORKFLOW_AGENT_REGISTRY_TOOL_CATEGORIES: ToolCategory[] = [
  ToolCategory.DATABASE_CRUD,
  ToolCategory.ACTION,
];
