import "server-only";

import { createHash } from "crypto";

import { deriveInstanceHmacKey } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/derive-instance-hmac-key.util";

const SESSION_COOKIE_HMAC_PURPOSE = "session-cookie";

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

const buildLegacySessionSecret = (appSecret: string): string =>
  createHash("sha256")
    .update(`${appSecret}SESSION_STORE_SECRET`)
    .digest("hex");

// Minimal config service interface; can be satisfied by an env-var map
export type SessionCookieConfigService = {
  get(key: "ENCRYPTION_KEY"): string | undefined;
  get(key: "FALLBACK_ENCRYPTION_KEY"): string | undefined;
  get(key: "APP_SECRET"): string | undefined;
  get(key: string): unknown;
};

export const resolveSessionCookieSecretsOrThrow = ({
  twentyConfigService,
}: {
  twentyConfigService: SessionCookieConfigService;
}): string[] => {
  const encryptionKey = twentyConfigService.get("ENCRYPTION_KEY");
  const fallbackEncryptionKey = twentyConfigService.get(
    "FALLBACK_ENCRYPTION_KEY",
  );
  const appSecret = twentyConfigService.get("APP_SECRET");

  const rawPrimary = isNonEmptyString(encryptionKey)
    ? encryptionKey
    : appSecret;

  if (!isNonEmptyString(rawPrimary)) {
    throw new Error(
      "Cannot derive session cookie secret: set ENCRYPTION_KEY (or APP_SECRET for legacy deployments).",
    );
  }

  const secrets: string[] = [
    deriveInstanceHmacKey({
      rawKey: rawPrimary,
      purpose: SESSION_COOKIE_HMAC_PURPOSE,
    }).toString("hex"),
  ];

  if (isNonEmptyString(fallbackEncryptionKey)) {
    secrets.push(
      deriveInstanceHmacKey({
        rawKey: fallbackEncryptionKey,
        purpose: SESSION_COOKIE_HMAC_PURPOSE,
      }).toString("hex"),
    );
  }

  if (isNonEmptyString(appSecret)) {
    secrets.push(buildLegacySessionSecret(appSecret));
  }

  return secrets;
};
