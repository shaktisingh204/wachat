// module-wiring: SecretEncryptionModule — no NestJS equivalent in Next.js.
// Re-exports the service and branded-string utilities for consumers.

export { SecretEncryptionService } from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service";
export {
  type EncryptedString,
  isEncryptedString,
  type PlaintextString,
} from "@/lib/sabcrm/server/src/engine/core-modules/secret-encryption/branded-strings/index";
