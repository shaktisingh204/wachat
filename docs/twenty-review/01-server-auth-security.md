# Twenty Server — Core Modules Review: Auth, Security & Workspace Cluster

> Original structured catalog (descriptions are paraphrased, not copied source). Scope: `twenty-server/src/engine/core-modules/{auth, jwt, sso, two-factor-authentication, api-key, app-token, approved-access-domain, secret-encryption, session-storage, impersonation, captcha, user, user-workspace, workspace, workspace-invitation, onboarding, guard-redirect}`.

The cluster is a NestJS + TypeORM (Postgres, `core` schema) + GraphQL (code-first, `@nestjs/graphql`) + Passport stack. Tokens are JWTs (legacy HS256 + asymmetric ES256 with rotating keys). Most flows are multi-tenant ("workspace") aware, sub-domain/custom-domain routed, and gated by Enterprise license + feature flags.

---

## auth

**Purpose:** The central authentication orchestrator — sign-up/sign-in (password, Google, Microsoft, SSO), email verification, password reset, multi-workspace selection, token issuance, OAuth/OIDC/SAML controllers, and the request-time auth-context middleware.

### Data model
This module owns no entity of its own; it composes `UserEntity`, `WorkspaceEntity`, `UserWorkspaceEntity`, `AppTokenEntity`, `WorkspaceSSOIdentityProviderEntity`, and `TwoFactorAuthenticationMethodEntity`. It defines a rich set of typed **auth contexts** instead.

| Type | Shape / role |
|---|---|
| `AuthContext` | Resolved caller: `user`, `workspace`, `apiKey?`, `workspaceMemberId?`, `authProvider`, impersonation pointers. |
| `WorkspaceAuthContext` | Subset stored per-request (AsyncLocalStorage) for the workspace scope. |
| Context builders | `build-user-auth-context`, `build-api-key-auth-context`, `build-application-auth-context`, `build-system-auth-context`, `build-pending-activation-user-auth-context` — discriminated factory utils. |
| `signInUp.type` | Internal DTO for the unified sign-in/sign-up pipeline (existing vs new user/workspace, invitation, SSO). |

### API surface — GraphQL (`AuthResolver`)
| Op | Kind | Purpose |
|---|---|---|
| `checkUserExists` | Query | Does an account exist for an email (drives the UI's "sign in vs sign up" branch). |
| `getAuthorizationUrlForSSO` | Mutation | Build the IdP authorization URL for a configured SSO provider. |
| `checkWorkspaceInviteHashIsValid` | Query | Validate a public invite-link hash. |
| `findWorkspaceFromInviteHash` | Query | Resolve the workspace behind an invite hash. |
| `getLoginTokenFromCredentials` | Mutation | Email+password → short-lived **login token** (captcha + password-auth guarded). |
| `signIn` / `signUp` | Mutation | Returns available workspaces + access tokens (the multi-workspace landing). |
| `verifyEmailAndGetLoginToken` | Mutation | Consume email-verification token → login token. |
| `verifyEmailAndGetWorkspaceAgnosticToken` | Mutation | Email verify → workspace-agnostic token for the workspace picker. |
| `getAuthTokensFromOTP` | Mutation | Complete 2FA (TOTP) → full auth tokens. |
| `signUpInWorkspace` / `signUpInNewWorkspace` | Mutation | Provision a user into an existing / brand-new workspace. |
| `generateTransientToken` | Mutation | Short-lived token for cross-domain hand-off (impersonation/SSO bridging). |
| `getAuthTokensFromLoginToken` | Mutation | Exchange a verified login token for access+refresh tokens; runs workspace-access, user-access, regular-auth and impersonation validation. |
| `authorizeApp` | Mutation | OAuth authorize step for third-party apps (returns auth code/redirect). |
| `renewToken` | Mutation | Refresh-token → new token pair. |
| `generateApiKeyToken` | Mutation | Mint a JWT bearer for an API key. |
| `emailPasswordResetLink` | Mutation | Send a password-reset email. |
| `updatePasswordViaResetToken` | Mutation | Consume reset token + set new password. |
| `validatePasswordResetToken` | Query | Pre-check a reset token (validity + masked email). |

### API surface — REST controllers
| Method + path | Purpose |
|---|---|
| `GET /auth/google` + `GET /auth/google/redirect` | Google OAuth start / callback (Passport `google` strategy). |
| `GET /auth/microsoft` + `GET /auth/microsoft/redirect` | Microsoft OAuth start / callback. |
| `GET /auth/google-apis` + `GET /auth/google-apis/get-access-token` | Connected-account scope grant + token exchange (Gmail/Calendar). |
| `GET /auth/microsoft-apis` + `.../get-access-token` | Same for Microsoft Graph (mail/calendar). |
| `GET /auth/saml/metadata/:idpId` | SP metadata XML for a SAML IdP. |
| `GET /auth/oidc/login/:idpId`, `GET /auth/saml/login/:idpId` | Begin SSO login. |
| `GET /auth/oidc/callback`, `POST /auth/saml/callback/:idpId` | SSO assertion/callback handling. |
| `GET /auth/oauth-propagator/callback` | Public endpoint that propagates an OAuth result across sub-domains. |

### Key services & behaviors
- **`SignInUpService`** — the unifying pipeline: `computePartialUserFromUserPayload`, `signInUp`, `generateHash`/`validatePassword` (bcrypt-style hashing), personal-invitation handling, "workspace ready for sign-in-up" assertions, sign-up-enabled gating, **per-instance workspace-count limit** (capped without Enterprise key), onboarding activation, and `signUpOnNewWorkspace` / `signUpWithoutWorkspace`.
- **`AuthService`** (large) — `validateWorkspaceAccess`, `validateUserAccess`, `validateRegularAuthentication`, `validateAndLogImpersonation`; produces available-workspace lists and token pairs; audits monitoring events.
- **`AuthSsoService`** — resolve the workspace from a workspace-id or auth-provider for SSO callbacks.
- **`ResetPasswordService`** — generate/store reset token (as an `AppToken`), email it, validate, and invalidate; finds the first password-auth-enabled workspace for the email.
- **Passport strategies**: `jwt`, `google`, `microsoft`, `oidc`, `saml`, plus Google/Microsoft "APIs" strategies (request-code / exchange-code) for connected-account scopes; Microsoft has a transient-error retry helper.
- **`WorkspaceAuthContextMiddleware`** + `workspace-auth-context.storage` — populate request-scoped workspace context via AsyncLocalStorage.
- **Connected-account services**: `create-connected-account`, `create-message-channel`, `create-calendar-channel`, `create-sso-connected-account`, `update-connected-account-on-reconnect` — wire OAuth grants into messaging/calendar sync.
- **Guards** discriminate context kind (`is-user/api-key/application/system/pending-activation-auth-context`), enterprise-features, provider-enabled, and OIDC/SAML/Google/Microsoft OAuth flows. Redirect-URI validation util guards open-redirects.
- **Exception filters** translate auth errors per transport (GraphQL / REST / OAuth-redirect) and map to REST status codes.

### Background jobs
None directly (delegates token rotation to `jwt`, custom-domain checks to `workspace`).

---

## jwt

**Purpose:** JWT signing/verification wrapper plus an asymmetric **signing-key manager** with rotation, caching, and revocation — supports a legacy HS256 secret alongside ES256 key-pairs (JWKS-style key-id resolution).

### Data model
| Entity (`core.signingKey`) | Field : type | Notes |
|---|---|---|
| `SigningKeyEntity` | `id:uuid`, `publicKey:varchar`, `privateKey:EncryptedString\|null`, `isCurrent:boolean`, `revokedAt:Date\|null`, `createdAt`, `updatedAt` | Partial-unique index enforces a single `isCurrent=true` row; a CHECK constraint requires `privateKey` to be an `enc:v2:` envelope (encrypted at rest). |

### Key services & behaviors
- **`JwtWrapperService`** — `signAsyncOrThrow` (signs with current private PEM + algorithm), `verify`/`decode`, `resolveVerificationKey` (legacy secret vs asymmetric public key by header `kid`), `verifyJwtToken` (tries supported verify algorithms), `generateAppSecret`, and `extractJwtFromRequest` (Passport extractor). Supported verify algorithms: HS256 (legacy) + ES256 (asymmetric).
- **`JwtKeyManagerService`** — `getCurrentSigningKey`, `getValidPublicKeyPemById`, `listSigningKeys`, `rotateCurrent`, `revokeSigningKey`, lazy load-or-create of the current key, generate-and-persist (private key encrypted via secret-encryption before insert).
- **`SigningKeyRotationService.rotateIfDue`** — rotate only when the current key is past its rotation window.
- **`SigningKeyEntityCacheProviderService`** — caches signing-key rows; **`SigningKeyVerifyCounterService`** tracks verify usage (informs safe revocation of an old key).
- Utils: decode JWT header/payload, detect asymmetric headers.

### Background jobs / crons
- **`RotateSigningKeysCronCommand` + `RotateSigningKeysCronJob`** (Bull `cronQueue`, pattern `15 3 * * *`, Enterprise-licensed) — daily signing-key rotation.

---

## sso

**Purpose:** (Enterprise) Per-workspace SSO identity providers — OIDC and SAML setup, authorization URL generation, edit/delete, and SP callback URL building.

### Data model
| Entity (`core.workspaceSSOIdentityProvider`) | Field : type | Notes |
|---|---|---|
| `WorkspaceSSOIdentityProviderEntity` | `id:uuid`, `name:string`, `status:enum(Active/Inactive/Error)`, `type:enum(OIDC/SAML)`, `issuer:string`, `clientID?`, `clientSecret?`, `ssoURL?`, `certificate?`, `fingerprint?`, `createdAt`, `updatedAt` + workspace relation (extends `WorkspaceRelatedEntity`). | OIDC fields (`clientID/clientSecret`) vs SAML fields (`ssoURL/certificate/fingerprint`) are conditionally populated. |

### API surface — GraphQL (`SSOResolver`)
| Op | Kind | Purpose |
|---|---|---|
| `createOIDCIdentityProvider` | Mutation | Register an OIDC IdP (resolves issuer metadata). |
| `createSAMLIdentityProvider` | Mutation | Register a SAML IdP (cert validated via x509 validator). |
| `getSSOIdentityProviders` | Query | List configured IdPs for the workspace. |
| `editSSOIdentityProvider` | Mutation | Update an IdP. |
| `deleteSSOIdentityProvider` | Mutation | Remove an IdP. |

### Key services & behaviors
- **`SSOService`** — `isSSOEnabled` (Enterprise gate), `getIssuerForOIDC` (discovery), create OIDC/SAML providers, `buildCallbackUrl`/`buildIssuerURL`, `getOIDCClient`, **`getAuthorizationUrlForSSO`** (builds the redirect to the IdP using Authorization-Code flow), and CRUD. `x509.validator` validates SAML certs.

### Background jobs
None.

---

## two-factor-authentication

**Purpose:** TOTP-based 2FA — provisioning (QR/secret), verification, deletion, optional per-workspace enforcement. Secrets are stored encrypted.

### Data model
| Entity (`core.twoFactorAuthenticationMethod`) | Field : type | Notes |
|---|---|---|
| `TwoFactorAuthenticationMethodEntity` | `id:uuid`, `workspaceId:uuid`, `userWorkspaceId:uuid`, `secret:EncryptedString`, `status:enum(PENDING/VERIFIED)`, `strategy:enum(TOTP)`, `createdAt`, `updatedAt`, `deletedAt?` | Unique on `(userWorkspaceId, strategy)`; CHECK forces `secret` to be an `enc:v2:` envelope; cascades on workspace / user-workspace delete. |

### API surface — GraphQL (`TwoFactorAuthenticationResolver`)
| Op | Kind | Purpose |
|---|---|---|
| `initiateOTPProvisioning` | Mutation | Begin 2FA setup during login (unauthenticated-ish, login-token scoped) → returns provisioning URI. |
| `initiateOTPProvisioningForAuthenticatedUser` | Mutation | Begin setup for a logged-in user. |
| `verifyTwoFactorAuthenticationMethodForAuthenticatedUser` | Mutation | Confirm a code → mark method VERIFIED. |
| `deleteTwoFactorAuthenticationMethod` | Mutation | Remove a 2FA method. |

### Key services & behaviors
- **`TwoFactorAuthenticationService`** — `validateTwoFactorAuthenticationRequirement` (is 2FA required for this login?), `initiateStrategyConfiguration` (generate secret, store PENDING), `validateStrategy` (verify a code, flip to VERIFIED), `verifyTwoFactorAuthenticationMethodForAuthenticatedUser`, and `decryptStoredSecret` (via secret-encryption).
- **`TotpStrategy`** — wraps `@otplib` `authenticator`: `generateSecret`, `keyuri` (otpauth:// provisioning URI), and `validate` (window-tolerant code check). Configurable algorithm (SHA1/256/512), digits (6–8), step (default 30s), window (default 3), validated by a Zod schema.
- `simple-secret-encryption.util` + presenter (masked summary DTO) round out the module. A dedicated exception filter maps 2FA errors.

### Background jobs
None.

---

## api-key

**Purpose:** Workspace-scoped API keys (long-lived bearer access for the public REST/GraphQL API) with role assignment, expiry, revocation, and a per-workspace cache.

### Data model
| Entity (`core.apiKey`) | Field : type | Notes |
|---|---|---|
| `ApiKeyEntity` | `id:uuid`, `name:string`, `expiresAt:Date`, `revokedAt?:Date`, `createdAt`, `updatedAt` (extends `WorkspaceRelatedEntity`). | The secret itself is **not stored** — only metadata; the token is a JWT minted from the key id. Indexed by `workspaceId`. |

### API surface
GraphQL (`ApiKeyResolver`): `apiKeys` / `apiKey` (Query), `createApiKey`, `updateApiKey`, `revokeApiKey`, `assignRoleToApiKey` (Mutation); resolves the assigned `role`.

REST (`ApiKeyController`, mounted at `rest/apiKeys` and `rest/metadata/apiKeys`): `GET /` findAll, `GET /:id`, `POST /` create, `PUT/PATCH` update, `DELETE /:id` revoke.

### Key services & behaviors
- **`ApiKeyService`** — `create`, `findById`, `findByWorkspaceId`, `findActiveByWorkspaceId`, `update`, `revoke`, **`validateApiKey`** (rejects expired/revoked), `generateApiKeyToken` (JWT bearer), `isExpired/isRevoked/isActive`, and `invalidateApiKeyCache`.
- **`ApiKeyRoleService`** — bind a role to an API key (RBAC for machine callers).
- **`WorkspaceApiKeyMapCacheService`** — caches the workspace→active-keys map for fast request-time validation.
- **`generate-api-key.command`** — CLI to mint a key.

### Background jobs
None (cache invalidation only).

---

## app-token

**Purpose:** A generic, polymorphic token row used as the storage backbone for refresh tokens, OAuth codes/challenges, password-reset, email-verification, invitation, and enterprise-validity tokens.

### Data model
| Entity (`core.appToken`) | Field : type | Notes |
|---|---|---|
| `AppTokenEntity` | `id:uuid`, `userId?:uuid`, `workspaceId?:uuid`, `type:enum(AppTokenType)`, `value?:text`, `expiresAt:Date`, `revokedAt?`, `deletedAt?`, `context?:jsonb`, `createdAt`, `updatedAt` | `AppTokenType` ∈ {RefreshToken, CodeChallenge, AuthorizationCode, PasswordResetToken, InvitationToken, EmailVerificationToken, EnterpriseValidityToken}. `context` jsonb holds `{email, roleId, redirectUri, clientId, codeChallenge, scope}`; a before-insert hook lower-cases emails. |

### API surface
Exposed through an **auto-resolver** (`@ptc-org/nestjs-query`) — read enabled, create enabled (validated by `CreateAppTokenInput`), update enabled, delete disabled (one & many). A `BeforeCreateOneAppToken` hook runs pre-create. `AppTokenService` is a thin `TypeOrmQueryService` (logic lives in the consuming token services).

### Key services & behaviors
The behavior lives in `auth/token/services/*` which read/write this table:
- **Login / access / refresh**: `login-token`, `access-token` (signs ES256/HS256 JWT with `{userId, workspaceId, type:ACCESS, authProvider, workspaceMemberId, impersonator/impersonated ids}`, `expiresIn` from config), `refresh-token` (verify+rotate, stored as AppToken), `renew-token` (refresh→new pair).
- **Transient / workspace-agnostic**: cross-domain & workspace-picker tokens.
- **Email verification**, **application token** (OAuth app access/refresh pair, PKCE validation, renew).

### Background jobs
None.

---

## approved-access-domain

**Purpose:** Domain allow-listing for a workspace — users with an email on a validated domain can auto-join (used together with public invite policy & SSO). Domains require email-verified validation.

### Data model
| Entity (`core.approvedAccessDomain`) | Field : type | Notes |
|---|---|---|
| `ApprovedAccessDomainEntity` | `id:uuid`, `domain:varchar`, `isValidated:boolean`, `createdAt`, `updatedAt` (workspace-related). | |

### API surface — GraphQL (`ApprovedAccessDomainResolver`)
`getApprovedAccessDomains` (Query); `createApprovedAccessDomain`, `validateApprovedAccessDomain`, `deleteApprovedAccessDomain` (Mutation).

### Key services & behaviors
- **`ApprovedAccessDomainService`** — `createApprovedAccessDomain`, `sendApprovedAccessDomainValidationEmail` (mints a validation token, emails the domain owner), `mintValidationToken` / `verifyValidationTokenOrThrow`, `validateApprovedAccessDomain` (flip `isValidated`), `delete`, and `findValidatedApprovedAccessDomainWithWorkspacesAndSSOIdentityProviders` (cross-join used during sign-in to map an email domain to joinable workspaces/IdPs). `approved-access-domain.validate` enforces domain format. Dedicated exception filter.

### Background jobs
None.

---

## secret-encryption

**Purpose:** Envelope encryption for secrets at rest (API/SSO/2FA/signing-key secrets, session cookie secrets). Provides versioned AES-GCM v2 (with legacy AES-CTR read support) and branded string types so encrypted vs plaintext can't be mixed up at the type level.

### Data model
No DB entity. Defines **branded types** `EncryptedString` and `PlaintextString` plus an envelope format.

### Key behaviors
- **`SecretEncryptionService`** — `encrypt`/`decrypt` (legacy CTR path), `encryptVersioned`/`decryptVersioned` (GCM v2 envelope `enc:v2:<keyId>:<iv>:<tag>:<ciphertext>`), `decryptAndMask` / `decryptAndMaskVersioned` (return masked previews for UI).
- **Key derivation**: `derive-gcm-key` (HKDF, info prefix `twenty:enc:v2:`, per-instance context), `derive-instance-hmac-key` (`twenty:hmac:v1:`), `compute-encryption-key-id` (8-hex-char id), `resolve-encryption-keys-or-throw` / `pick-encryption-key-by-key-id` (supports key rotation — multiple keys resolvable by id), `resolve-session-cookie-secrets` (feeds `session-storage`).
- Constants: GCM IV 12 bytes, tag 16 bytes, derived key 32 bytes. Envelopes are parsed/validated strictly and throw on tampering.

### Background jobs
None.

---

## session-storage

**Purpose:** Express-session configuration factory backed by Redis — used for the stateful pieces of OAuth/SSO flows (e.g. SAML relay state).

### Data model
None (config only).

### Key behaviors
- **`getSessionStorageOptions`** — builds `express-session` options: secret(s) from `secret-encryption` (`resolveSessionCookieSecretsOrThrow`), `httpOnly`, `sameSite=lax`, `secure` when `SERVER_URL` is https, 30-min cookie. Store is a `connect-redis` `RedisStore` (key prefix `engine:session:`) over a `redis` client (requires `REDIS_URL`, 60s ping). Memory store is intentionally disabled for production.

### Background jobs
None.

---

## impersonation

**Purpose:** Admin/support impersonation — generate a login token to act as another user inside a workspace that allows it. Audited.

### Data model
None of its own (operates on users/workspaces; emits an impersonation login token via `app-token`/`access-token`).

### API surface — GraphQL (`ImpersonationResolver`)
`impersonate` (Mutation) → `ImpersonateDTO` (workspace + login token / redirect info).

### Key services & behaviors
- **`ImpersonationService.impersonate`** — checks the impersonator `canImpersonate`, the target workspace `allowImpersonation` flag, resolves the target user-workspace, then `generateImpersonationLoginToken` carrying impersonator/impersonated `userWorkspaceId`s (these propagate into the access-token payload). Validation & audit logging happen in `AuthService.validateAndLogImpersonation`.

### Background jobs
None.

---

## captcha

**Purpose:** Pluggable CAPTCHA verification (Google reCAPTCHA or Cloudflare Turnstile) guarding sensitive auth mutations (credentials login, sign-up, reset).

### Data model
None. Defines `CaptchaDriverType` enum (GOOGLE_RECAPTCHA / TURNSTILE) + `CaptchaValidateResult {success, error?}`.

### API surface
No resolver/controller; exposes a **`CaptchaGuard`** (`canActivate`) applied to GraphQL mutations that pulls the token from args and calls the service.

### Key services & behaviors
- **`CaptchaService.validate(token)`** delegates to a driver chosen by `CaptchaDriverFactory`. Drivers `GoogleRecaptchaDriver` and `TurnstileDriver` both implement `CaptchaDriver.validate` by POSTing to the provider's siteverify endpoint with `secretKey`. GraphQL exception filter maps failures.

### Background jobs
None.

---

## user

**Purpose:** The global (cross-workspace) user account — identity, email/password, locale, admin flags, onboarding status, workspace memberships, and workspace-member projection helpers.

### Data model
| Entity (`core.user`) | Field : type | Notes |
|---|---|---|
| `UserEntity` | `id:uuid`, `firstName`, `lastName`, `email` (lower-cased via hook; partial-unique where `deletedAt IS NULL`), `isEmailVerified:bool`, `disabled:bool`, `passwordHash?`, `canImpersonate:bool`, `canAccessFullAdminPanel:bool`, `locale`, `createdAt/updatedAt/deletedAt`, relations: `appTokens`, `keyValuePairs`, `userWorkspaces`, computed `workspaceMember`, `currentWorkspace?`, `currentUserWorkspace?`, `onboardingStatus`. | `WorkspaceMember` is a workspace-DB object, hydrated lazily, not a column. |

### API surface — GraphQL (`UserResolver`)
| Op | Kind | Purpose |
|---|---|---|
| `currentUser` | Query | The signed-in user with derived perms/workspace. |
| `deleteUser` | Mutation | Self-delete account. |
| `deleteUserFromWorkspace` | Mutation | Remove self from a workspace (may delete workspace if last). |
| `updateWorkspaceMemberSettings` | Mutation | Update editable profile fields (validated against workspace's editable-field allow-list). |
| `updateUserEmail` | Mutation | Change email (enqueues workspace-member email sync job). |
| ResolveFields | — | `userVars`, `workspaceMember`, `workspaceMembers`, `deletedWorkspaceMembers`, `onboardingStatus`, `currentWorkspace`, `workspaces`, `availableWorkspaces`, plus avatar/sso flags. |

### Key services & behaviors
- **`UserService`** — load workspace member(s) (single, by ids, deleted-only), `loadSignedAvatarUrlsByUserId`, `hasUserAccessToWorkspaceOrThrow`, find-by-email/id (with workspaces), `markEmailAsVerified`, `updateEmailFromVerificationToken`/`updateUserEmail`, `enqueueWorkspaceMemberEmailUpdate`, and cascading delete (`deleteUserWorkspaceAndPotentiallyDeleteUser`, `removeUserFromWorkspaceAndPotentiallyDeleteWorkspace`).
- **`UserVarsService`** — typed per-user/per-workspace key-value vars on top of `KeyValuePairService` (`get`, `getAll`, `set`, `delete`, with merge util).
- **Flat caches**: `user-entity-cache-provider`, `workspace-flat-workspace-member-map-cache`, `workspace-member-transpiler` (maps the core `UserWorkspace` into the workspace-schema `WorkspaceMember` record). `GlobalWorkspaceMemberListener` keeps projections in sync.

### Background jobs
- **`update-workspace-member-email.job`** — async propagation of an email change into the per-workspace `workspaceMember` record(s).

---

## user-workspace

**Purpose:** The join entity binding a `User` to a `Workspace` (the per-workspace membership), carrying locale, avatar, RBAC permission projections, and 2FA methods. This is the unit RBAC and 2FA attach to.

### Data model
| Entity (`core.userWorkspace`) | Field : type | Notes |
|---|---|---|
| `UserWorkspaceEntity` | `id:uuid`, `userId`, `user` rel, `workspaceId`, `defaultAvatarUrl?`, `locale`, `createdAt/updatedAt/deletedAt?`, `twoFactorAuthenticationMethods` rel, computed `permissionFlags?`, `objectPermissions?`/`objectsPermissions?`, `twoFactorAuthenticationMethodSummary?`. | Permission fields are hydrated at resolve-time from RBAC, not stored here. |

### API surface
No standalone resolver; exposed as a GraphQL type via `user`/`workspace` resolvers and the upload-profile-picture permission guard.

### Key services & behaviors
- **`UserWorkspaceService`** — `create` / `createWorkspaceMember`, `addUserToWorkspaceIfUserNotInWorkspace` (idempotent join), `resolveRoleIdForNewMember` (default role assignment), `getUserCount` / `countUserWorkspaces` / `getActiveUserWorkspaceCountTotal` (billing/seat counts), existence checks (by id / by email), `findFirstWorkspaceByUserId`, **`findAvailableWorkspacesByEmail`** + `castWorkspaceToAvailableWorkspace` + `setLoginTokenToAvailableWorkspacesWhenAuthProviderMatch` (powers the multi-workspace login picker), `getUserWorkspaceForUserOrThrow`, `getWorkspaceMemberOrThrow`, locale update, avatar URL computation, and `deleteUserWorkspace`.
- `upload-profile-picture-permission.guard` authorizes avatar uploads; flat cache provider speeds membership lookups.

### Background jobs
None.

---

## workspace

**Purpose:** The tenant aggregate — branding, sub-domain/custom-domain routing, auth-provider toggles, activation lifecycle, AI model defaults, retention policies, RBAC default role, and a large set of resolve-fields pulling in billing/views/applications. Also the heaviest service (provisioning + deletion).

### Data model (selected — `core.workspace`)
| Field : type | Purpose |
|---|---|
| `id:uuid`, `displayName?`, `logo?`, `logoFileId?`, `inviteHash?`, `subdomain` (unique), `customDomain?` (unique) | identity & routing |
| `activationStatus:enum(WorkspaceActivationStatus)`, `suspendedAt?`, `deletedAt?` | lifecycle |
| `allowImpersonation`, `isPublicInviteLinkEnabled` | policy |
| `isGoogleAuthEnabled/Bypass`, `isMicrosoftAuthEnabled/Bypass`, `isPasswordAuthEnabled/Bypass`, `isTwoFactorAuthenticationEnforced`, `isCustomDomainEnabled` | auth toggles |
| `trashRetentionDays(14)`, `eventLogRetentionDays(90)` | retention |
| `metadataVersion`, `databaseSchema?` | per-tenant metadata/schema |
| `defaultRoleId?`/`defaultRole`, `editableProfileFields?` | RBAC / profile policy |
| `fastModel`, `smartModel`, `enabledAiModelIds[]`, `useRecommendedModels`, `aiAdditionalInstructions?` | AI config |
| `workspaceCustomApplicationId`, `isInternalMessagesImportEnabled` | apps / messaging |
| relations | `appTokens`, `keyValuePairs`, `workspaceUsers`, `featureFlags`, `approvedAccessDomains`, `emailingDomains`, `publicDomains`, `workspaceSSOIdentityProviders`, `agents`, `webhooks`, `apiKeys`, `views/viewFields/...` |

### API surface — GraphQL (`WorkspaceResolver`)
| Op | Kind | Purpose |
|---|---|---|
| `currentWorkspace` | Query | Current tenant. |
| `getPublicWorkspaceDataByDomain` / `getPublicWorkspaceDataById` | Query | Pre-auth public branding + enabled auth-providers for a domain (drives the login page). |
| `activateWorkspace` | Mutation | Move from pending → active (prefill records, init state). |
| `updateWorkspace` | Mutation | Update settings (permission-checked per field). |
| `deleteCurrentWorkspace` | Mutation | Tenant deletion. |
| `checkCustomDomainValidRecords` | Mutation | Validate DNS records for a custom domain. |
| ResolveFields | — | `featureFlags`, `billingSubscriptions`/`currentBillingSubscription`/`billingEntitlements`, `defaultRole`, AI models, `installedApplications`/`workspaceCustomApplication`, `workspaceMembersCount`, `logo`, `workspaceUrls`, several boolean policy flags, `views`. |

### Key services & behaviors
- **`WorkspaceService`** — `updateWorkspaceById` (with `validateWorkspaceUpdatePermissions`), `activateWorkspace` → `activateAndInitializeUpgradeState` + `prefillCreatedWorkspaceRecords`, `suspendWorkspace`, **`deleteWorkspace`** (cascade: chunked field-metadata + syncable-metadata deletion, soft/hard), `handleRemoveWorkspaceMember`, `findOneWorkspaceById`.
- **`WorkspaceGaugeService`** — metrics/observability gauges per workspace.
- Utils: `get-auth-providers-by-workspace` / `get-auth-bypass-providers-by-workspace` (compute the enabled provider set from the toggle columns — consumed by the public login data and SSO bypass logic), flat-entity mapping, cache provider.

### Background jobs / crons
- **`check-custom-domain-valid-records.cron`** (pattern `0 * * * *`, hourly) — re-validate DNS for custom domains.
- **`handle-workspace-member-deleted.job`** — react to member deletions (cleanup).

---

## workspace-invitation

**Purpose:** Team invitations by email — create/send/resend/delete invitation tokens (stored as `AppToken` of type INVITATION_TOKEN), with throttling and email delivery.

### Data model
No own entity — uses `AppTokenEntity (type=INVITATION_TOKEN, context.email/roleId)`; `cast-app-token-to-workspace-invitation.util` projects it to the `WorkspaceInvitation` DTO.

### API surface — GraphQL (`WorkspaceInvitationResolver`)
`findWorkspaceInvitations` (Query); `sendInvitations`, `resendWorkspaceInvitation`, `deleteWorkspaceInvitation` (Mutation).

### Key services & behaviors
- **`WorkspaceInvitationService`** — `generateInvitationToken`, `createWorkspaceInvitation`, **`sendInvitations`** (batch, emails each invitee, throttled via `throttleInvitationSending`), `resendWorkspaceInvitation`, `deleteWorkspaceInvitation` / `invalidateWorkspaceInvitation`, `getAppTokenByInvitationToken`, `findInvitationsByEmail`, `getOneWorkspaceInvitation`, `loadWorkspaceInvitations`, and **`validatePersonalInvitation`** (consumed by the sign-in-up pipeline to bind an invited email to a workspace + role).

### Background jobs
None (sends emails inline, with throttle).

---

## onboarding

**Purpose:** Compute and advance the user's onboarding state machine across workspace activation, profile creation, email sync, team invite, and booking steps.

### Data model
No entity — state derived from user/workspace + key-value pairs. `OnboardingStatus` enum: `PLAN_REQUIRED → WORKSPACE_ACTIVATION → PROFILE_CREATION → SYNC_EMAIL → INVITE_TEAM → BOOK_ONBOARDING → COMPLETED`.

### API surface — GraphQL (`OnboardingResolver`)
`skipSyncEmailOnboardingStep`, `skipBookOnboardingStep` (Mutation, each → `OnboardingStepSuccessDTO`).

### Key services & behaviors
- **`OnboardingService`** — `getOnboardingStatus` (evaluates which step the user is on, factoring plan/activation/profile/connected-accounts/team/booking), and step "pending" setters: `setOnboardingConnectAccountPending`, `setOnboardingInviteTeamPending`, `setOnboardingCreateProfilePending`, `completeOnboardingProfileStepIfNameProvided`, `setOnboardingBookOnboardingPending`. State is persisted as user/workspace key-value vars.

### Background jobs
None.

---

## guard-redirect

**Purpose:** Shared helper for auth guards to redirect the browser (with captured error context) back to the correct sub-domain / custom-domain front-end on auth failure during OAuth/SSO redirect flows.

### Data model
None.

### Key services & behaviors
- **`GuardRedirectService`** — `getSubdomainAndCustomDomainFromContext` (derive the originating tenant URL from the request), `dispatchErrorFromGuard` / `getRedirectErrorUrlAndCaptureExceptions` (build a front-end redirect URL carrying an error code and report the exception to monitoring). Used by Google/Microsoft/OIDC/SAML guards so failures land on a friendly page instead of a raw 500.

### Background jobs
None.

---

## Parity notes

Effort tags reflect building an equivalent on a **Mongo + Rust + Next.js** stack (vs Twenty's Postgres + NestJS + Passport + GraphQL).

| Capability | Tag | 1-line note |
|---|---|---|
| `api-key` (metadata CRUD + JWT mint) | **SIMPLE-CRUD** | Mongo collection + JWT signer; only the per-workspace active-key cache adds a little plumbing. |
| `app-token` (polymorphic token store) | **SIMPLE-CRUD** | One Mongo collection with `type` + TTL index; replace the auto-resolver with explicit handlers. |
| `approved-access-domain` | **SIMPLE-CRUD** | Collection + a validation-token email flow (reuse the generic token store). |
| `onboarding` | **SIMPLE-CRUD** | Pure derived state machine over user/workspace flags + KV vars; no storage of its own. |
| `workspace-invitation` | **MEDIUM** | CRUD is trivial, but email delivery, throttling, and binding invited email→role into sign-up need care. |
| `user` / `user-workspace` | **MEDIUM** | Identity + membership are simple in Mongo, but the workspace-member projection, available-workspaces picker, and cascading deletes (delete-workspace-if-last) are fiddly. |
| `captcha` | **MEDIUM** | Pluggable driver + provider HTTP calls are easy; wiring it as a guard around the right mutations is the work. |
| `session-storage` | **MEDIUM** | Redis-backed session store is off-the-shelf, but you only need it if you keep stateful OAuth/SAML relay flows. |
| `guard-redirect` | **MEDIUM** | Logic is small; correctly reconstructing the tenant front-end URL across subdomain/custom-domain is the tricky part. |
| `two-factor-authentication` (TOTP) | **MEDIUM** | A TOTP crate + encrypted-secret storage + enforced-2FA gate in the login pipeline; well-trodden but security-sensitive. |
| `impersonation` | **MEDIUM** | Mostly token-issuance + policy checks + audit; depends on a working access-token payload carrying impersonator/impersonated ids. |
| `secret-encryption` (AES-GCM envelope + HKDF + key rotation) | **RUNTIME-HEAVY** | Must reimplement the exact envelope format, key-id derivation, and multi-key resolution so encrypted data stays portable; crypto correctness is unforgiving. |
| `jwt` (asymmetric signing-key manager + rotation cron) | **RUNTIME-HEAVY** | Needs ES256 keypair lifecycle, encrypted-at-rest private keys, kid-based verification, verify-counters, and a daily rotation job — a real key-management subsystem. |
| `sso` (OIDC discovery + SAML assertions) | **RUNTIME-HEAVY** | OIDC client/discovery + SAML metadata/assertion/x509 handling, per-workspace, with Passport-equivalent strategies; large surface, Enterprise-gated. |
| `workspace` (tenant lifecycle) | **RUNTIME-HEAVY** | Activation/prefill, cascade-deleting per-tenant metadata in chunks, custom-domain DNS validation cron, auth-provider matrix, and many resolve-field integrations (billing/views/apps). |
| `auth` (full pipeline + controllers + strategies + middleware) | **RUNTIME-HEAVY** | The keystone: unified sign-in-up, multi-provider OAuth/OIDC/SAML controllers, login/transient/access/refresh token choreography, captcha+2FA+impersonation+invitation interlocks, and request-scoped auth-context. Biggest single porting effort in the cluster. |
