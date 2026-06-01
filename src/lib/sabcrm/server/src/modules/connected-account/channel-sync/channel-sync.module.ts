// module-wiring: NestJS ChannelSyncModule → SabNode registry
// Re-exports ported pieces that this module wired together.

export { startChannelSync } from "./services/channel-sync.service";
export type { StartChannelSyncInput } from "./services/channel-sync.service";
export { channelSyncAction } from "./channel-sync.resolver";
export type { ChannelSyncSuccessDTO } from "./dtos/channel-sync-success.dto";

// Dependencies wired by this module:
//   ConnectedAccountMetadataModule  → src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/
//   PermissionsModule               → src/lib/sabcrm/server/src/engine/metadata-modules/permissions/
//   WorkspaceDataSourceModule       → src/lib/sabcrm/server/src/engine/workspace-datasource/
//   MessagingCommonModule           → src/lib/sabcrm/server/src/modules/messaging/common/
