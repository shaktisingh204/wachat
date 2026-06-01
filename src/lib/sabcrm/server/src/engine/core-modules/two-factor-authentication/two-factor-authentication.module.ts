// PORT-NOTE: module-wiring — NestJS module has no Next.js equivalent.
// Re-exports the ported service and related pieces so importers can use a
// single barrel import, mirroring what the module's exports array provided.

export { TwoFactorAuthenticationService } from './two-factor-authentication.service';
export { TotpStrategy } from './strategies/otp/totp/totp.strategy';
export { OTPStatus, type OTPContext } from './strategies/otp/otp.constants';
export { TwoFactorAuthenticationException, TwoFactorAuthenticationExceptionCode } from './two-factor-authentication.exception';
export { throwMappedTwoFactorAuthError } from './two-factor-authentication-exception.filter';
export { getTwoFactorAuthenticationMethodCollection, type TwoFactorAuthenticationMethodDocument } from './entities/two-factor-authentication-method.entity';

// Dependencies that the original NestJS module imported (referenced here for
// discoverability; actual implementations live in their own ported modules):
// - TokenModule  → src/lib/sabcrm/server/src/engine/core-modules/auth/token/
// - WorkspaceDomainsModule → src/lib/sabcrm/server/src/engine/core-modules/domain/workspace-domains/
// - SecretEncryptionModule → src/lib/sabcrm/server/src/engine/core-modules/secret-encryption/
// - UserWorkspaceModule   → src/lib/sabcrm/server/src/engine/core-modules/user-workspace/
// - UserModule            → src/lib/sabcrm/server/src/engine/core-modules/user/
