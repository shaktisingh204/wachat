import { z } from 'zod';

// PORT-NOTE: class-validator DTO ported to a plain TypeScript type + Zod schema.

export const generateTextInputSchema = z.object({
  systemPrompt: z.string().optional(),
  userPrompt: z.string().min(1),
  modelId: z.string().optional(),
});

export type GenerateTextInput = z.infer<typeof generateTextInputSchema>;
