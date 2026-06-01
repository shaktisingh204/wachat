import { authenticator } from "otplib";
import { TwoFactorAuthenticationStrategy } from "@/lib/sabcrm/shared/src/types/TwoFactorAuthenticationStrategy";
import { isDefined } from "@/lib/sabcrm/shared/src/utils/validation/isDefined";

import { type PlaintextString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type";
import { OTPStatus } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/strategies/otp/otp.constants";
import {
  TwoFactorAuthenticationException,
  TwoFactorAuthenticationExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/two-factor-authentication.exception";
import {
  TOTP_STRATEGY_CONFIG_SCHEMA,
  type TotpContext,
  type TOTPStrategyConfig,
} from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/strategies/otp/totp/constants/totp.strategy.constants";

export class TotpStrategy {
  public readonly name = TwoFactorAuthenticationStrategy.TOTP;

  constructor(options?: TOTPStrategyConfig) {
    if (isDefined(options)) {
      const result = TOTP_STRATEGY_CONFIG_SCHEMA.safeParse(options);

      if (!result.success) {
        const errorMessages = Object.entries(result.error.flatten().fieldErrors)
          .map(
            ([key, messages]: [key: string, messages: string[]]) =>
              `${key}: ${messages.join(", ")}`,
          )
          .join("; ");

        throw new TwoFactorAuthenticationException(
          `Invalid TOTP configuration: ${errorMessages}`,
          TwoFactorAuthenticationExceptionCode.INVALID_CONFIGURATION,
        );
      }
    }
  }

  public initiate(
    accountName: string,
    issuer: string,
  ): {
    uri: string;
    context: TotpContext;
  } {
    const secret = authenticator.generateSecret() as PlaintextString;
    const uri = authenticator.keyuri(accountName, issuer, secret);

    return {
      uri,
      context: {
        status: OTPStatus.PENDING,
        secret,
      },
    };
  }

  public validate(
    token: string,
    context: TotpContext,
  ): {
    isValid: boolean;
    context: TotpContext;
  } {
    const isValid = authenticator.check(token, context.secret);

    return {
      isValid,
      context,
    };
  }
}
