// PORT-NOTE: NestJS @Module wiring — no direct Next.js equivalent.
// This registry re-exports the ported workspace command implementations for v2.7.
// Import these in any orchestration layer that runs the upgrade sequence.

export { SyncCommandMenuItemAvailabilityExpressionsCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-7/2-7-workspace-command-1798000020000-sync-command-menu-item-availability-expressions.command";
export { DropFavoriteObjectsCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-7/2-7-workspace-command-1798000030000-drop-favorite-objects.command";
export { DropConnectedAccountStandardObjectCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-7/2-7-workspace-command-1798000040000-drop-connected-account-standard-object.command";

/**
 * v2.7 upgrade workspace command registry.
 *
 * Original NestJS module imported:
 *   - ApplicationModule
 *   - ObjectMetadataModule
 *   - WorkspaceCacheModule
 *   - WorkspaceIteratorModule
 *   - WorkspaceMigrationModule
 *
 * Providers:
 *   - DropFavoriteObjectsCommand
 *   - SyncCommandMenuItemAvailabilityExpressionsCommand
 *   - DropConnectedAccountStandardObjectCommand
 */
export const V2_7_WORKSPACE_COMMANDS = [
  "DropFavoriteObjectsCommand",
  "SyncCommandMenuItemAvailabilityExpressionsCommand",
  "DropConnectedAccountStandardObjectCommand",
] as const;
