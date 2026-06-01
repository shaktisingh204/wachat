// PORT-NOTE: NestJS module — no direct Next.js/Mongo equivalent.
// Re-exports the ported workspace command functions wired under v2.3.0.

export {
  dropMessageDirectionField,
  DROP_MESSAGE_DIRECTION_FIELD_COMMAND_NAME,
} from "./2-3-workspace-command-1777400000000-drop-message-direction-field.command";

export {
  backfillImageIdentifierFieldMetadataId,
  BACKFILL_IMAGE_IDENTIFIER_COMMAND_NAME,
} from "./2-3-workspace-command-1777920000000-backfill-image-identifier-field-metadata-id.command";

export {
  deleteGaugeWidgets,
  DELETE_GAUGE_WIDGETS_COMMAND_NAME,
} from "./2-3-workspace-command-1798000000000-delete-gauge-widgets.command";

/**
 * V2_3_UpgradeVersionCommandModule registry
 *
 * Original NestJS imports:
 *   ApplicationModule, WorkspaceCacheModule,
 *   WorkspaceIteratorModule, WorkspaceMigrationModule
 *
 * Providers:
 *   DropMessageDirectionFieldCommand          (timestamp 1777400000000)
 *   BackfillImageIdentifierFieldMetadataIdCommand (timestamp 1777920000000)
 *   DeleteGaugeWidgetsCommand                 (timestamp 1798000000000)
 */
export const V2_3_UPGRADE_VERSION_COMMANDS = [
  {
    name: "upgrade:2-3:drop-message-direction-field",
    timestamp: 1777400000000,
    version: "2.3.0",
  },
  {
    name: "upgrade:2-3:backfill-image-identifier-field-metadata-id",
    timestamp: 1777920000000,
    version: "2.3.0",
  },
  {
    name: "upgrade:2-3:delete-gauge-widgets",
    timestamp: 1798000000000,
    version: "2.3.0",
  },
] as const;
