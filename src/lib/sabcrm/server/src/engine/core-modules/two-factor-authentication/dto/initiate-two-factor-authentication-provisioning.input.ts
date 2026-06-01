// PORT-NOTE: graphql-input->zod — NestJS @ArgsType DTO ported to TypeScript type + Zod schema.

import { z } from 'zod';

export const InitiateTwoFactorAuthenticationProvisioningInputSchema = z.object({
  loginToken: z
    .string()
    .min(1, { message: 'loginToken must not be empty' }),
});

export type InitiateTwoFactorAuthenticationProvisioningInput = z.infer<
  typeof InitiateTwoFactorAuthenticationProvisioningInputSchema
>;
