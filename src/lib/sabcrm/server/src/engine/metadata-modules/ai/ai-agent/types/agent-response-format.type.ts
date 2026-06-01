// PORT-NOTE: Ported from twenty-server ai-agent/types/agent-response-format.type.ts
// Plain TypeScript type — no NestJS or Mongo dependency.

import type { AgentResponseSchema } from "@/lib/sabcrm/shared/src/ai/index";

export type AgentResponseFormatType = AgentResponseFormat["type"];

export type AgentTextResponseFormat = { type: "text" };
export type AgentJsonResponseFormat = {
  type: "json";
  schema: AgentResponseSchema;
};
export type AgentResponseFormat =
  | AgentTextResponseFormat
  | AgentJsonResponseFormat;
