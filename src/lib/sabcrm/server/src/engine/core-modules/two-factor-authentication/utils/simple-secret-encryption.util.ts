import "server-only";

import { createDecipheriv, createHash, createHmac } from "crypto";

import { type PlaintextString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type";

// TODO: delete this util once the 2.5 cross-upgrade window closes and every
// `core.twoFactorAuthenticationMethod.secret` row is known to be in the
// `enc:v2:` envelope. Also drop the call sites in TwoFactorAuthenticationService.
/**
 * @deprecated Legacy TOTP secret decryption (AES-256-CBC keyed off
 * `APP_SECRET + userId + workspaceId + 'otp-secret' + 'KEY_ENCRYPTION_KEY'`).
 * Kept only to read pre-2.5 rows during the cross-upgrade window. New rows are
 * written by `SecretEncryptionService.encryptVersioned` (enc:v2 envelope).
 *
 * PORT-NOTE: In the original NestJS implementation this class had
 * JwtWrapperService injected to produce `appSecret` from the JWT app secret.
 * Here we derive the same key material directly from `process.env.APP_SECRET`
 * using the same HMAC-SHA256 derivation that JwtWrapperService uses internally.
 * The purpose string mirrors `${userId}${workspaceId}otp-secret`.
 */
export const SimpleSecretEncryptionUtil = {
  algorithm: "aes-256-cbc" as const,
  keyLength: 32 as const,

  /**
   * @param encryptedSecret - The hex-encoded `ivHex:encryptedDataHex` string
   * @param purpose - The purpose string fed to HMAC (mirrors NestJS JWT wrapper)
   */
  async decryptSecret(
    encryptedSecret: string,
    purpose: string,
  ): Promise<PlaintextString> {
    const appSecret = process.env.APP_SECRET ?? "";

    // Mirror the JwtWrapperService.generateAppSecret derivation:
    // appSecret = HMAC-SHA256(APP_SECRET, purpose) as hex
    const derivedKey = createHmac("sha256", appSecret)
      .update(purpose)
      .digest("hex");

    const encryptionKey = createHash("sha256")
      .update(derivedKey)
      .digest()
      .slice(0, SimpleSecretEncryptionUtil.keyLength);

    const [ivHex, encryptedData] = encryptedSecret.split(":");
    const iv = Buffer.from(ivHex, "hex");

    const decipher = createDecipheriv(
      SimpleSecretEncryptionUtil.algorithm,
      encryptionKey,
      iv,
    );
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted as PlaintextString;
  },
};
