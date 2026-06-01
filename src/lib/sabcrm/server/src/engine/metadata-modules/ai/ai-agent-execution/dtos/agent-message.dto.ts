// PORT-NOTE: Ported from twenty-server AgentMessageDTO.
// NestJS GraphQL @ObjectType/@Field decorators removed.
// Exported as a plain TypeScript type + zod schema.

import { z } from "zod";

import { AgentMessagePartDTOSchema } from "@/lib/sabcrm/server/src/engine/metadata-modules/ai/ai-agent-execution/dtos/agent-message-part.dto";

export const AgentMessageDTOSchema = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  turnId: z.string().uuid().nullable(),
  agentId: z.string().uuid().nullable(),
  role: z.enum(["system", "user", "assistant"]),
  status: z.enum(["queued", "sent"]),
  parts: z.array(AgentMessagePartDTOSchema),
  processedAt: z.date().nullable(),
  createdAt: z.date(),
});

export type AgentMessageDTO = z.infer<typeof AgentMessageDTOSchema>;
