import { isDefined } from "@/lib/sabcrm/shared/src/utils/validation/isDefined";

import { type TwoFactorAuthenticationMethodDocument } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/entities/two-factor-authentication-method.entity";

export type TwoFactorAuthenticationMethodSummaryDTO = {
  twoFactorAuthenticationMethodId: string;
  status: string;
  strategy: string;
};

export function buildTwoFactorAuthenticationMethodSummary(
  methods: TwoFactorAuthenticationMethodDocument[] | undefined,
): TwoFactorAuthenticationMethodSummaryDTO[] | undefined {
  if (!isDefined(methods)) return undefined;

  return methods.map((method) => ({
    twoFactorAuthenticationMethodId: method.id,
    status: method.status,
    strategy: method.strategy,
  }));
}
