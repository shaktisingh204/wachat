import { SECRET_ENCRYPTION_ENVELOPE_PREFIX } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/constants/secret-encryption.constant";
import { type EncryptedString } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/encrypted-string.type";

export const isEncryptedString = (value: string): value is EncryptedString =>
  value.startsWith(SECRET_ENCRYPTION_ENVELOPE_PREFIX);
