// PORT-NOTE: Ported from twenty-server AgentTurnEvaluationDTO.
// NestJS GraphQL @ObjectType/@Field decorators and class-validator decorators removed.
// Exported as a plain TypeScript type plus a zod schema for validation.

import { z } from "zod";

export const AgentTurnEvaluationDTOSchema = z.object({
  id: z.string().uuid(),
  turnId: z.string().uuid(),
  score: z.number().int(),
  comment: z.string().nullable(),
  createdAt: z.date(),
});

export type AgentTurnEvaluationDTO = z.infer<typeof AgentTurnEvaluationDTOSchema>;
