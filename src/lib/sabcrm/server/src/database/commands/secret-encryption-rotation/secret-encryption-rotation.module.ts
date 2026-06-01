// PORT-NOTE: NestJS @Module -> re-export registry.
// NestJS DI wiring (TypeOrmModule.forFeature, providers, imports) has no Next.js equivalent.
// All ported pieces are exported here so consumers can import from a single location.

export {
  ConnectionParametersRotationHandler,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/handlers/connection-parameters-rotation.handler";

export {
  SensitiveConfigStorageRotationHandler,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/handlers/sensitive-config-storage-rotation.handler";

export {
  ColumnRotationSiteHandler,
  type ColumnRotationSiteConfig,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/handlers/column-rotation-site.handler";

export {
  run as runSecretEncryptionRotation,
  type RotationRunOptions,
  type RotationRunSummary,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/services/secret-encryption-rotation-runner.service";

export {
  rotateSecretEncryption,
  type RotateSecretEncryptionCommandOptions,
  KNOWN_SITE_NAMES,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/rotate-secret-encryption.command";

export {
  SECRET_ENCRYPTION_ROTATION_SITE_NAME,
  type SecretEncryptionRotationSiteName,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/constants/secret-encryption-rotation-site-name.constant";

export {
  SecretEncryptionRotationHandler,
  type SecretEncryptionRotationContext,
  type SecretEncryptionRotationOutcome,
  type SecretEncryptionRotationSiteResult,
} from "@/lib/sabcrm/server/src/database/commands/secret-encryption-rotation/interfaces/secret-encryption-rotation-handler.interface";
