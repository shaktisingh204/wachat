// PORT-NOTE: graphql-input->zod — NestJS @ArgsType DTO ported to TypeScript type + Zod schema.

import { z } from 'zod';

export const VerifyTwoFactorAuthenticationMethodInputSchema = z.object({
  otp: z
    .string()
    .min(1, { message: 'OTP must not be empty' })
    .regex(/^\d+$/, { message: 'OTP must be a numeric string' })
    .length(6, { message: 'OTP must be exactly 6 digits' }),
});

export type VerifyTwoFactorAuthenticationMethodInput = z.infer<
  typeof VerifyTwoFactorAuthenticationMethodInputSchema
>;
