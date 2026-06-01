// PORT-NOTE: NestJS module — no direct Next.js/Mongo equivalent.
// Re-exports the ported workspace command function wired under v2.2.0.

export {
  setCalendarEventDescriptionDisplayedMaxRows,
  SET_CALENDAR_EVENT_DESCRIPTION_MAX_ROWS_COMMAND_NAME,
} from "./2-2-workspace-command-1786000000000-set-calendar-event-description-displayed-max-rows.command";

/**
 * V2_2_UpgradeVersionCommandModule registry
 *
 * Original NestJS imports:
 *   ApplicationModule, WorkspaceCacheModule,
 *   WorkspaceIteratorModule, WorkspaceMigrationModule
 *
 * Provider:
 *   SetCalendarEventDescriptionDisplayedMaxRowsCommand (timestamp 1786000000000)
 */
export const V2_2_UPGRADE_VERSION_COMMANDS = [
  {
    name: "upgrade:2-2:set-calendar-event-description-displayed-max-rows",
    timestamp: 1786000000000,
    version: "2.2.0",
  },
] as const;
