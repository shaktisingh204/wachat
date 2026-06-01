// PORT-NOTE: Auto-edited by generate:instance-command in the original NestJS project.
// In SabNode this is a registry of all ported instance command class names (and their
// ported module paths) that the upgrade orchestration layer should discover.
// The NestJS provider array is replaced by a plain array of class references.
// Import and instantiate these in your upgrade runner, providing the required
// service dependencies (encryption services, etc.).

export {
  // ── 2-7 ──────────────────────────────────────────────────────────────────
  FinalizeRolePermissionFlagCutoverFastInstanceCommand,
  EncryptConnectionParametersSlowInstanceCommand,
} from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/instance-command-provider.module";

export {
  // ── 2-8 ──────────────────────────────────────────────────────────────────
  AddSubFieldNameToIndexFieldMetadataFastInstanceCommand,
  DropFieldMetadataIsUniqueColumnFastInstanceCommand,
} from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/instance-command-provider.module";

export {
  // ── 2-9 ──────────────────────────────────────────────────────────────────
  EmailingDomainTenantStatusAndGlobalUniquenessFastInstanceCommand,
  EncryptNonSecretApplicationVariableSlowInstanceCommand,
  MigrateAiModelPreferencesSlowInstanceCommand,
} from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/instance-command-provider.module";

/**
 * Canonical ordered list of all instance commands.
 * Mirrors the original INSTANCE_COMMANDS array (order determines execution sequence).
 *
 * PORT-NOTE: Earlier batches (1-21 through 2-6) are registered in their own ported
 * modules. When the full upgrade runner is assembled, concatenate all batches in order.
 */
export const INSTANCE_COMMAND_NAMES = [
  // === batch 2-7 ===
  "FinalizeRolePermissionFlagCutoverFastInstanceCommand",
  "EncryptConnectionParametersSlowInstanceCommand",
  // === batch 2-8 ===
  "AddSubFieldNameToIndexFieldMetadataFastInstanceCommand",
  "DropFieldMetadataIsUniqueColumnFastInstanceCommand",
  // === batch 2-9 ===
  "EmailingDomainTenantStatusAndGlobalUniquenessFastInstanceCommand",
  "EncryptNonSecretApplicationVariableSlowInstanceCommand",
  "MigrateAiModelPreferencesSlowInstanceCommand",
] as const;
