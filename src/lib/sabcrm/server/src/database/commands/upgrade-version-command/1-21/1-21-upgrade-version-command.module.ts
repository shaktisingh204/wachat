// PORT-NOTE: NestJS @Module -> re-export registry.
// No DI / TypeOrmModule wiring. Each workspace command is exported as a standalone function.

export { addComposeEmailCommandMenuItem } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500001000-add-compose-email-command-menu-item.command";

export { addGlobalKeyValuePairUniqueIndex } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500002000-add-global-key-value-pair-unique-index.command";

export { backfillDatasourceToWorkspace } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500003000-backfill-datasource-to-workspace.command";

export { backfillMessageThreadSubject } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500004000-backfill-message-thread-subject.command";

export { deduplicateEngineCommands } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500006000-deduplicate-engine-commands.command";

export { fixSelectAllCommandMenuItems } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500007000-fix-select-all-command-menu-items.command";

export { migrateAiAgentTextToJsonResponseFormat } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500008000-migrate-ai-agent-text-to-json-response-format.command";

export { updateEditLayoutCommandMenuItemLabel } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500009000-update-edit-layout-command-menu-item-label.command";

export { dropWorkspaceMessagingFks } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500010000-drop-workspace-messaging-fks.command";

export { migrateMessageFolderParentIdToExternalId } from "@/lib/sabcrm/server/src/database/commands/upgrade-version-command/1-21/1-21-workspace-command-1775500011000-migrate-message-folder-parent-id-to-external-id.command";
