// PORT-NOTE: NestJS Module — no Next.js equivalent. Re-exports all ported pieces that this module wired together.

// Wired pieces:
//   - SecretEncryptionModule (dependency) → src/lib/sabcrm/server/src/engine/core-modules/secret-encryption/secret-encryption.service.ts
//   - ConnectedAccountTokenEncryptionService (provider + export) → below

export {
  encryptToken,
  encryptTokenNullable,
  decryptToken,
  decryptTokenNullable,
  encryptTokenPair,
  encryptConnectionParameters,
  decryptConnectionParameters,
  decryptProtocolPassword,
} from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/services/connected-account-token-encryption.service';
