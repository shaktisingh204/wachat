// PORT-NOTE: server-logic — pure TypeScript interface, no NestJS deps.

import { TwoFactorAuthenticationStrategy } from '../../../entities/two-factor-authentication-method.entity';
import { type OTPContext } from '../otp.constants';

export interface OTPAuthenticationStrategyInterface {
  readonly name: TwoFactorAuthenticationStrategy;
  initiate(
    accountName: string,
    issuer: string,
  ): {
    uri: string;
    context: OTPContext;
  };
  validate(
    token: string,
    context: OTPContext,
  ): {
    isValid: boolean;
    context: OTPContext;
  };
}
