// PORT-NOTE: NestJS Module — no Next.js equivalent. Re-exports all ported pieces that this module wired together.

export { ConnectedAccountMetadataService } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/connected-account-metadata.service';
export { wrapWithConnectedAccountExceptionHandling } from 'src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/interceptors/connected-account-graphql-api-exception.interceptor';

// Wired dependencies (for reference):
//   - ConnectedAccountEntity (mongo collection: sabcrm_connected_account)
//   - CalendarChannelEntity  (mongo collection: sabcrm_calendar_channel)
//   - MessageChannelEntity   (mongo collection: sabcrm_message_channel)
//   - AppOAuthRefreshModule  → handled by OAuth provider utilities
//   - FeatureFlagModule      → feature-flag service
//   - PermissionsModule      → RBAC checks
//   - WorkspaceEventEmitterModule → event emitter
//   - WorkspaceManyOrAllFlatEntityMapsCacheModule → flat entity cache
