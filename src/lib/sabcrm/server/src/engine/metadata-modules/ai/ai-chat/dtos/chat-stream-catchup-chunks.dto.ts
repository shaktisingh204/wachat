import { z } from "zod";

// PORT-NOTE: Originally a NestJS GraphQL @ObjectType DTO.
// Ported to a plain TypeScript type + Zod schema.

export type ChatStreamCatchupChunksDTO = {
  chunks: Record<string, unknown>[];
  maxSeq: number;
};

export const ChatStreamCatchupChunksDTOSchema = z.object({
  chunks: z.array(z.record(z.unknown())),
  maxSeq: z.number().int(),
});
