// PORT-NOTE: Ported from twenty-server AgentTurnDTO.
// NestJS GraphQL @ObjectType/@Field decorators removed.
// AgentTurnEvaluationDTO is inlined here as a plain type since the monitor
// module dto may not be ported yet; the shape is preserved exactly.

import { z } from "zod";

import { AgentMessageDTOSchema } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/dtos/agent-message.dto";

// Inline from ai-agent-monitor/dtos/agent-turn-evaluation.dto.ts
export const AgentTurnEvaluationDTOSchema = z.object({
  id: z.string().uuid(),
  turnId: z.string().uuid(),
  score: z.number().int(),
  comment: z.string().nullable(),
  createdAt: z.date(),
});

export type AgentTurnEvaluationDTO = z.infer<typeof AgentTurnEvaluationDTOSchema>;

export const AgentTurnDTOSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  evaluations: z.array(AgentTurnEvaluationDTOSchema),
  messages: z.array(AgentMessageDTOSchema),
  createdAt: z.date(),
});

export type AgentTurnDTO = z.infer<typeof AgentTurnDTOSchema>;
