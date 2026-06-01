// module-wiring: NestJS RefreshTokensManagerModule → SabNode registry
// Re-exports the ported pieces this module wired.

// ConnectedAccountRefreshTokensService is ported at:
//   src/lib/sabcrm/server/src/modules/connected-account/refresh-tokens-manager/services/connected-account-refresh-tokens.service.ts

export { refreshConnectedAccountTokens } from "./services/connected-account-refresh-tokens.service";
export type { ConnectedAccountPlaintextTokens } from "./services/connected-account-refresh-tokens.service";

// Dependencies wired by this module:
//   JwtModule                         → src/lib/sabcrm/server/src/engine/core-modules/jwt/
//   GoogleAPIRefreshAccessTokenModule → ./drivers/google/google-api-refresh-access-token.module
//   MicrosoftAPIRefreshAccessTokenModule → ./drivers/microsoft/microsoft-api-refresh-access-token.module
//   ConnectedAccountTokenEncryptionModule → src/lib/sabcrm/server/src/engine/metadata-modules/connected-account/services/
//   AppOAuthRefreshModule             → src/lib/sabcrm/server/src/engine/core-modules/application/connection-provider/refresh/
//   ConnectedAccountEntity            → sabcrm_connected_account collection
