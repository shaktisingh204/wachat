// PORT-NOTE: Ported from twenty-server ai-agent/dtos/create-agent.input.ts (GraphQL InputType).
// NestJS GraphQL @InputType/@Field/@HideField decorators, class-validator, and
// class-transformer removed. Exported as a plain TS type + zod schema.
// Discriminated union for responseFormat validation is preserved via zod discriminatedUnion.

import { z } from "zod";

import type { AgentResponseFormat } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/agent-response-format.type";
import type { ModelConfiguration } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent/types/modelConfiguration";
import type { ModelId } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-models/types/model-id.type";

export const CreateAgentInputSchema = z.object({
  name: z.string().optional(),
  label: z.string().min(1),
  icon: z.string().optional(),
  description: z.string().optional(),
  prompt: z.string().min(1),
  modelId: z.string().min(1),
  roleId: z.string().uuid().optional(),
  responseFormat: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("text") }),
      z.object({ type: z.literal("json"), schema: z.record(z.unknown()) }),
    ])
    .optional(),
  modelConfiguration: z.record(z.unknown()).optional(),
  evaluationInputs: z.array(z.string()).optional(),
  /** Hidden from API — set internally by the resolver */
  applicationId: z.string().uuid().optional(),
});

export type CreateAgentInput = {
  name?: string;
  label: string;
  icon?: string;
  description?: string;
  prompt: string;
  modelId: ModelId;
  roleId?: string;
  responseFormat?: AgentResponseFormat;
  modelConfiguration?: ModelConfiguration;
  evaluationInputs?: string[];
  /** Internal — set by resolver, not exposed to API consumers */
  applicationId?: string;
};
