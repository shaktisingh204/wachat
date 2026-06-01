import "server-only";

import {
  SecretEncryptionException,
  SecretEncryptionExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/exceptions/secret-encryption.exception";
import type { ResolvedEncryptionKeys } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/types/resolved-encryption-keys.type";

// Minimal config driver interface — only the `get` accessor is needed
export type EncryptionConfigDriver = {
  get(key: "ENCRYPTION_KEY"): string | undefined;
  get(key: "FALLBACK_ENCRYPTION_KEY"): string | undefined;
  get(key: "APP_SECRET"): string | undefined;
  get(key: string): unknown;
};

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

export const resolveEncryptionKeysOrThrow = ({
  environmentConfigDriver,
}: {
  environmentConfigDriver: EncryptionConfigDriver;
}): ResolvedEncryptionKeys => {
  const encryptionKey = environmentConfigDriver.get("ENCRYPTION_KEY");
  const fallbackEncryptionKey = environmentConfigDriver.get(
    "FALLBACK_ENCRYPTION_KEY",
  );
  const appSecret = environmentConfigDriver.get("APP_SECRET");

  const primary = isNonEmptyString(encryptionKey) ? encryptionKey : appSecret;

  if (!isNonEmptyString(primary)) {
    throw new SecretEncryptionException(
      "No encryption key configured: set ENCRYPTION_KEY (or APP_SECRET for legacy deployments).",
      SecretEncryptionExceptionCode.NO_ENCRYPTION_KEY_CONFIGURED,
    );
  }

  const fallback = isNonEmptyString(fallbackEncryptionKey)
    ? fallbackEncryptionKey
    : null;

  return { primary, fallback };
};
