import { z } from 'zod';

// PORT-NOTE: Ported from NestJS @InputType DeleteOneFieldInput.
// @IDField from @ptc-org/nestjs-query-graphql is just a UUID field.

export const DeleteOneFieldInputSchema = z.object({
  id: z.string().uuid(),
});

export type DeleteOneFieldInput = z.infer<typeof DeleteOneFieldInputSchema>;
