// PORT-NOTE: graphql-input->zod — NestJS @ArgsType DTO ported to TypeScript type + Zod schema.

import { z } from 'zod';

export const DeleteTwoFactorAuthenticationMethodInputSchema = z.object({
  twoFactorAuthenticationMethodId: z
    .string()
    .uuid({ message: 'twoFactorAuthenticationMethodId must be a valid UUID' })
    .min(1, { message: 'twoFactorAuthenticationMethodId must not be empty' }),
});

export type DeleteTwoFactorAuthenticationMethodInput = z.infer<
  typeof DeleteTwoFactorAuthenticationMethodInputSchema
>;
