// PORT-NOTE: NestJS @Module — no direct Next.js equivalent.
// This registry re-exports all instance command classes and documents their
// original NestJS module dependencies. Use in any orchestration layer that
// runs the instance upgrade sequence.

// ── Instance command re-exports (by batch) ───────────────────────────────────

// 2-7
export { FinalizeRolePermissionFlagCutoverFastInstanceCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-7/2-7-instance-command-fast-1779600000000-finalize-role-permission-flag-cutover";
export { EncryptConnectionParametersSlowInstanceCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-7/2-7-instance-command-slow-1798000010000-encrypt-connection-parameters";

// 2-8
export { AddSubFieldNameToIndexFieldMetadataFastInstanceCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-8/2-8-instance-command-fast-1798200000000-add-sub-field-name-to-index-field-metadata";
export { DropFieldMetadataIsUniqueColumnFastInstanceCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-8/2-8-instance-command-fast-1798300000000-drop-field-metadata-is-unique-column";

// 2-9
export { EmailingDomainTenantStatusAndGlobalUniquenessFastInstanceCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-9/2-9-instance-command-fast-1799000020000-emailing-domain-tenant-status-and-global-uniqueness";
export { EncryptNonSecretApplicationVariableSlowInstanceCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-9/2-9-instance-command-slow-1798400000000-encrypt-non-secret-application-variable";
export { MigrateAiModelPreferencesSlowInstanceCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-9/2-9-instance-command-slow-1799000010000-migrate-ai-model-preferences";

/**
 * Original NestJS InstanceCommandProviderModule imported:
 *   - ConnectedAccountTokenEncryptionModule
 *   - SecretEncryptionModule
 *   - JwtModule  (required by SimpleSecretEncryptionUtil; can be dropped once
 *                 the 2.5 cross-upgrade window closes)
 *
 * Providers: [...INSTANCE_COMMANDS, SimpleSecretEncryptionUtil]
 *
 * PORT-NOTE: Provide concrete implementations of ConnectedAccountTokenEncryptionService
 * and SecretEncryptionService when instantiating the slow instance commands.
 */
