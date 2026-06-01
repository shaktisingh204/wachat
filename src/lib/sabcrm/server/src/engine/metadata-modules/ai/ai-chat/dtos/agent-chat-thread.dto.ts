import { z } from "zod";

// PORT-NOTE: Originally a NestJS GraphQL @ObjectType DTO.
// Ported to a plain TypeScript type + Zod schema.
// @HideField() on userWorkspaceId is preserved as a comment — callers must
// strip this field before sending responses to the client.

export type AgentChatThreadDTO = {
  id: string;
  title: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  contextWindowTokens: number | null;
  conversationSize: number;
  // Credits are converted from internal precision to display precision
  // (internal / 1000) at the resolver level
  totalInputCredits: number;
  totalOutputCredits: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  lastMessageAt: Date | null;
  /** @HideField — must not be sent to the client */
  userWorkspaceId: string;
};

export const AgentChatThreadDTOSchema = z.object({
  id: z.string(),
  title: z.string(),
  totalInputTokens: z.number().int(),
  totalOutputTokens: z.number().int(),
  contextWindowTokens: z.number().int().nullable(),
  conversationSize: z.number().int(),
  totalInputCredits: z.number(),
  totalOutputCredits: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  lastMessageAt: z.date().nullable(),
  userWorkspaceId: z.string(),
});
