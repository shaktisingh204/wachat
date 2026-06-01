// PORT-NOTE: CodeExecutionStreamEmitter is a NestJS/EventEmitter concept.
// In SabNode this is typed as a generic callback — callers may pass any function.
export type CodeExecutionStreamEmitter = (...args: unknown[]) => void;

export type ToolExecutionContext = {
  workspaceId: string;
  userId?: string;
  userWorkspaceId?: string;
  onCodeExecutionUpdate?: CodeExecutionStreamEmitter;
};
