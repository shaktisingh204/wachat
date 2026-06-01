// PORT-NOTE: Ported from twenty-server agent-execution-result.type.ts.
// Plain TypeScript interface; no NestJS or GraphQL dependencies.

import type { LanguageModelUsage } from "ai";

export interface AgentExecutionResult {
  result: object;
  usage: LanguageModelUsage;
  cacheCreationTokens: number;
  nativeWebSearchCallCount: number;
  hasNoMoreAvailableCredits: boolean;
}
