// PORT-NOTE: dto — GraphQL @ObjectType DTO ported to plain TypeScript type.

export type TwoFactorAuthenticationMethodSummaryDTO = {
  twoFactorAuthenticationMethodId: string;
  status: string;
  strategy: string;
};
