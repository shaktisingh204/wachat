// PORT-NOTE: graphql-input->zod — NestJS @ArgsType DTO ported to TypeScript type + Zod schema.

import { z } from 'zod';

export const TwoFactorAuthenticationVerificationInputSchema = z.object({
  otp: z
    .string()
    .min(1, { message: 'OTP must not be empty' }),
  loginToken: z
    .string()
    .min(1, { message: 'loginToken must not be empty' }),
  captchaToken: z.string().optional(),
});

export type TwoFactorAuthenticationVerificationInput = z.infer<
  typeof TwoFactorAuthenticationVerificationInputSchema
>;
