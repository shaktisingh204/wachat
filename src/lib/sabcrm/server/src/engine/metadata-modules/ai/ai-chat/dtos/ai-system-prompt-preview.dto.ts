import { z } from "zod";

// PORT-NOTE: Originally NestJS GraphQL @ObjectType DTOs.
// Ported to plain TypeScript types + Zod schemas.

export type AiSystemPromptSectionDTO = {
  title: string;
  content: string;
  estimatedTokenCount: number;
};

export const AiSystemPromptSectionDTOSchema = z.object({
  title: z.string(),
  content: z.string(),
  estimatedTokenCount: z.number().int(),
});

export type AiSystemPromptPreviewDTO = {
  sections: AiSystemPromptSectionDTO[];
  estimatedTokenCount: number;
};

export const AiSystemPromptPreviewDTOSchema = z.object({
  sections: z.array(AiSystemPromptSectionDTOSchema),
  estimatedTokenCount: z.number().int(),
});
