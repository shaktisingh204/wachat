import { z } from "zod";

// PORT-NOTE: Originally a NestJS GraphQL @ObjectType DTO.
// Ported to a plain TypeScript type + Zod schema.

export type AgentChatEventDTO = {
  threadId: string;
  // Typed as JSON because the payload is AgentChatSubscriptionEvent
  // (a discriminated union defined in twenty-shared).
  event: Record<string, unknown>;
};

export const AgentChatEventDTOSchema = z.object({
  threadId: z.string(),
  event: z.record(z.unknown()),
});
