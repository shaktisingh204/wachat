import { z } from "zod";

// PORT-NOTE: Originally a NestJS GraphQL @InputType DTO.
// Ported to a plain TypeScript type + Zod schema for validation.
// UUIDScalarType replaced with z.string().uuid().

export type FileAttachmentInput = {
  id: string;
  filename: string;
};

export const FileAttachmentInputSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
});
