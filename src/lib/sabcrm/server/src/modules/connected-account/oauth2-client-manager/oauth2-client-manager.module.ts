// module-wiring: NestJS OAuth2ClientManagerModule → SabNode registry
// Re-exports the ported pieces this module wired.

export { getGoogleOAuth2Client } from "./drivers/google/google-oauth2-client.provider";
export { getMicrosoftOAuth2Client } from "./drivers/microsoft/microsoft-oauth2-client.provider";
export { MicrosoftOAuth2ClientAuthProvider } from "./drivers/microsoft/microsoft-oauth2-client-auth-provider";

// Dependencies wired by this module:
//   ConnectedAccountTokenEncryptionModule → src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/services/
//   RefreshTokensManagerModule            → src/lib/sabcrm/server/src/modules/connected-account/refresh-tokens-manager/
//   ConnectedAccountEntity                → sabcrm_connected_account collection
