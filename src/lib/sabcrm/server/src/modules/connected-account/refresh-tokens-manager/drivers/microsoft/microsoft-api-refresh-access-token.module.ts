// module-wiring: NestJS MicrosoftAPIRefreshAccessTokenModule → SabNode registry
// Re-exports the ported pieces this module wired.

export { refreshMicrosoftTokens } from "./services/microsoft-api-refresh-tokens.service";

// Dependencies wired by this module:
//   TwentyConfigModule → process.env (AUTH_MICROSOFT_CLIENT_ID / SECRET)
//   JwtModule          → src/lib/sabcrm/server/src/engine/core-modules/jwt/
