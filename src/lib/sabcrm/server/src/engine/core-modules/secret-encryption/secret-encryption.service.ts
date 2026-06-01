// service: SecretEncryptionService — ported to plain TypeScript, dropping NestJS DI.
// Callers must construct the service with a config driver that reads env vars.

import "server-only";

import { type EncryptedString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type";
import { type PlaintextString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/plaintext-string.type";
import { computeEncryptionKeyId } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/compute-encryption-key-id.util";
import { decryptAesCtrOrThrow } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/decrypt-aes-ctr-or-throw.util";
import { decryptAesGcmV2OrThrow } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/decrypt-aes-gcm-v2-or-throw.util";
import { encryptAesCtr } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/encrypt-aes-ctr.util";
import { encryptAesGcmV2 } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/encrypt-aes-gcm-v2.util";
import { formatSecretEncryptionEnvelopeV2 } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/format-secret-encryption-envelope-v2.util";
import { parseSecretEncryptionEnvelopeOrThrow } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/parse-secret-encryption-envelope-or-throw.util";
import { pickEncryptionKeyByKeyIdOrThrow } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/pick-encryption-key-by-key-id-or-throw.util";
import {
  type EncryptionConfigDriver,
  resolveEncryptionKeysOrThrow,
} from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/utils/resolve-encryption-keys-or-throw.util";

type VersionedOptions = {
  workspaceId?: string;
};

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

export class SecretEncryptionService {
  private hasLoggedLegacyCtrDecryption = false;

  constructor(
    private readonly environmentConfigDriver: EncryptionConfigDriver,
  ) {}

  // Legacy CTR pair (`encrypt` / `decrypt`) is intentionally left unbranded.
  public encrypt(value: string): string {
    if (!isDefined(value)) {
      return value;
    }

    const { primary } = resolveEncryptionKeysOrThrow({
      environmentConfigDriver: this.environmentConfigDriver,
    });

    return encryptAesCtr({ plaintext: value, rawKey: primary });
  }

  // Legacy CTR has no integrity tag, so a wrong key produces an arbitrary
  // byte sequence rather than throwing.
  public decrypt(value: string): string {
    if (!isDefined(value)) {
      return value;
    }

    const { primary } = resolveEncryptionKeysOrThrow({
      environmentConfigDriver: this.environmentConfigDriver,
    });

    return decryptAesCtrOrThrow({ ciphertext: value, rawKey: primary });
  }

  public decryptAndMask({
    value,
    mask,
  }: {
    value: string;
    mask: string;
  }): string {
    if (!isDefined(value)) {
      return value;
    }

    return this.maskDecryptedValue(this.decrypt(value), mask);
  }

  public decryptAndMaskVersioned({
    value,
    mask,
    workspaceId,
  }: {
    value: EncryptedString;
    mask: string;
    workspaceId?: string;
  }): string {
    if (!isDefined(value)) {
      return value;
    }

    return this.maskDecryptedValue(
      this.decryptVersioned(value, { workspaceId }),
      mask,
    );
  }

  private maskDecryptedValue(decryptedValue: string, mask: string): string {
    // Visible-char count caps at 5 and at one-tenth of the secret length, so
    // short secrets reveal nothing and longer secrets reveal a stable prefix.
    const visibleCharsCount = Math.min(
      5,
      Math.floor(decryptedValue.length / 10),
    );

    return `${decryptedValue.slice(0, visibleCharsCount)}${mask}`;
  }

  public encryptVersioned(
    value: PlaintextString,
    opts: VersionedOptions = {},
  ): EncryptedString {
    if (!isDefined(value)) {
      return value;
    }

    const { primary } = resolveEncryptionKeysOrThrow({
      environmentConfigDriver: this.environmentConfigDriver,
    });
    const payloadBase64 = encryptAesGcmV2({
      plaintext: value,
      rawKey: primary,
      workspaceId: opts.workspaceId,
    });
    const keyId = computeEncryptionKeyId({ rawKey: primary });

    return formatSecretEncryptionEnvelopeV2({
      keyId,
      payloadBase64,
    }) as EncryptedString;
  }

  public decryptVersioned(
    value: EncryptedString,
    opts: VersionedOptions = {},
  ): PlaintextString {
    if (!isDefined(value)) {
      return value;
    }

    const parsed = parseSecretEncryptionEnvelopeOrThrow({ value });

    if (parsed.version === 2) {
      const keys = resolveEncryptionKeysOrThrow({
        environmentConfigDriver: this.environmentConfigDriver,
      });
      const rawKey = pickEncryptionKeyByKeyIdOrThrow({
        keyId: parsed.keyId,
        keys,
      });

      return decryptAesGcmV2OrThrow({
        payloadBase64: parsed.payload,
        rawKey,
        workspaceId: opts.workspaceId,
      }) as PlaintextString;
    }

    this.warnLegacyCtrDecryptionOnce();

    return this.decrypt(value) as PlaintextString;
  }

  private warnLegacyCtrDecryptionOnce(): void {
    if (this.hasLoggedLegacyCtrDecryption) {
      return;
    }

    this.hasLoggedLegacyCtrDecryption = true;
    console.warn(
      "[SecretEncryptionService] Decrypted a legacy unprefixed AES-CTR ciphertext. " +
        "These rows should be re-encrypted into the enc:v2 envelope in a follow-up migration.",
    );
  }
}

// Convenience factory for Next.js server code — reads directly from process.env.
export const createEnvConfigDriver = (): EncryptionConfigDriver => ({
  get(key: string) {
    return process.env[key] as string | undefined;
  },
});

// Singleton for server-side use.
let _instance: SecretEncryptionService | null = null;

export const getSecretEncryptionService = (): SecretEncryptionService => {
  if (_instance === null) {
    _instance = new SecretEncryptionService(createEnvConfigDriver());
  }

  return _instance;
};
