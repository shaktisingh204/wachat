// PORT-NOTE: NestJS module — no direct Next.js/Mongo equivalent.
// Re-exports the ported workspace command functions wired under v2.1.0.

export {
  gateExportImportCommandMenuItemsByPermissionFlag,
  GATE_EXPORT_IMPORT_COMMAND_NAME,
} from "./2-1-workspace-command-1790000000000-gate-export-import-command-menu-items-by-permission-flag.command";

export {
  addLayoutCustomizationGuardToEditCommands,
  ADD_LAYOUT_CUSTOMIZATION_GUARD_COMMAND_NAME,
} from "./2-1-workspace-command-1795000001000-add-layout-customization-guard-to-edit-commands.command";

/**
 * V2_1_UpgradeVersionCommandModule registry
 *
 * Original NestJS imports:
 *   ApplicationModule, FeatureFlagModule, WorkspaceCacheModule,
 *   WorkspaceIteratorModule, WorkspaceMigrationModule
 *
 * Providers:
 *   GateExportImportCommandMenuItemsByPermissionFlagCommand (timestamp 1790000000000)
 *   AddLayoutCustomizationGuardToEditCommandsCommand        (timestamp 1795000001000)
 */
export const V2_1_UPGRADE_VERSION_COMMANDS = [
  {
    name: "upgrade:2-1:gate-export-import-by-permission-flag",
    timestamp: 1790000000000,
    version: "2.1.0",
  },
  {
    name: "upgrade:2-1:add-layout-customization-guard-to-edit-commands",
    timestamp: 1795000001000,
    version: "2.1.0",
  },
] as const;
