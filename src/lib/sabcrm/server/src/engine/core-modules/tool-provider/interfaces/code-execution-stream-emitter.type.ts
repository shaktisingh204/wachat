// PORT-NOTE: Pure type file — twenty-shared/ai import preserved as a local
// inline type since twenty-shared is not installed in the SabNode workspace.
// If twenty-shared is added to the workspace, replace with:
//   import { type CodeExecutionData } from 'twenty-shared/ai';

/**
 * Mirrors twenty-shared/ai CodeExecutionData.
 * Extend this type if additional fields are published by the engine.
 */
export type CodeExecutionData = {
  type: string;
  [key: string]: unknown;
};

export type CodeExecutionStreamEmitter = (data: CodeExecutionData) => void;
