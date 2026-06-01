import { z } from "zod";

// PORT-NOTE: Originally a NestJS GraphQL @ObjectType DTO.
// Ported to a plain TypeScript type + Zod schema.

export type SendChatMessageResultDTO = {
  messageId: string;
  queued: boolean;
  streamId?: string;
};

export const SendChatMessageResultDTOSchema = z.object({
  messageId: z.string(),
  queued: z.boolean(),
  streamId: z.string().optional(),
});
