import { isDefined } from "@/lib/sabcrm/shared/src/utils/validation/isDefined";

import {
  TwoFactorAuthenticationException,
  TwoFactorAuthenticationExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/two-factor-authentication.exception";
import { type TwoFactorAuthenticationMethodDocument } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/entities/two-factor-authentication-method.entity";
import { OTPStatus } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/strategies/otp/otp.constants";

const assertIsDefinedOrThrow = (
  twoFactorAuthenticationMethod:
    | TwoFactorAuthenticationMethodDocument
    | undefined
    | null,
  exceptionToThrow: TwoFactorAuthenticationException = new TwoFactorAuthenticationException(
    "2FA method not found",
    TwoFactorAuthenticationExceptionCode.TWO_FACTOR_AUTHENTICATION_METHOD_NOT_FOUND,
  ),
): asserts twoFactorAuthenticationMethod is TwoFactorAuthenticationMethodDocument => {
  if (!isDefined(twoFactorAuthenticationMethod)) {
    throw exceptionToThrow;
  }
};

const areTwoFactorAuthenticationMethodsDefined = (
  twoFactorAuthenticationMethods:
    | TwoFactorAuthenticationMethodDocument[]
    | undefined
    | null,
): twoFactorAuthenticationMethods is TwoFactorAuthenticationMethodDocument[] => {
  return (
    isDefined(twoFactorAuthenticationMethods) &&
    twoFactorAuthenticationMethods.length > 0
  );
};

const isAnyTwoFactorAuthenticationMethodVerified = (
  twoFactorAuthenticationMethods: TwoFactorAuthenticationMethodDocument[],
): boolean => {
  return (
    twoFactorAuthenticationMethods.filter(
      (method) => method.status === OTPStatus.VERIFIED,
    ).length > 0
  );
};

export const twoFactorAuthenticationMethodsValidator: {
  assertIsDefinedOrThrow: typeof assertIsDefinedOrThrow;
  areDefined: typeof areTwoFactorAuthenticationMethodsDefined;
  areVerified: typeof isAnyTwoFactorAuthenticationMethodVerified;
} = {
  assertIsDefinedOrThrow,
  areDefined: areTwoFactorAuthenticationMethodsDefined,
  areVerified: isAnyTwoFactorAuthenticationMethodVerified,
};
