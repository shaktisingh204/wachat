import { type TotpContext } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/strategies/otp/totp/constants/totp.strategy.constants";

export enum OTPStatus {
  PENDING = "PENDING",
  VERIFIED = "VERIFIED",
}

export type OTPContext = TotpContext;
