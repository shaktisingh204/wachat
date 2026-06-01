// PORT-NOTE: NestJS @Module wiring — no direct Next.js equivalent.
// This registry re-exports the ported workspace command implementations for v2.8.
// Import these in any orchestration layer that runs the upgrade sequence.

export { DropChannelStandardObjectsCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-8/2-8-workspace-command-1798000050000-drop-channel-standard-objects.command";
export { BackfillRelationJoinColumnIndexesCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-8/2-8-workspace-command-1798100000000-backfill-relation-join-column-indexes.command";
export { GateDefaultCommandMenuItemsByPermissionFlagCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-8/2-8-workspace-command-1798100010000-gate-default-command-menu-items-by-permission-flag.command";
export { RestoreChannelAssociationScalarFieldMetadataCommand } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/2-8/2-8-workspace-command-1798100020000-restore-channel-association-scalar-field-metadata.command";

/**
 * v2.8 upgrade workspace command registry.
 *
 * Original NestJS module imported:
 *   - ApplicationModule
 *   - TypeOrmModule.forFeature([FieldMetadataEntity])
 *   - WorkspaceCacheModule
 *   - WorkspaceIteratorModule
 *   - WorkspaceMetadataVersionModule
 *   - WorkspaceMigrationModule
 *   - WorkspaceSchemaManagerModule
 *
 * Providers:
 *   - DropChannelStandardObjectsCommand
 *   - BackfillRelationJoinColumnIndexesCommand
 *   - GateDefaultCommandMenuItemsByPermissionFlagCommand
 *   - RestoreChannelAssociationScalarFieldMetadataCommand
 */
export const V2_8_WORKSPACE_COMMANDS = [
  "DropChannelStandardObjectsCommand",
  "BackfillRelationJoinColumnIndexesCommand",
  "GateDefaultCommandMenuItemsByPermissionFlagCommand",
  "RestoreChannelAssociationScalarFieldMetadataCommand",
] as const;
