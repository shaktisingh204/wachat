// module-wiring: NestJS GoogleAPIRefreshAccessTokenModule → SabNode registry
// Re-exports the ported pieces this module wired.

export { refreshGoogleTokens } from "./services/google-api-refresh-tokens.service";

// Dependencies wired by this module:
//   TwentyConfigModule → src/lib/sabcrm/server/src/engine/core-modules/twenty-config/
//   (config values now sourced from process.env in the ported service)
