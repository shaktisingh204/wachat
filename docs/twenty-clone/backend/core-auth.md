# Core Authentication & Security Modules

Core authentication, JWT management, API key handling, secret encryption, and two-factor authentication modules for the Twenty CRM backend.

## auth/auth.resolver.ts

### checkUserExists
file: auth/auth.resolver.ts:132
Signature: (checkUserExistsInput: EmailAndCaptchaInput) -> Promise<CheckUserExistDTO>
Validates if a user with given email exists, returns user existence, available workspace count, and email verification status. Used during sign-in/signup flow validation on public endpoint.

### getAuthorizationUrlForSSO
file: auth/auth.resolver.ts:142
Signature: (params: GetAuthorizationUrlForSSOInput) -> Promise<GetAuthorizationUrlForSSODTO>
Fetches SSO authorization URL for specified identity provider. Delegates to SSOService after parsing input parameters. Returns OAuth authorization URL for redirect.

### checkWorkspaceInviteHashIsValid
file: auth/auth.resolver.ts:153
Signature: (workspaceInviteHashValidInput: WorkspaceInviteHashValidInput) -> Promise<WorkspaceInviteHashValidDTO>
Validates workspace invite hash and returns its validity status. Used before workspace signup to verify hash is still valid.

### findWorkspaceFromInviteHash
file: auth/auth.resolver.ts:163
Signature: (workspaceInviteHashValidInput: WorkspaceInviteHashValidInput) -> Promise<WorkspaceEntity>
Resolves workspace entity from invite hash. Throws if hash doesn't exist. Used to fetch workspace details during invitation flows.

### getLoginTokenFromCredentials
file: auth/auth.resolver.ts:173
Signature: (getLoginTokenFromCredentialsInput: UserCredentialsInput, origin: string) -> Promise<LoginTokenDTO>
Validates email/password credentials against workspace domain origin, generates login token. Validates workspace exists and password auth enabled.

### signIn
file: auth/auth.resolver.ts:208
Signature: (userCredentials: UserCredentialsInput) -> Promise<AvailableWorkspacesAndAccessTokensDTO>
Authenticates user with email/password across all available workspaces. Returns workspace list and workspace-agnostic token pair for multi-workspace selection.

### verifyEmailAndGetLoginToken
file: auth/auth.resolver.ts:246
Signature: (getAuthTokenFromEmailVerificationTokenInput: GetAuthTokenFromEmailVerificationTokenInput, origin: string, authProvider: AuthProviderEnum) -> Promise<VerifyEmailAndGetLoginTokenDTO>
Verifies email token, marks email verified, optionally updates email, generates login token. Updates user password hash to empty for security after verification.

### verifyEmailAndGetWorkspaceAgnosticToken
file: auth/auth.resolver.ts:291
Signature: (getAuthTokenFromEmailVerificationTokenInput: GetAuthTokenFromEmailVerificationTokenInput, authProvider: AuthProviderEnum) -> Promise<AvailableWorkspacesAndAccessTokensDTO>
Like verifyEmailAndGetLoginToken but returns workspace-agnostic token instead. Used when user doesn't have origin/workspace pre-selected.

### getAuthTokensFromOTP
file: auth/auth.resolver.ts:346
Signature: (twoFactorAuthenticationVerificationInput: TwoFactorAuthenticationVerificationInput, origin: string) -> Promise<AuthTokens>
Validates one-time password against login token's email/workspace. Verifies 2FA TOTP then returns access/refresh token pair.

### signUp
file: auth/auth.resolver.ts:384
Signature: (signUpInput: UserCredentialsInput) -> Promise<AvailableWorkspacesAndAccessTokensDTO>
Creates new user without workspace, sends verification email, returns available workspaces and workspace-agnostic token pair for workspace selection.

### signUpInWorkspace
file: auth/auth.resolver.ts:437
Signature: (signUpInput: SignUpInput, authProvider: AuthProviderEnum) -> Promise<SignUpDTO>
Full signup flow: validates workspace invite, checks permissions, creates user, sends verification email, generates login token. Returns login token and workspace info.

### signUpInNewWorkspace
file: auth/auth.resolver.ts:511
Signature: (currentUser: AuthContextUser, authProvider: AuthProviderEnum) -> Promise<SignUpDTO>
Authenticated endpoint for creating new workspace. Existing user creates fresh workspace, gets login token. Used for multi-workspace creation.

### generateTransientToken
file: auth/auth.resolver.ts:538
Signature: (user: AuthContextUser, workspace: WorkspaceEntity) -> Promise<TransientTokenDTO|void>
Generates short-lived transient token for authenticated workspace member. Returns token or void if user not workspace member.

### getAuthTokensFromLoginToken
file: auth/auth.resolver.ts:562
Signature: (getAuthTokensFromLoginTokenInput: GetAuthTokensFromLoginTokenInput, origin: string) -> Promise<AuthTokens>
Exchanges login token for access/refresh token pair. Validates token matches origin workspace, user has workspace access. Handles impersonation scenario separately.

### authorizeApp
file: auth/auth.resolver.ts:784
Signature: (authorizeAppInput: AuthorizeAppInput, user: AuthContextUser, workspace: WorkspaceEntity) -> Promise<AuthorizeAppDTO>
Generates OAuth authorization code for app integration. Delegates to AuthService. Used in OAuth 2.0 authorization code flow.

### renewToken
file: auth/auth.resolver.ts:798
Signature: (args: AppTokenInput) -> Promise<AuthTokens>
Exchanges refresh token for new access/refresh token pair. Revokes old token, issues new ones.

### generateApiKeyToken
file: auth/auth.resolver.ts:811
Signature: (args: ApiKeyTokenInput, workspaceId: string) -> Promise<ApiKeyToken|undefined>
Generates JWT token from API key ID for API authentication. Validates API key not revoked/expired.

### emailPasswordResetLink
file: auth/auth.resolver.ts:824
Signature: (emailPasswordResetInput: EmailPasswordResetLinkInput, context: I18nContext) -> Promise<EmailPasswordResetLinkDTO>
Generates password reset token, sends email with reset link. Public endpoint, rate-limited by captcha.

### updatePasswordViaResetToken
file: auth/auth.resolver.ts:843
Signature: (passwordResetToken: string, newPassword: string) -> Promise<InvalidatePasswordDTO>
Validates reset token, updates user password, invalidates token. Used after user clicks reset link.

### validatePasswordResetToken
file: auth/auth.resolver.ts:859
Signature: (args: ValidatePasswordResetTokenInput) -> Promise<ValidatePasswordResetTokenDTO>
Validates password reset token validity, returns user ID/email/hasPassword flag. Used to check token before showing reset form.

## auth/auth.service.ts

### validateLoginWithPassword
file: auth/auth.service.ts:151
Signature: (input: UserCredentialsInput, targetWorkspace?: WorkspaceEntity) -> Promise<UserEntity>
Core password validation: checks user exists, password enabled for workspace, workspace membership, password hash correctness, email verified. Returns user on success.

### checkIsEmailVerified
file: auth/auth.service.ts:215
Signature: (isEmailVerified: boolean) -> Promise<void>
Throws if email verification required but user not verified. Respects IS_EMAIL_VERIFICATION_REQUIRED config.

### signInUp
file: auth/auth.service.ts:335
Signature: (params: SignInUpBaseParams & ExistingUserOrNewUser & AuthProviderWithPasswordType) -> Promise<{user, workspace}>
Routes sign-in/sign-up logic based on user/workspace existence and invitation status. Validates auth provider enabled for workspace.

### verify
file: auth/auth.service.ts:371
Signature: (email: string, workspaceId: string, authProvider: AuthProviderEnum) -> Promise<AuthTokens>
Generates access/refresh token pair after successful authentication. Hides password hash for security. Returns tokens and expiry times.

### generateImpersonationAccessTokenAndRefreshToken
file: auth/auth.service.ts:416
Signature: (workspaceId, impersonatorUserWorkspaceId, impersonatedUserWorkspaceId, _impersonatorUserId, impersonatedUserId) -> Promise<AuthTokens>
Generates tokens for server-level impersonation. Creates correlation ID, logs event, validates server/workspace permissions. Issues tokens with impersonation flags.

### countAvailableWorkspacesByEmail
file: auth/auth.service.ts:475
Signature: (email: string) -> Promise<number>
Counts workspaces user is member of. Used to display workspace count during signup.

### checkUserExists
file: auth/auth.service.ts:481
Signature: (email: string) -> Promise<CheckUserExistDTO>
Returns user existence, workspace count, email verification status. Used in signup form validation.

### checkWorkspaceInviteHashIsValid
file: auth/auth.service.ts:494
Signature: (inviteHash: string) -> Promise<WorkspaceInviteHashValidDTO>
Validates workspace invite hash exists and workspace is joinable. Returns hash validity status.

### canUserBypassAuthProvider
file: auth/auth.service.ts:294
Signature: (user: UserEntity, workspace: WorkspaceEntity, provider: AuthProviderEnum) -> Promise<boolean>
Checks if user with SSO_BYPASS permission can use disabled auth provider. Used for workspace bypass scenarios.

### isAuthProviderEnabledOrThrow
file: auth/auth.service.ts:257
Signature: (userData, authParams, workspace) -> Promise<void>
Validates auth provider enabled for workspace. Throws if disabled and no bypass permission. Validates password strength if password provider.

## auth/services/sign-in-up.service.ts

### computePartialUserFromUserPayload
file: auth/services/sign-in-up.service.ts:77
Signature: (newUserPayload: SignInUpNewUserPayload, authParams: AuthProviderWithPasswordType['authParams']) -> Promise<PartialUserWithPicture>
Converts user signup payload to database-ready partial user. Hashes password if provided. Validates email required.

### signInUp
file: auth/services/sign-in-up.service.ts:109
Signature: (params: SignInUpBaseParams & ExistingUserOrPartialUserWithPicture & AuthProviderWithPasswordType) -> Promise<{user, workspace}>
Main sign-in/sign-up dispatcher: routes to personal invitation flow, existing workspace flow, or new workspace creation.

### generateHash
file: auth/services/sign-in-up.service.ts:136
Signature: (password: string) -> Promise<string>
Validates password strength against regex, hashes with bcrypt. Throws if password too weak (not 8-50 chars).

### validatePassword
file: auth/services/sign-in-up.service.ts:152
Signature: (password: string, passwordHash: string) -> Promise<void>
Compares plaintext password against bcrypt hash. Throws on mismatch.

### signInUpOnExistingWorkspace
file: auth/services/sign-in-up.service.ts:261
Signature: (workspace: WorkspaceEntity, userData: ExistingUserOrPartialUserWithPicture, roleId?: string) -> Promise<UserEntity>
Adds user to existing workspace. Creates new user if needed, triggers onboarding. Validates workspace active/suspended.

### signUpOnNewWorkspace
file: auth/services/sign-in-up.service.ts:479
Signature: (userData: ExistingUserOrPartialUserWithPicture['userData']) -> Promise<{user, workspace}>
Creates new workspace and user in transaction. Generates subdomain, custom application, workspace logo from email domain. Sets first user as server admin. Handles workspace cache invalidation.

### signUpWithoutWorkspace
file: auth/services/sign-in-up.service.ts:615
Signature: (newUserParams: SignInUpNewUserPayload, authParams: AuthProviderWithPasswordType['authParams']) -> Promise<UserEntity>
Creates user without workspace. Validates signup enabled, email unique. First user granted server admin. Returns created user.

### signInUpWithPersonalInvitation
file: auth/services/sign-in-up.service.ts:172
Signature: (invitation: AppTokenEntity, userData: ExistingUserOrPartialUserWithPicture) -> Promise<UserEntity>
Adds user to workspace via personal invitation. Validates invitation, invalidates after use, marks email verified.

## auth/services/reset-password.service.ts

### generatePasswordResetToken
file: auth/services/reset-password.service.ts:54
Signature: (email: string, workspaceId?: string) -> Promise<PasswordResetToken>
Generates secure random reset token, hashes with SHA256, stores in AppTokenEntity. Prevents token reuse within cooldown period.

### sendEmailPasswordResetLink
file: auth/services/reset-password.service.ts:127
Signature: (resetToken: PasswordResetToken, email: string, locale: keyof typeof APP_LOCALES) -> Promise<EmailPasswordResetLinkDTO>
Renders email template with reset link URL, sends via email service. Returns success status.

### validatePasswordResetToken
file: auth/services/reset-password.service.ts:196
Signature: (resetToken: string) -> Promise<ValidatePasswordResetTokenDTO>
Hashes token, finds in database, validates not expired. Returns user ID, email, hasPassword flag.

### invalidatePasswordResetToken
file: auth/services/reset-password.service.ts:232
Signature: (userId: string) -> Promise<InvalidatePasswordDTO>
Marks all user's password reset tokens as revoked. Prevents token reuse after password update.

### findFirstPasswordAuthEnabledWorkspaceIdOrThrow
file: auth/services/reset-password.service.ts:253
Signature: (userId: string) -> Promise<string>
Finds earliest workspace where user has password auth enabled. Throws if none found.

## auth/services/auth-sso.service.ts

### findWorkspaceFromWorkspaceIdOrAuthProvider
file: auth/services/auth-sso.service.ts:34
Signature: (authProvider: AuthProviderEnum, email: string, workspaceId?: string) -> Promise<WorkspaceEntity|undefined>
In multiworkspace mode without workspace ID, finds first workspace with auth provider enabled for user. Otherwise returns workspace by ID.

### getAuthProviderColumnNameByProvider
file: auth/services/auth-sso.service.ts:18
Signature: (authProvider: AuthProviderEnum) -> string
Maps auth provider enum to workspace entity column name for conditional queries. Maps Google/Microsoft/Password to respective flags.

## auth/token/services/access-token.service.ts

### generateAccessToken
file: auth/token/services/access-token.service.ts:50
Signature: (userId, workspaceId, authProvider, isImpersonating?, impersonatorUserWorkspaceId?, impersonatedUserWorkspaceId?) -> Promise<AuthToken>
Creates signed JWT access token with workspace/user context. Loads workspace member ID if workspace active. Handles impersonation flags. Returns token and expiry.

### validateToken
file: auth/token/services/access-token.service.ts:151
Signature: (token: string) -> Promise<AuthContext>
Verifies token signature, decodes payload, runs JWT strategy validation. Returns auth context with user/workspace info.

### validateTokenByRequest
file: auth/token/services/access-token.service.ts:161
Signature: (request: Request) -> Promise<AuthContext>
Extracts token from Authorization header, validates. Throws if missing/invalid.

## auth/token/services/refresh-token.service.ts

### generateRefreshToken
file: auth/token/services/refresh-token.service.ts:111
Signature: (payload: Omit<RefreshTokenJwtPayload, 'type'|'sub'|'jti'>, isImpersonationToken?: boolean) -> Promise<AuthToken>
Creates refresh token: stores in AppTokenEntity, signs JWT with jti/jwtid. Uses 1d expiry for impersonation, config for normal. Returns token and expiry.

### verifyRefreshToken
file: auth/token/services/refresh-token.service.ts:36
Signature: (refreshToken: string) -> Promise<{user, token, authProvider, targetedTokenType, isImpersonating, ...impersonationIds}>
Verifies JWT signature and type, checks database token not revoked. Implements grace period for concurrent refresh within window.

## auth/token/services/login-token.service.ts

### generateLoginToken
file: auth/token/services/login-token.service.ts:26
Signature: (email: string, workspaceId: string, authProvider: AuthProviderEnum, options?: {impersonatorUserWorkspaceId?: string}) -> Promise<AuthToken>
Creates short-lived login token (email → workspaceId mapping). Used before 2FA verification. Optional impersonation workspace ID.

### verifyLoginToken
file: auth/token/services/login-token.service.ts:52
Signature: (loginToken: string) -> Promise<LoginTokenJwtPayload>
Verifies and decodes login token. Validates token type is LOGIN. Returns payload with email, workspace ID.

## auth/token/services/transient-token.service.ts

### generateTransientToken
file: auth/token/services/transient-token.service.ts:25
Signature: (workspaceMemberId: string, workspaceId: string, userId: string) -> Promise<AuthToken>
Creates very short-lived token for authenticated member. Token type LOGIN but for single user context.

### verifyTransientToken
file: auth/token/services/transient-token.service.ts:52
Signature: (transientToken: string) -> Promise<Omit<TransientTokenJwtPayload, 'type'|'sub'>>
Verifies transient token. Returns workspace/user IDs.

## auth/token/services/workspace-agnostic-token.service.ts

### generateWorkspaceAgnosticToken
file: auth/token/services/workspace-agnostic-token.service.ts:33
Signature: (userId: string, authProvider: AuthProviderEnum) -> Promise<AuthToken>
Creates workspace-agnostic token for authenticated user across all workspaces. No workspace ID in payload. Used after initial signup.

### validateToken
file: auth/token/services/workspace-agnostic-token.service.ts:70
Signature: (token: string) -> Promise<AuthContext>
Verifies workspace-agnostic token, loads user from database. Returns auth context with user only (no workspace).

## auth/token/services/renew-token.service.ts

### generateTokensFromRefreshToken
file: auth/token/services/renew-token.service.ts:29
Signature: (token: string) -> Promise<{accessOrWorkspaceAgnosticToken: AuthToken, refreshToken: AuthToken}>
Exchanges refresh token for new access and refresh token pair. Revokes old refresh token (respects grace period). Routes to workspace-agnostic or access token based on original targeted type.

## auth/token/services/email-verification-token.service.ts

### generateToken
file: auth/token/services/email-verification-token.service.ts:33
Signature: (userId: string, email: string) -> Promise<AuthToken>
Generates email verification token: creates random bytes, stores SHA256 hash in AppTokenEntity with email context. Returns plaintext token for email link.

### validateEmailVerificationTokenOrThrow
file: auth/token/services/email-verification-token.service.ts:61
Signature: (emailVerificationToken: string, email: string) -> Promise<AppTokenEntity>
Validates email verification token: checks email not already verified, token exists, not expired, type correct, email matches context. Returns AppTokenEntity.

## jwt/services/jwt-wrapper.service.ts

### signAsyncOrThrow
file: jwt/services/jwt-wrapper.service.ts:52
Signature: (payload: JwtPayload, options: {expiresIn: string|number, jwtid?: string}) -> Promise<string>
Signs JWT using current EC P-256 private key. Sets algorithm ES256 and key ID. Throws if no signing key available.

### verifyJwtToken
file: jwt/services/jwt-wrapper.service.ts:131
Signature: (token: string, options?: JwtVerifyOptions) -> Promise<any>
Resolves verification key (asymmetric or legacy symmetric), verifies JWT. Includes backward compatibility fallback for accidentally-signed API_KEY tokens.

### resolveVerificationKey
file: jwt/services/jwt-wrapper.service.ts:88
Signature: (rawToken: string) -> Promise<{key: string, algorithm: string}>
Decodes header, checks if asymmetric (has kid). If yes, fetches public key. If no, extracts app secret body and generates legacy symmetric key.

### generateAppSecret
file: jwt/services/jwt-wrapper.service.ts:189
Signature: (type: JwtTokenTypeEnum, appSecretBody: string) -> string
Creates deterministic symmetric signing key: SHA256(APP_SECRET + appSecretBody + type). Used for legacy tokens.

### verify
file: jwt/services/jwt-wrapper.service.ts:76
Signature: (token: string, options?: {secret: string}) -> T
Wraps NestJS JwtService.verify(). Generic signature verification.

### decode
file: jwt/services/jwt-wrapper.service.ts:84
Signature: (payload: string, options?: jwt.DecodeOptions) -> T
Decodes JWT without verification. Used to read payload before verification.

## jwt/services/jwt-key-manager.service.ts

### getCurrentSigningKey
file: jwt/services/jwt-key-manager.service.ts:43
Signature: () -> Promise<CurrentSigningKey|null>
Loads or creates current EC P-256 signing key. Caches in memory for 60s. On failure, logs warning and returns null (falls back to HS256).

### getValidPublicKeyPemById
file: jwt/services/jwt-key-manager.service.ts:67
Signature: (id: string) -> Promise<string|null>
Fetches public key PEM from cache by signing key ID. Validates UUID format. Returns null if invalid/not found.

### listSigningKeys
file: jwt/services/jwt-key-manager.service.ts:75
Signature: () -> Promise<SigningKeyEntity[]>
Lists all signing keys ordered by creation date descending.

### rotateCurrent
file: jwt/services/jwt-key-manager.service.ts:81
Signature: () -> Promise<CurrentSigningKey>
Generates new EC P-256 key pair, marks current as non-current, inserts new as current in transaction. Invalidates cache.

### revokeSigningKey
file: jwt/services/jwt-key-manager.service.ts:112
Signature: (id: string) -> Promise<SigningKeyEntity>
Marks signing key revoked, clears private key, invalidates cache. Returns revoked entity.

### loadOrCreateCurrentSigningKey
file: jwt/services/jwt-key-manager.service.ts:151
Signature: () -> Promise<CurrentSigningKey|null>
Finds current signing key or generates/persists new one. Handles race conditions on insert. Returns null on error.

### generateEcP256KeyPair
file: jwt/services/jwt-key-manager.service.ts:234
Signature: () -> {privateKeyPem: PlaintextString, publicKeyPem: string}
Generates EC P-256 key pair using crypto module. Exports as PEM format.

## secret-encryption/secret-encryption.service.ts

### encrypt
file: secret-encryption/secret-encryption.service.ts:35
Signature: (value: string) -> string
Legacy AES-CTR encryption. Derives key from APP_SECRET via SHA512, generates random IV, returns IV+ciphertext as base64.

### decrypt
file: secret-encryption/secret-encryption.service.ts:50
Signature: (value: string) -> string
Legacy AES-CTR decryption. Extracts IV, decrypts ciphertext. No integrity check—wrong key yields garbage.

### encryptVersioned
file: secret-encryption/secret-encryption.service.ts:106
Signature: (value: PlaintextString, opts?: {workspaceId?: string}) -> EncryptedString
Encrypts with AES-GCM v2 envelope. Prepends version prefix and key ID. Workspace-aware derivation. Returns branded EncryptedString.

### decryptVersioned
file: secret-encryption/secret-encryption.service.ts:130
Signature: (value: EncryptedString, opts?: {workspaceId?: string}) -> PlaintextString
Parses envelope, checks version. If v2, uses GCM decryption. If unprefixed, falls back to legacy CTR with warning. Returns branded PlaintextString.

### decryptAndMask
file: secret-encryption/secret-encryption.service.ts:62
Signature: (value: string, mask: string) -> string
Decrypts legacy value, masks result. Shows up to 5 chars or 1/10th of length.

### decryptAndMaskVersioned
file: secret-encryption/secret-encryption.service.ts:76
Signature: (value: EncryptedString, mask: string, workspaceId?: string) -> string
Decrypts versioned value, masks result. Workspace-aware.

## two-factor-authentication/two-factor-authentication.service.ts

### validateTwoFactorAuthenticationRequirement
file: two-factor-authentication/two-factor-authentication.service.ts:84
Signature: (targetWorkspace: WorkspaceEntity, userTwoFactorAuthenticationMethods?: TwoFactorAuthenticationMethodEntity[]) -> Promise<void>
Checks if 2FA is set up and verified (throws VERIFICATION_REQUIRED) or if 2FA enforced but not set up (throws PROVISION_REQUIRED).

### initiateStrategyConfiguration
file: two-factor-authentication/two-factor-authentication.service.ts:108
Signature: (userId: string, userEmail: string, workspaceId: string, workspaceDisplayName?: string) -> Promise<string>
Starts 2FA provisioning. Generates TOTP secret or reuses existing PENDING method within window. Returns QR code URI for authenticator app.

### validateStrategy
file: two-factor-authentication/two-factor-authentication.service.ts:177
Signature: (userId: string, token: string, workspaceId: string, twoFactorAuthenticationStrategy: TwoFactorAuthenticationStrategy) -> Promise<void>
Validates OTP token against stored secret. Decrypts secret (legacy CBC or v2 GCM), validates token, marks status VERIFIED. Throws if invalid/missing.

### verifyTwoFactorAuthenticationMethodForAuthenticatedUser
file: two-factor-authentication/two-factor-authentication.service.ts:236
Signature: (userId: string, token: string, workspaceId: string) -> Promise<{success: true}>
Wrapper for validateStrategy with TOTP strategy. Returns success flag.

### decryptStoredSecret
file: two-factor-authentication/two-factor-authentication.service.ts:55
Signature: (storedSecret: EncryptedString, userId: string, workspaceId: string) -> Promise<PlaintextString>
Decrypts 2FA secret. If v2 envelope, uses versioned decryption. If legacy, uses CBC with userId+workspaceId purpose.

## api-key/services/api-key.service.ts

### create
file: api-key/services/api-key.service.ts:30
Signature: (apiKeyData: Partial<ApiKeyEntity> & {roleId, workspaceId}) -> Promise<ApiKeyEntity>
Creates API key and associates with role via RoleTarget. On error, rolls back API key. Invalidates cache.

### findById
file: api-key/services/api-key.service.ts:58
Signature: (id: string, workspaceId: string) -> Promise<ApiKeyEntity|null>
Fetches API key by ID in workspace context.

### findByWorkspaceId
file: api-key/services/api-key.service.ts:67
Signature: (workspaceId: string) -> Promise<ApiKeyEntity[]>
Lists all API keys in workspace.

### findActiveByWorkspaceId
file: api-key/services/api-key.service.ts:71
Signature: (workspaceId: string) -> Promise<ApiKeyEntity[]>
Lists non-revoked API keys in workspace.

### update
file: api-key/services/api-key.service.ts:77
Signature: (id: string, workspaceId: string, updateData: QueryDeepPartialEntity<ApiKeyEntity>) -> Promise<ApiKeyEntity|null>
Updates API key fields, invalidates cache. Returns updated entity or null if not found.

### revoke
file: api-key/services/api-key.service.ts:94
Signature: (id: string, workspaceId: string) -> Promise<ApiKeyEntity|null>
Marks API key as revoked (sets revokedAt timestamp).

### validateApiKey
file: api-key/services/api-key.service.ts:98
Signature: (id: string, workspaceId: string) -> Promise<ApiKeyEntity>
Validates API key exists, not revoked, not expired. Throws on any violation.

### generateApiKeyToken
file: api-key/services/api-key.service.ts:131
Signature: (workspaceId: string, apiKeyId?: string, expiresAt?: Date|string) -> Promise<Pick<ApiKeyToken, 'token'>|undefined>
Generates JWT token from API key for API auth. Optional custom expiry, defaults to 100y.

### isExpired
file: api-key/services/api-key.service.ts:167
Signature: (apiKey: ApiKeyEntity) -> boolean
Checks if API key expiresAt has passed.

### isRevoked
file: api-key/services/api-key.service.ts:171
Signature: (apiKey: ApiKeyEntity) -> boolean
Checks if API key has revokedAt timestamp.

### isActive
file: api-key/services/api-key.service.ts:175
Signature: (apiKey: ApiKeyEntity) -> boolean
Returns true if not revoked and not expired.

## auth/auth.util.ts

### hashPassword
file: auth/auth.util.ts:14
Signature: (password: string) -> Promise<string>
Hashes password with bcrypt salt rounds 10. Used on signup/password change.

### compareHash
file: auth/auth.util.ts:18
Signature: (password: string, passwordHash: string) -> Promise<boolean>
Compares plaintext password against bcrypt hash. Used on login.

### encryptText
file: auth/auth.util.ts:22
Signature: (textToEncrypt: string, key: string) -> string
Legacy AES-256-CTR encryption. Derives 32-char key from SHA512(key), generates random IV, returns IV+ciphertext base64.

### decryptText
file: auth/auth.util.ts:39
Signature: (textToDecrypt: string, key: string) -> string
Legacy AES-256-CTR decryption. Extracts IV, decrypts. No integrity.

## Guards

### isUserAuthContext
file: auth/guards/is-user-auth-context.guard.ts:6
Signature: (context: WorkspaceAuthContext) -> boolean
Type guard: returns true if context.type === 'user'. Narrows to UserWorkspaceAuthContext.

### isApiKeyAuthContext
file: auth/guards/is-api-key-auth-context.guard.ts:6
Signature: (context: WorkspaceAuthContext) -> boolean
Type guard: returns true if context.type === 'apiKey'. Narrows to ApiKeyWorkspaceAuthContext.

## Controllers

### googleAuth
file: auth/controllers/google-auth.controller.ts:34
GET /auth/google - Initiates Google OAuth flow. Protected by GoogleOauthGuard. No-op method triggering guard redirect.

### googleAuthRedirect
file: auth/controllers/google-auth.controller.ts:47
GET /auth/google/redirect - OAuth callback. Calls authService.signInUpWithSocialSSO(), redirects to final URL.

## Utilities

### buildUserAuthContext
file: auth/utils/build-user-auth-context.util.ts:13
Signature: (UserAuthContextInput) -> UserWorkspaceAuthContext
Builds typed user workspace auth context from auth components.

### decodeJwtHeader
file: jwt/utils/decode-jwt-header.util.ts:4
Signature: (rawJwtToken: string) -> jwt.JwtHeader|undefined
Safely decodes JWT header without verification. Returns undefined on parse error.

### decodeJwtPayload
file: jwt/utils/decode-jwt-payload.util.ts:4
Signature: (rawJwtToken: string) -> T|undefined
Safely decodes JWT payload without verification as T. Generic. Returns undefined on error.

## OAuth Controllers

### microsoftAuth
file: auth/controllers/microsoft-auth.controller.ts:33
Signature: () -> Promise<void>
Initiates Microsoft OAuth 2.0 flow. Protected by MicrosoftOAuthGuard and MicrosoftProviderEnabledGuard. No-op method triggering OAuth redirect via guard.

### microsoftAuthRedirect
file: auth/controllers/microsoft-auth.controller.ts:45
Signature: (req: MicrosoftRequest, res: Response) -> Promise<Response>
OAuth callback handler for Microsoft. Calls authService.signInUpWithSocialSSO(). Redirects user to appropriate workspace URL after authentication.

### MicrosoftAuth
file: auth/controllers/microsoft-apis-auth.controller.ts:54
Signature: () -> Promise<void>
Initiates Microsoft APIs OAuth flow for calendar/messaging. Protected by guard. No-op method.

### MicrosoftAuthGetAccessToken
file: auth/controllers/microsoft-apis-auth.controller.ts:65
Signature: (req: APIsOAuthRequest, res: Response) -> Promise<Response>
Exchanges authorization code for access token. Verifies transient token, calls microsoftAPIsService.refreshMicrosoftRefreshToken(), creates message/calendar channels, redirects to settings.

### googleAuth
file: auth/controllers/google-apis-auth.controller.ts:54
Signature: () -> Promise<void>
Initiates Google APIs OAuth flow. Protected by guard. No-op method triggering OAuth redirect.

### googleAuthGetAccessToken
file: auth/controllers/google-apis-auth.controller.ts:65
Signature: (req: APIsOAuthRequest, res: Response) -> Promise<Response>
Exchanges authorization code for access token. Verifies transient token, calls googleAPIsService.refreshGoogleRefreshToken(), creates message/calendar channels, redirects to settings.

### generateMetadata
file: auth/controllers/sso-auth.controller.ts:66
Signature: (req: any) -> Promise<string>
Generates SAML metadata XML for service provider. Used for SAML IdP configuration. Returns XML string.

### oidcAuth
file: auth/controllers/sso-auth.controller.ts:87
Signature: () -> Promise<void>
Initiates OIDC authentication flow. Protected by OIDCAuthGuard and EnterpriseFeaturesEnabledGuard. No-op method.

### samlAuth
file: auth/controllers/sso-auth.controller.ts:99
Signature: () -> Promise<void>
Initiates SAML authentication flow. Protected by SAMLAuthGuard and EnterpriseFeaturesEnabledGuard. No-op method.

### oidcAuthCallback
file: auth/controllers/sso-auth.controller.ts:111
Signature: (req: OIDCRequest, res: Response) -> Promise<Response>
OIDC callback handler. Validates identity provider, exchanges token, creates SSO connected account if needed, redirects to workspace.

### samlAuthCallback
file: auth/controllers/sso-auth.controller.ts:122
Signature: (req: SAMLRequest, res: Response) -> Promise<Response>
SAML callback handler. Validates identity provider, exchanges assertion, creates SSO connected account, redirects to workspace. Catches auth errors.

### propagateOAuthCallback
file: auth/controllers/oauth-propagator.controller.ts:35
Signature: (state: string, code: string, res: Response) -> Promise<Response>
Propagates OAuth callback from custom domain to main domain. Validates state/code parameters, checks domain validity, redirects with code/state.

## Passport Strategies

### GoogleStrategy.validate
file: auth/strategies/google.auth.strategy.ts:68
Signature: (request: GoogleRequest, _accessToken, _refreshToken, profile: GoogleProfile, done: VerifyCallback) -> Promise<void>
Validates Google profile. Extracts verified email, name, picture. Parses state for workspace/invitation context. Returns normalized user object.

### MicrosoftStrategy.validate
file: auth/strategies/microsoft.auth.strategy.ts:70
Signature: (request: MicrosoftRequest, _accessToken, _refreshToken, profile: MicrosoftPassportProfile, done: VerifyCallback) -> Promise<void>
Validates Microsoft profile. Extracts user principal name, name, picture. Parses state for context. Returns normalized user object.

### JwtAuthStrategy.validate
file: auth/strategies/jwt.auth.strategy.ts:427
Signature: (payload: JwtPayload) -> Promise<AuthContext>
Routes JWT validation by token type. Supports access, workspace-agnostic, API key, and application tokens. Validates token, loads user/workspace, enforces workspace membership, checks impersonation permissions.

### JwtAuthStrategy.validateAccessToken (private)
file: auth/strategies/jwt.auth.strategy.ts:102
Signature: (payload: AccessTokenJwtPayload) -> Promise<AuthContext>
Validates access token. Loads workspace, user, workspace member. Checks workspace activation status. Validates impersonation if present. Returns full auth context with member.

### JwtAuthStrategy.validateAPIKey (private)
file: auth/strategies/jwt.auth.strategy.ts:62
Signature: (payload: ApiKeyTokenJwtPayload) -> Promise<AuthContext>
Validates API key token. Checks key not revoked, not expired. Returns minimal auth context with key and workspace.

### JwtAuthStrategy.validateWorkspaceAgnosticToken (private)
file: auth/strategies/jwt.auth.strategy.ts:344
Signature: (payload: WorkspaceAgnosticTokenJwtPayload) -> Promise<AuthContext>
Validates workspace-agnostic token. Loads user from cache. Returns auth context with user only (no workspace).

### JwtAuthStrategy.validateApplicationToken (private)
file: auth/strategies/jwt.auth.strategy.ts:357
Signature: (payload: ApplicationAccessTokenJwtPayload) -> Promise<AuthContext>
Validates application token. Loads application and workspace. Optionally loads user context if provided. Returns auth context.

### OIDCAuthStrategy.validate
file: auth/strategies/oidc.auth.strategy.ts:86
Signature: (req: Request, tokenset: TokenSet, done: any) -> Promise<void>
Validates OIDC token. Extracts user info from token claims. Returns email, name, and saved token claims for SSO.

### SamlAuthStrategy.validate
file: auth/strategies/saml.auth.strategy.ts:132
Signature: (request: Request, profile: any, done: any) -> void
Validates SAML assertion. Extracts email from profile. Validates email format. Returns identity provider ID and extracted data.

### GoogleAPIsOauthCommonStrategy (abstract)
file: auth/strategies/google-apis-oauth-common.auth.strategy.ts:13
Base Passport strategy for Google APIs OAuth. Configures Google client ID/secret, callback URL, scopes. Subclassed by request/token strategies.

### GoogleAPIsOauthRequestCodeStrategy.validate
file: auth/strategies/google-apis-oauth-request-code.auth.strategy.ts:39
Signature: () -> void
No-op validation for Google APIs request code flow. Used only to trigger authorization request, not validation.

### GoogleAPIsOauthExchangeCodeForTokenStrategy.validate
file: auth/strategies/google-apis-oauth-exchange-code-for-token.auth.strategy.ts:21
Signature: (request: APIsOAuthRequest, accessToken: PlaintextString, refreshToken: PlaintextString, profile: GoogleProfile, done: VerifyCallback) -> Promise<void>
Extracts tokens and user profile from Google. Returns structured user object with tokens, emails, visibility preferences.

### MicrosoftAPIsOauthCommonStrategy (abstract)
file: auth/strategies/microsoft-apis-oauth-common.auth.strategy.ts:14
Base Passport strategy for Microsoft APIs OAuth. Configures Microsoft client ID/secret, callback URL, scopes. Subclassed by request/token strategies.

### MicrosoftAPIsOauthRequestCodeStrategy.validate
file: auth/strategies/microsoft-apis-oauth-request-code.auth.strategy.ts:34
Signature: () -> void
No-op validation for Microsoft APIs request code flow. Used only to trigger authorization request.

### MicrosoftAPIsOauthExchangeCodeForTokenStrategy.validate
file: auth/strategies/microsoft-apis-oauth-exchange-code-for-token.auth.strategy.ts:19
Signature: (request: APIsOAuthRequest, accessToken: PlaintextString, refreshToken: PlaintextString, profile: MicrosoftPassportProfile, done: VerifyCallback) -> Promise<void>
Extracts tokens and user profile from Microsoft. Returns structured user object with tokens, emails, visibility preferences.

## OAuth Guards

### GoogleOauthGuard.canActivate
file: auth/guards/google-oauth.guard.ts:29
Signature: (context: ExecutionContext) -> Promise<boolean>
Validates Google OAuth flow initiation. Extracts workspace ID, checks for access_denied error, delegates to Passport. Dispatches errors via redirect service.

### MicrosoftOAuthGuard.canActivate
file: auth/guards/microsoft-oauth.guard.ts:33
Signature: (context: ExecutionContext) -> Promise<boolean>
Validates Microsoft OAuth flow initiation. Checks transient Microsoft errors and retries. Delegates to Passport. Dispatches errors via redirect service.

### GoogleProviderEnabledGuard.canActivate
file: auth/guards/google-provider-enabled.guard.ts:22
Signature: (context: ExecutionContext) -> boolean
Checks if Google OAuth is enabled via config. Initializes GoogleStrategy. Throws if disabled. Used before OAuth flow.

### MicrosoftProviderEnabledGuard.canActivate
file: auth/guards/microsoft-provider-enabled.guard.ts:22
Signature: (context: ExecutionContext) -> boolean
Checks if Microsoft OAuth is enabled via config. Initializes MicrosoftStrategy. Throws if disabled. Used before OAuth flow.

### EnterpriseFeaturesEnabledGuard.canActivate
file: auth/guards/enterprise-features-enabled.guard.ts:23
Signature: (context: ExecutionContext) -> boolean
Validates enterprise plan is valid. Used for OIDC/SAML/SSO endpoints. Dispatches errors via redirect service.

### OIDCAuthGuard.canActivate
file: auth/guards/oidc-auth.guard.ts:55
Signature: (context: ExecutionContext) -> Promise<boolean>
Initializes OIDC flow. Finds identity provider by ID, discovers OIDC issuer, creates strategy dynamically. Validates identity provider exists.

### SAMLAuthGuard.canActivate
file: auth/guards/saml-auth.guard.ts:29
Signature: (context: ExecutionContext) -> Promise<boolean>
Initializes SAML flow. Finds identity provider by ID, creates SAML strategy. Validates identity provider exists before delegating to Passport.

### GoogleAPIsOauthRequestCodeGuard.canActivate
file: auth/guards/google-apis-oauth-request-code.guard.ts:33
Signature: (context: ExecutionContext) -> Promise<boolean>
Validates Google APIs request code flow. Verifies transient token, sets request params, delegates to strategy. Handles errors.

### GoogleAPIsOauthExchangeCodeForTokenGuard.canActivate
file: auth/guards/google-apis-oauth-exchange-code-for-token.guard.ts:33
Signature: (context: ExecutionContext) -> Promise<boolean>
Validates Google APIs token exchange. Checks config enabled, verifies transient token, creates strategy. Handles 401 errors with specific redirect.

### MicrosoftAPIsOauthRequestCodeGuard.canActivate
file: auth/guards/microsoft-apis-oauth-request-code.guard.ts:36
Signature: (context: ExecutionContext) -> Promise<boolean>
Validates Microsoft APIs request code flow. Verifies transient token, checks config, sets params, delegates to strategy.

### MicrosoftAPIsOauthExchangeCodeForTokenGuard.canActivate
file: auth/guards/microsoft-apis-oauth-exchange-code-for-token.guard.ts:24
Signature: (context: ExecutionContext) -> Promise<boolean>
Validates Microsoft APIs token exchange. Checks config, creates strategy, handles 403 errors with scopes message.

## Exception Filters

### AuthRestApiExceptionFilter.catch
file: auth/filters/auth-rest-api-exception.filter.ts:21
Signature: (exception: AuthException | Error, host: ArgumentsHost) -> void
Maps AuthException codes to HTTP status codes. Delegates to httpExceptionHandlerService. Maps 404, 400, 403, 401, 500 based on code.

### AuthGraphqlApiExceptionFilter.catch
file: auth/filters/auth-graphql-api-exception.filter.ts:8
Signature: (exception: AuthException) -> void
Catches AuthException in GraphQL. Delegates to authGraphqlApiExceptionHandler utility for formatting GraphQL error response.

### AuthOAuthExceptionFilter.catch
file: auth/filters/auth-oauth-exception.filter.ts:23
Signature: (exception: AuthException, host: ArgumentsHost) -> void
Catches AuthException in OAuth flows. Redirects to base URL for OAUTH_ACCESS_DENIED. Delegates other errors to httpExceptionHandlerService.

## Middleware

### WorkspaceAuthContextMiddleware.use
file: auth/middlewares/workspace-auth-context.middleware.ts:20
Signature: (req: Request, _res: Response, next: NextFunction) -> void
Builds and stores workspace auth context from request components. Determines context type (user/apiKey/application/pending). Applies Sentry context. Stores context in async local storage.

## Type Guards

### isApplicationAuthContext
file: auth/guards/is-application-auth-context.guard.ts:6
Signature: (context: WorkspaceAuthContext) -> context is ApplicationWorkspaceAuthContext
Type guard: returns true if context.type === 'application'. Narrows to ApplicationWorkspaceAuthContext.

### isPendingActivationUserAuthContext
file: auth/guards/is-pending-activation-user-auth-context.guard.ts:6
Signature: (context: WorkspaceAuthContext) -> context is PendingActivationUserWorkspaceAuthContext
Type guard: returns true if context.type === 'pendingActivationUser'. Narrows to PendingActivationUserWorkspaceAuthContext.

### isSystemAuthContext
file: auth/guards/is-system-auth-context.guard.ts:6
Signature: (context: WorkspaceAuthContext) -> context is SystemWorkspaceAuthContext
Type guard: returns true if context.type === 'system'. Narrows to SystemWorkspaceAuthContext.

## OAuth Provider Integration Services

### GoogleAPIsService.refreshGoogleRefreshToken
file: auth/services/google-apis.service.ts:82
Signature: (input: {handle, userId, workspaceMemberId, workspaceId, accessToken, refreshToken, calendarVisibility, messageVisibility, skipMessageChannelConfiguration}) -> Promise<string>
Handles Google OAuth token refresh. Validates scopes and service availability. Creates/updates connected account and message/calendar channels. Returns connected account ID.

### MicrosoftAPIsService.refreshMicrosoftRefreshToken
file: auth/services/microsoft-apis.service.ts:78
Signature: (input: {handle, userId, workspaceMemberId, workspaceId, accessToken, refreshToken, calendarVisibility, messageVisibility, skipMessageChannelConfiguration}) -> Promise<string>
Handles Microsoft OAuth token refresh. Creates/updates connected account and message/calendar channels. Enqueues sync jobs. Returns connected account ID.

## Two-Factor Authentication Resolver

### initiateOTPProvisioning
file: two-factor-authentication/two-factor-authentication.resolver.ts:52
Signature: (initiateTwoFactorAuthenticationProvisioningInput: InitiateTwoFactorAuthenticationProvisioningInput, origin: string) -> Promise<InitiateTwoFactorAuthenticationProvisioningDTO>
Initiates 2FA setup from login token. Verifies login token, gets workspace from origin, starts OTP provisioning, returns QR code URI.

### initiateOTPProvisioningForAuthenticatedUser
file: two-factor-authentication/two-factor-authentication.resolver.ts:104
Signature: (user: AuthContextUser, workspace: WorkspaceEntity) -> Promise<InitiateTwoFactorAuthenticationProvisioningDTO>
Initiates 2FA setup for authenticated user. Directly calls initiateStrategyConfiguration, returns QR code URI.

### deleteTwoFactorAuthenticationMethod
file: two-factor-authentication/two-factor-authentication.resolver.ts:128
Signature: (deleteTwoFactorAuthenticationMethodInput: DeleteTwoFactorAuthenticationMethodInput, workspace: WorkspaceEntity, user: AuthContextUser) -> Promise<DeleteTwoFactorAuthenticationMethodDTO>
Deletes 2FA method. Validates user owns the method. Removes method from database. Returns success.

### verifyTwoFactorAuthenticationMethodForAuthenticatedUser
file: two-factor-authentication/two-factor-authentication.resolver.ts:165
Signature: (verifyTwoFactorAuthenticationMethodInput: VerifyTwoFactorAuthenticationMethodInput, workspace: WorkspaceEntity, user: AuthContextUser) -> Promise<VerifyTwoFactorAuthenticationMethodDTO>
Verifies OTP token. Delegates to service. Returns success/failure.

## API Key Resolver

### apiKeys
file: api-key/api-key.resolver.ts:36
Signature: (workspace: WorkspaceEntity) -> Promise<ApiKeyEntity[]>
Lists all active API keys in workspace.

### apiKey
file: api-key/api-key.resolver.ts:43
Signature: (input: GetApiKeyInput, workspace: WorkspaceEntity) -> Promise<ApiKeyEntity | null>
Gets single API key by ID in workspace context. Returns null if not found.

### createApiKey
file: api-key/api-key.resolver.ts:62
Signature: (workspace: WorkspaceEntity, input: CreateApiKeyInput) -> Promise<ApiKeyEntity>
Creates new API key with name, expiry. Associates with optional role. Returns created entity.

### updateApiKey
file: api-key/api-key.resolver.ts:76
Signature: (workspace: WorkspaceEntity, input: UpdateApiKeyInput) -> Promise<ApiKeyEntity | null>
Updates API key fields. Returns updated entity or null.

### revokeApiKey
file: api-key/api-key.resolver.ts:93
Signature: (workspace: WorkspaceEntity, input: RevokeApiKeyInput) -> Promise<ApiKeyEntity | null>
Revokes API key. Returns revoked entity or null.

### assignRoleToApiKey
file: api-key/api-key.resolver.ts:101
Signature: (workspace: WorkspaceEntity, apiKeyId: string, roleId: string) -> Promise<boolean>
Assigns role to API key. Returns success flag.

### role (ResolveField)
file: api-key/api-key.resolver.ts:120
Signature: (apiKey: ApiKeyEntity, workspace: WorkspaceEntity) -> Promise<RoleDTO>
Resolves role for API key. Returns role DTO.

## API Key Controller

### findAll
file: api-key/controllers/api-key.controller.ts:42
Signature: (workspace: WorkspaceEntity) -> Promise<ApiKeyEntity[]>
Lists all active API keys via REST.

### findOne
file: api-key/controllers/api-key.controller.ts:50
Signature: (id: string, workspace: WorkspaceEntity) -> Promise<ApiKeyEntity | null>
Gets single API key via REST.

### create
file: api-key/controllers/api-key.controller.ts:58
Signature: (createApiKeyDto: CreateApiKeyInput, workspace: WorkspaceEntity) -> Promise<ApiKeyEntity>
Creates API key via REST.

### update
file: api-key/controllers/api-key.controller.ts:74
Signature: (id: string, updateApiKeyDto: UpdateApiKeyInput, workspace: WorkspaceEntity) -> Promise<ApiKeyEntity | null>
Updates API key via REST.

### remove
file: api-key/controllers/api-key.controller.ts:95
Signature: (id: string, workspace: WorkspaceEntity) -> Promise<ApiKeyEntity | null>
Revokes API key via REST.

## API Key Role Service

### assignRoleToApiKey
file: api-key/services/api-key-role.service.ts:36
Signature: (apiKeyId: string, roleId: string, workspaceId: string) -> Promise<void>
Assigns role to API key via RoleTarget. Validates inputs. No-op if same role already assigned.

### getRoleIdForApiKeyId
file: api-key/services/api-key-role.service.ts:65
Signature: (apiKeyId: string, workspaceId: string) -> Promise<string>
Fetches role ID for API key from cache. Throws if no role assigned.

### getRoleDtoByApiKeyId
file: api-key/services/api-key-role.service.ts:86
Signature: (apiKeyId: string, workspaceId: string) -> Promise<RoleDTO>
Fetches role DTO for API key from cache. Throws if not found or no role.

### getRolesByApiKeys
file: api-key/services/api-key-role.service.ts:176
Signature: (apiKeyIds: string[], workspaceId: string) -> Promise<Map<string, RoleDTO>>
Fetches roles for multiple API keys. Returns map of API key ID -> RoleDTO.

### getApiKeysAssignedToRole
file: api-key/services/api-key-role.service.ts:208
Signature: (roleId: string, workspaceId: string) -> Promise<ApiKeyEntity[]>
Finds all active API keys assigned to a role.

## JWT Signing Key Services

### SigningKeyRotationService.rotateIfDue
file: jwt/services/signing-key-rotation.service.ts:27
Signature: () -> Promise<SigningKeyRotationResult>
Checks if signing key rotation is due based on age. Rotates key if age exceeds SIGNING_KEY_ROTATION_DAYS. Returns rotation result with old/new key IDs.

### SigningKeyVerifyCounterService.recordKidVerify
file: jwt/services/signing-key-verify-counter.service.ts:60
Signature: (kid: string) -> void
Records verification of token with key ID. Increments in-memory counter for later flush to Redis.

### SigningKeyVerifyCounterService.recordLegacyVerify
file: jwt/services/signing-key-verify-counter.service.ts:64
Signature: () -> void
Records verification of legacy token (pre-asymmetric). Increments legacy counter.

### SigningKeyVerifyCounterService.getUsageInWindow
file: jwt/services/signing-key-verify-counter.service.ts:68
Signature: (kids: string[]) -> Promise<SigningKeyUsage>
Gets 7-day rolling verification counts for key IDs. Flushes pending counts first. Returns usage by kid and legacy count.

### SigningKeyEntityCacheProviderService.computeForCache
file: jwt/services/signing-key-entity-cache-provider.service.ts:21
Signature: (entityId: string) -> Promise<string | null>
Loads public key for signing key ID. Filters non-revoked keys. Returns PEM-formatted public key or null.
