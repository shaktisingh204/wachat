// PORT-NOTE: Stub type for ToolOutput referenced by ToolProvider interface.
// Mirrors twenty-server engine/core-modules/tool/types/tool-output.type.

export type ToolOutput = {
  result?: unknown;
  error?: string;
  [key: string]: unknown;
};
