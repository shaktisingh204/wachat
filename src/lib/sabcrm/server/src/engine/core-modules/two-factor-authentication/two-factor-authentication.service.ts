import "server-only";

import { authenticator } from "otplib";
import { TwoFactorAuthenticationStrategy } from "@/lib/sabcrm/shared/src/types/TwoFactorAuthenticationStrategy";
import { isDefined } from "@/lib/sabcrm/shared/src/utils/validation/isDefined";

import {
  AuthException,
  AuthExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/auth/auth.exception";
import { type EncryptedString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type";
import { type PlaintextString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type";
import { SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/constants/secret-encryption.constant";
import {
  getSecretEncryptionService,
} from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service";
import {
  TwoFactorAuthenticationException,
  TwoFactorAuthenticationExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/two-factor-authentication.exception";
import { twoFactorAuthenticationMethodsValidator } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/two-factor-authentication.validation";
import { OTPStatus } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/strategies/otp/otp.constants";
import { SimpleSecretEncryptionUtil } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/utils/simple-secret-encryption.util";
import {
  getTwoFactorAuthenticationMethodCollection,
  type TwoFactorAuthenticationMethodDocument,
} from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/entities/two-factor-authentication-method.entity";
// OTPStatus / TwoFactorAuthenticationStrategy are already imported from the
// OTP constants and shared types above — re-exports from the entity are not needed.
import { TOTP_DEFAULT_CONFIGURATION } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/strategies/otp/totp/constants/totp.strategy.constants";
import { TotpStrategy } from "@/lib/sabcrm/server/src/engine/core-modules/two-factor-authentication/strategies/otp/totp/totp.strategy";
import {
  getUserWorkspaceForUserOrThrow,
} from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.service";

const PENDING_METHOD_REUSE_WINDOW_MS = 60 * 60 * 1000;

// TODO: drop this helper, the `simpleSecretEncryptionUtil` dep, and the legacy
// branch in `decryptStoredSecret` below once the 2.5 cross-upgrade window
// closes and every TOTP secret row has been backfilled to enc:v2 by the
// matching slow instance command.
const buildLegacyTotpCbcPurpose = (
  userId: string,
  workspaceId: string,
): string => `${userId}${workspaceId}otp-secret`;

async function decryptStoredSecret({
  storedSecret,
  userId,
  workspaceId,
}: {
  storedSecret: EncryptedString;
  userId: string;
  workspaceId: string;
}): Promise<PlaintextString> {
  if (storedSecret.startsWith(SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX)) {
    return getSecretEncryptionService().decryptVersioned(storedSecret, { workspaceId });
  }

  return SimpleSecretEncryptionUtil.decryptSecret(
    storedSecret,
    buildLegacyTotpCbcPurpose(userId, workspaceId),
  );
}

/**
 * Validates two-factor authentication requirements for a workspace.
 *
 * @throws {AuthException} with TWO_FACTOR_AUTHENTICATION_VERIFICATION_REQUIRED if 2FA is set up and needs verification
 * @throws {AuthException} with TWO_FACTOR_AUTHENTICATION_PROVISION_REQUIRED if 2FA is enforced but not set up
 */
export async function validateTwoFactorAuthenticationRequirement(
  targetWorkspace: { isTwoFactorAuthenticationEnforced: boolean },
  userTwoFactorAuthenticationMethods?: TwoFactorAuthenticationMethodDocument[],
): Promise<void> {
  if (
    twoFactorAuthenticationMethodsValidator.areDefined(
      userTwoFactorAuthenticationMethods,
    ) &&
    twoFactorAuthenticationMethodsValidator.areVerified(
      userTwoFactorAuthenticationMethods,
    )
  ) {
    throw new AuthException(
      "Two factor authentication verification required",
      AuthExceptionCode.TWO_FACTOR_AUTHENTICATION_VERIFICATION_REQUIRED,
    );
  } else if (targetWorkspace?.isTwoFactorAuthenticationEnforced) {
    throw new AuthException(
      "Two factor authentication setup required",
      AuthExceptionCode.TWO_FACTOR_AUTHENTICATION_PROVISION_REQUIRED,
    );
  }
}

export async function initiateStrategyConfiguration(
  userId: string,
  userEmail: string,
  workspaceId: string,
  workspaceDisplayName?: string,
): Promise<string> {
  const userWorkspace = await getUserWorkspaceForUserOrThrow({
    userId,
    workspaceId,
  });

  const col = await getTwoFactorAuthenticationMethodCollection();

  const existing2FAMethod = await col.findOne({
    userWorkspaceId: userWorkspace.id,
    strategy: TwoFactorAuthenticationStrategy.TOTP,
    workspaceId,
  });

  if (existing2FAMethod && existing2FAMethod.status !== "PENDING") {
    throw new TwoFactorAuthenticationException(
      "A two factor authentication method has already been set. Please delete it and try again.",
      TwoFactorAuthenticationExceptionCode.TWO_FACTOR_AUTHENTICATION_METHOD_ALREADY_PROVISIONED,
    );
  }

  if (
    existing2FAMethod &&
    existing2FAMethod.status === "PENDING" &&
    existing2FAMethod.createdAt &&
    Date.now() - existing2FAMethod.createdAt.getTime() <
      PENDING_METHOD_REUSE_WINDOW_MS
  ) {
    const existingSecret = await decryptStoredSecret({
      storedSecret: existing2FAMethod.secret,
      userId,
      workspaceId,
    });

    const issuer = `Twenty${workspaceDisplayName ? ` - ${workspaceDisplayName}` : ""}`;
    const reuseUri = authenticator.keyuri(userEmail, issuer, existingSecret);

    return reuseUri;
  }

  const { uri, context } = new TotpStrategy(
    TOTP_DEFAULT_CONFIGURATION,
  ).initiate(
    userEmail,
    `Twenty${workspaceDisplayName ? ` - ${workspaceDisplayName}` : ""}`,
  );

  const encryptedSecret = getSecretEncryptionService().encryptVersioned(context.secret, { workspaceId });

  const now = new Date();
  const doc: Omit<TwoFactorAuthenticationMethodDocument, "_id"> = {
    id: existing2FAMethod?.id ?? crypto.randomUUID(),
    userWorkspaceId: userWorkspace.id,
    workspaceId,
    secret: encryptedSecret,
    status: context.status,
    strategy: TwoFactorAuthenticationStrategy.TOTP,
    createdAt: now,
    updatedAt: now,
  };

  await col.replaceOne(
    { id: doc.id },
    doc,
    { upsert: true },
  );

  return uri;
}

export async function validateStrategy(
  userId: string,
  token: string,
  workspaceId: string,
  twoFactorAuthenticationStrategy: TwoFactorAuthenticationStrategy,
): Promise<void> {
  const col = await getTwoFactorAuthenticationMethodCollection();

  const userTwoFactorAuthenticationMethod = await col.findOne({
    strategy: twoFactorAuthenticationStrategy,
    workspaceId,
    userId,
  });

  if (!isDefined(userTwoFactorAuthenticationMethod)) {
    throw new TwoFactorAuthenticationException(
      "Two Factor Authentication Method not found.",
      TwoFactorAuthenticationExceptionCode.INVALID_CONFIGURATION,
    );
  }

  if (!isDefined(userTwoFactorAuthenticationMethod.secret)) {
    throw new TwoFactorAuthenticationException(
      "Malformed Two Factor Authentication Method object",
      TwoFactorAuthenticationExceptionCode.MALFORMED_DATABASE_OBJECT,
    );
  }

  const originalSecret = await decryptStoredSecret({
    storedSecret: userTwoFactorAuthenticationMethod.secret,
    userId,
    workspaceId,
  });

  const otpContext = {
    status: userTwoFactorAuthenticationMethod.status,
    secret: originalSecret,
  };

  const validationResult = new TotpStrategy(TOTP_DEFAULT_CONFIGURATION).validate(
    token,
    otpContext,
  );

  if (!validationResult.isValid) {
    throw new TwoFactorAuthenticationException(
      "Invalid OTP",
      TwoFactorAuthenticationExceptionCode.INVALID_OTP,
    );
  }

  await col.updateOne(
    { id: userTwoFactorAuthenticationMethod.id },
    {
      $set: {
        status: OTPStatus.VERIFIED,
        updatedAt: new Date(),
      },
    },
  );
}

export async function verifyTwoFactorAuthenticationMethodForAuthenticatedUser(
  userId: string,
  token: string,
  workspaceId: string,
): Promise<{ success: true }> {
  await validateStrategy(
    userId,
    token,
    workspaceId,
    TwoFactorAuthenticationStrategy.TOTP,
  );

  return { success: true };
}
