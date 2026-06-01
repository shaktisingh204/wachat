// PORT-NOTE: NestJS @Module wiring — no direct Next.js equivalent.
// This registry re-exports the ported workspace command implementations for v2.9.
// Import these in any orchestration layer that runs the upgrade sequence.

export { MigrateAiModelPreferencesCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-9/2-9-workspace-command-1799000000000-migrate-ai-model-preferences.command";

/**
 * v2.9 upgrade workspace command registry.
 *
 * Original NestJS module imported:
 *   - TypeOrmModule.forFeature([KeyValuePairEntity])
 *   - WorkspaceIteratorModule
 *
 * Providers:
 *   - MigrateAiModelPreferencesCommand
 */
export const V2_9_WORKSPACE_COMMANDS = [
  "MigrateAiModelPreferencesCommand",
] as const;
