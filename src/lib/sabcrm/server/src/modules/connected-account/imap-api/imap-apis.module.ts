// module-wiring: NestJS IMAPAPIsModule → SabNode registry
// Re-exports the ported pieces this module wired together.

// PORT-NOTE: ImapSmtpCalDavAPIService is the main export.
// It is ported at:
//   src/lib/sabcrm/server/src/modules/connected-account/services/imap-smtp-caldav-apis.service.ts

// Dependencies wired by this module:
//   AuthModule                        → src/lib/sabcrm/server/src/engine/core-modules/auth/
//   FeatureFlagModule                 → src/lib/sabcrm/server/src/engine/core-modules/feature-flag/
//   MessageQueueModule                → src/lib/sabcrm/server/src/engine/core-modules/message-queue/
//   TwentyConfigModule                → src/lib/sabcrm/server/src/engine/core-modules/twenty-config/
//   TwentyORMModule                   → src/lib/sabcrm/server/src/engine/twenty-orm/
//   WorkspaceEventEmitterModule       → src/lib/sabcrm/server/src/engine/workspace-event-emitter/
//   CalendarCommonModule              → src/lib/sabcrm/server/src/modules/calendar/common/
//   ConnectedAccountModule            → src/lib/sabcrm/server/src/modules/connected-account/
//   ConnectedAccountTokenEncryption   → src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/services/
//   MessagingCommonModule             → src/lib/sabcrm/server/src/modules/messaging/common/
//   MessagingFolderSyncManagerModule  → src/lib/sabcrm/server/src/modules/messaging/message-folder-manager/

// Collections used: sabcrm_object_metadata, sabcrm_calendar_channel,
//   sabcrm_connected_account, sabcrm_message_channel, sabcrm_user_workspace

export const IMAP_APIS_MODULE_EXPORTS = ["ImapSmtpCalDavAPIService"] as const;
