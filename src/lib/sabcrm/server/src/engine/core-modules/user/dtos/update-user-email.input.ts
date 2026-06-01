import { z } from "zod";

// PORT-NOTE: NestJS @ArgsType GraphQL input → TypeScript type + Zod schema.

export const UpdateUserEmailInputSchema = z.object({
  newEmail: z.string().email().min(1),
  verifyEmailRedirectPath: z.string().optional(),
});

export type UpdateUserEmailInput = z.infer<typeof UpdateUserEmailInputSchema>;
