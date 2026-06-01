// module-wiring: NestJS EmailAliasManagerModule → SabNode registry
// Re-exports the ported pieces this module wired together.

export { refreshHandleAliases } from "./services/email-alias-manager.service";
export { getGoogleHandleAliases } from "./drivers/google/services/google-email-alias-manager.service";
export { handleGmailEmailAliasError } from "./drivers/google/services/google-email-alias-error-handler.service";
export { getMicrosoftHandleAliases } from "./drivers/microsoft/services/microsoft-email-alias-manager.service";

// Dependencies wired by this module:
//   OAuth2ClientManagerModule → src/lib/sabcrm/server/src/modules/connected-account/oauth2-client-manager/
//   ConnectedAccountEntity    → sabcrm_connected_account collection
