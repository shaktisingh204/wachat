import { SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/constants/secret-encryption.constant";

/**
 * Builds a LIKE pattern that matches ciphertext envelopes already encrypted
 * under the current key. Used to filter out rows that do NOT need rotation.
 *
 * PORT-NOTE: Originally used by TypeORM query builders with SQL LIKE; in Mongo
 * callers translate this to a $not/$regex filter on the relevant field.
 */
export const buildCurrentEncryptionKeyIdEnvelopeLikePattern = (
  currentEncryptionKeyId: string,
): string =>
  `${SECRET_ENCRYPTION_ENVELOPE_V2_PREFIX}${currentEncryptionKeyId}:%`;
