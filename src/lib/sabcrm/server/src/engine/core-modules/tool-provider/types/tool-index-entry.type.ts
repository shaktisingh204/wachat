import { type ToolCategory } from "@/lib/sabcrm/shared/ai";

import { type ToolExecutionRef } from "@/lib/sabcrm/server/src/engine/core-modules/tool-provider/types/tool-execution-ref.type";

export type ToolIndexEntry = {
  name: string;
  description: string;
  category: ToolCategory;
  executionRef: ToolExecutionRef;
  objectName?: string;
  operation?: string;
  icon?: string;
};
