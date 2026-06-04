# Application Core Module - Function Documentation

Comprehensive documentation of all exported functions, services, resolvers, and command handlers in the `engine/core-modules/application` area.

## Main Application Service

### application.service.ts
`file:src/engine/core-modules/application/application.service.ts`

**Service: ApplicationService** — Injectable NestJS service managing application lifecycle, CRUD operations, and workspace setup.

- **findApplicationRoleId(applicationId: string, workspaceId: string) → Promise<string>** (line 54)
  Retrieves the default role ID for an application; throws if application or role not found.

- **findWorkspaceTwentyStandardAndCustomApplicationOrThrow({workspace?, workspaceId?}) → Promise<{twentyStandardFlatApplication, workspaceCustomFlatApplication}>** (line 72)
  Fetches both the Twenty standard and workspace custom applications from cache, validating both exist. Requires either workspace object or workspaceId.

- **findManyApplications(workspaceId: string) → Promise<ApplicationEntity[]>** (line 139)
  Returns all applications for a workspace with their application registrations.

- **findManyInstalledFlatApplications(workspaceId: string) → Promise<FlatApplication[]>** (line 148)
  Returns all non-deleted applications from cache as flattened DTOs (excludes relations).

- **findOneApplication({id?, universalIdentifier?, workspaceId}) → Promise<ApplicationEntity | null>** (line 162)
  Finds application by id or universalIdentifier; loads related logic functions, agents, front components, command menu items, objects, and variables. Returns null if not found.

- **findOneApplicationOrThrow({id?, universalIdentifier?, workspaceId}) → Promise<ApplicationEntity>** (line 230)
  Same as findOneApplication but throws ApplicationException if not found.

- **findById(id: string) → Promise<ApplicationEntity | null>** (line 255)
  Simple lookup by application id; returns null if not found.

- **findByUniversalIdentifier({universalIdentifier, workspaceId}) → Promise<ApplicationEntity | null>** (line 261)
  Finds application by universalIdentifier within a workspace.

- **findTwentyStandardApplicationOrThrow(workspaceId: string) → Promise<{application, workspace}>** (line 276)
  Fetches the Twenty standard application and its workspace; throws if not found.

- **createTwentyStandardApplication({workspaceId, skipCacheInvalidation?}, queryRunner?) → Promise<ApplicationEntity>** (line 313)
  Creates the Twenty standard application with default package.json and yarn.lock files; optionally skips cache invalidation for batch ops.

- **createWorkspaceCustomApplication({workspaceId, applicationId}, queryRunner?) → Promise<ApplicationEntity>** (line 354)
  Creates a workspace-scoped custom application for custom extensions and business logic.

- **uploadDefaultPackageFilesAndSetFileIds(application, queryRunner?) → Promise<void>** (line 394)
  Writes default package.json and yarn.lock to file storage and updates application record with file IDs and checksums.

- **create(data: Partial<ApplicationEntity> & {workspaceId}, queryRunner?) → Promise<ApplicationEntity>** (line 458)
  Creates a new application; invalidates flatApplicationMaps cache unless using queryRunner.

- **update(id: string, data & {workspaceId}) → Promise<ApplicationEntity>** (line 477)
  Updates application and invalidates cache; throws if application not found after update.

- **delete(universalIdentifier: string, workspaceId: string) → Promise<void>** (line 501)
  Soft-deletes application, removes associated files, and invalidates flat entity caches.

## Application Entity

### application.entity.ts
`file:src/engine/core-modules/application/application.entity.ts`

**Entity: ApplicationEntity** — TypeORM entity representing an installed application within a workspace.

Key fields: id, universalIdentifier, name, version, sourceType, sourcePath, logo, packageJsonChecksum, yarnLockChecksum, availablePackages, defaultRoleId, canBeUninstalled, isSdkLayerStale, applicationRegistrationId, logicFunctionLayerId, settingsCustomTabFrontComponentId.

Relations: packageJsonFile, yarnLockFile, applicationRegistration, agents, logicFunctions, objects, frontComponents, commandMenuItems, applicationVariables.

## Exception Handling

### application.exception.ts
`file:src/engine/core-modules/application/application.exception.ts`

**Exception: ApplicationException** — Custom exception with codes like APPLICATION_NOT_FOUND, INVALID_INPUT, FORBIDDEN, APP_NOT_INSTALLED, UPGRADE_FAILED, etc.

- **getApplicationExceptionUserFriendlyMessage(code: ApplicationExceptionCode) → MessageDescriptor** (line 30)
  Maps error codes to human-readable Lingui messages for client display.

### application-exception-filter.ts
`file:src/engine/core-modules/application/application-exception-filter.ts`

**Filter: ApplicationExceptionFilter** — NestJS ExceptionFilter that catches ApplicationException and converts to GraphQL errors (NotFoundError, ForbiddenError, UserInputError, InternalServerError).

- **catch(exception: ApplicationException) → void** (line 18)
  Routes exceptions by code to appropriate GraphQL error type.

## Workspace Cache Services

### workspace-flat-application-map-cache.service.ts
`file:src/engine/core-modules/application/workspace-flat-application-map-cache.service.ts`

**Service: WorkspaceFlatApplicationMapCacheService** — Extends WorkspaceCacheProvider; caches flattened application maps indexed by id and universalIdentifier.

- **computeForCache(workspaceId: string) → Promise<FlatApplicationCacheMaps>** (line 23)
  Fetches all applications (including soft-deleted), converts to flat DTOs, and builds maps for fast lookup.

## Application Registration Module

### application-registration.service.ts
`file:src/engine/core-modules/application/application-registration/application-registration.service.ts`

**Service: ApplicationRegistrationService** — Manages application registrations (OAuth clients, catalogs, and marketplace apps).

- **findMany(ownerWorkspaceId: string) → Promise<ApplicationRegistrationEntity[]>** (line 44)
  Returns registrations owned by a workspace, ordered by creation date descending.

- **findAll() → Promise<ApplicationRegistrationEntity[]>** (line 53)
  Returns all registrations globally (no workspace filtering).

- **findOneById(id: string, ownerWorkspaceId: string) → Promise<ApplicationRegistrationEntity>** (line 59)
  Finds registration by id within a workspace; throws if not found.

- **findOneByIdGlobal(id: string) → Promise<ApplicationRegistrationEntity>** (line 77)
  Global lookup by id (no workspace scoping); throws if not found.

- **findOneByClientId(clientId: string) → Promise<ApplicationRegistrationEntity | null>** (line 93)
  OAuth flow: finds registration by oAuthClientId globally; used by token exchange.

- **findPublicByClientId(clientId: string) → Promise<PublicApplicationRegistrationDTO | null>** (line 102)
  Returns minimal public info (name, logo, scopes) for OAuth authorize page.

- **findOneByUniversalIdentifier(universalIdentifier: string) → Promise<ApplicationRegistrationEntity | null>** (line 123)
  Global lookup by universalIdentifier; returns null if not found.

- **create(input, ownerWorkspaceId: string, createdByUserId?) → Promise<{applicationRegistration, clientSecret}>** (line 131)
  Creates new registration with generated clientId and clientSecret; validates redirect URIs and scopes; throws if universalIdentifier already claimed.

- **update(input, ownerWorkspaceId: string) → Promise<ApplicationRegistrationEntity>** (line 182)
  Updates registration metadata (name, redirectUris, scopes, isListed); validates before updating.

- **updateFromManifest({applicationRegistrationId, manifest, sourceType?}) → Promise<void>** (line 214)
  Updates registration from manifest (name, manifest object, optional sourceType).

- **delete(id: string, ownerWorkspaceId: string) → Promise<boolean>** (line 235)
  Soft-deletes registration; returns true on success.

- **rotateClientSecret(id: string, ownerWorkspaceId: string) → Promise<string>** (line 242)
  Generates and stores new client secret hash; returns plaintext secret once.

- **verifyClientSecret(registration, clientSecret: string) → Promise<boolean>** (line 258)
  Compares plaintext secret against stored bcrypt hash; returns true if match.

- **upsertFromCatalog(params) → Promise<void>** (line 269)
  Upserts registration from marketplace catalog (npm, tarball, etc.); marks as featured if in curated list; syncs variable schemas.

- **createCliRegistrationIfNotExists() → Promise<ApplicationRegistrationEntity | null>** (line 339)
  Creates Twenty CLI registration if it doesn't exist; returns null if already present.

- **findManyListed() → Promise<ApplicationRegistrationEntity[]>** (line 364)
  Returns all listed npm applications (marketplace browse).

- **getStats(applicationRegistrationId: string, ownerWorkspaceId: string) → Promise<ApplicationRegistrationStatsDTO>** (line 373)
  Aggregates active installs by version distribution and returns mostInstalledVersion.

- **transferOwnership(params) → Promise<ApplicationRegistrationEntity>** (line 407)
  Transfers registration ownership to another workspace by subdomain; throws if target not found or same workspace.

- **generateClientSecret() → Promise<{clientSecret, clientSecretHash}>** (line 444)
  Generates 32-byte random secret and bcrypt hash (10 rounds).

- **validateRedirectUris(uris: string[]) → void** (line 457)
  Validates each URI and throws ApplicationRegistrationException if invalid.

- **validateScopes(scopes: string[]) → void** (line 470)
  Checks scopes against ALL_OAUTH_SCOPES constant; throws on invalid scopes.

### application-registration.resolver.ts
`file:src/engine/core-modules/application/application-registration/application-registration.resolver.ts`

**Resolver: ApplicationRegistrationResolver** — GraphQL resolver for registration CRUD and OAuth management.

- **findApplicationRegistrationByClientId(clientId) → Query<PublicApplicationRegistrationDTO | null>** (line 74)
  Public endpoint (no auth) returning logo, website, and scopes for OAuth authorize page.

- **findApplicationRegistrationByUniversalIdentifier(universalIdentifier) → Query<ApplicationRegistrationEntity | null>** (line 83)
  Workspace-scoped lookup by universalIdentifier.

- **findManyApplicationRegistrations() → Query<ApplicationRegistrationEntity[]>** (line 96)
  Returns all registrations owned by authenticated workspace.

- **findOneApplicationRegistration(id) → Query<ApplicationRegistrationEntity>** (line 107)
  Returns specific registration; requires marketplace-apps permission.

- **findApplicationRegistrationStats(id) → Query<ApplicationRegistrationStatsDTO>** (line 119)
  Returns version distribution and active installs stats.

- **createApplicationRegistration(input) → Mutation<CreateApplicationRegistrationDTO>** (line 131)
  Creates new registration returning clientSecret; requires api-keys-and-webhooks permission.

- **updateApplicationRegistration(input) → Mutation<ApplicationRegistrationEntity>** (line 148)
  Updates registration metadata.

- **deleteApplicationRegistration(id) → Mutation<Boolean>** (line 160)
  Soft-deletes registration; returns true.

- **rotateApplicationRegistrationClientSecret(id) → Mutation<RotateClientSecretDTO>** (line 172)
  Rotates secret and returns new plaintext secret.

- **findApplicationRegistrationVariables(applicationRegistrationId) → Query<ApplicationRegistrationVariableDTO[]>** (line 190)
  Returns variables with obfuscated values (secrets masked).

- **createApplicationRegistrationVariable(input) → Mutation<ApplicationRegistrationVariableEntity>** (line 205)
  Creates variable (encrypted storage).

- **updateApplicationRegistrationVariable(input) → Mutation<ApplicationRegistrationVariableEntity>** (line 220)
  Updates variable value/description.

- **deleteApplicationRegistrationVariable(id) → Mutation<Boolean>** (line 235)
  Deletes variable; returns true.

- **uploadAppTarball({file, universalIdentifier?}) → Mutation<ApplicationRegistrationEntity>** (line 250)
  Handles file upload; extracts, validates manifest, stores tarball; requires marketplace-apps permission.

- **applicationRegistrationTarballUrl(id) → Query<String | null>** (line 290)
  Returns signed URL for tarball download if sourceType is TARBALL.

- **transferApplicationRegistrationOwnership(params) → Mutation<ApplicationRegistrationEntity>** (line 318)
  Transfers ownership to another workspace by subdomain.

- **isConfigured(registration) → ResolveField<Boolean>** (line 334)
  Uses dataloader to batch-check if required variables are filled.

### application-tarball.service.ts
`file:src/engine/core-modules/application/application-registration/application-tarball.service.ts`

**Service: ApplicationTarballService** — Handles tarball upload, extraction, validation, and storage.

- **uploadTarball({tarballBuffer, universalIdentifier?, ownerWorkspaceId}) → Promise<ApplicationRegistrationEntity>** (line 57)
  Extracts tarball, reads manifest and package.json, validates server version compatibility, stores file, creates/updates registration, syncs variable schemas. Cleans up temp dir on success/failure.

## Application Upgrade

### application-upgrade.service.ts
`file:src/engine/core-modules/application/application-upgrade/application-upgrade.service.ts`

**Service: ApplicationUpgradeService** — Manages version upgrades and update checks for npm-sourced applications.

- **checkForUpdates(appRegistration) → Promise<string | null>** (line 35)
  Queries npm registry for latest version; updates registration if found; returns new version or null on failure.

- **checkAllForUpdates() → Promise<void>** (line 83)
  Checks all npm registrations for updates (used by periodic job).

- **upgradeApplication({appRegistrationId, targetVersion, workspaceId}) → Promise<boolean>** (line 93)
  Upgrades app to targetVersion; throws if LOCAL, TARBALL, or OAUTH_ONLY sourceType; delegates to installApplication.

### application-upgrade.resolver.ts
`file:src/engine/core-modules/application/application-upgrade/application-upgrade.resolver.ts`

**Resolver: ApplicationUpgradeResolver** — GraphQL endpoint for application upgrades.

- **upgradeApplication(appRegistrationId, targetVersion) → Mutation<Boolean>** (line 25)
  Calls service to upgrade application; requires marketplace-apps permission.

## Application Installation

### application-install.service.ts
`file:src/engine/core-modules/application/application-install/application-install.service.ts`

**Service: ApplicationInstallService** — Core install logic: fetches package, validates versions, runs hooks, syncs manifests, generates SDK.

- **installApplication({appRegistrationId, version?, workspaceId}) → Promise<boolean>** (line 70)
  Entry point; skips LOCAL/OAUTH_ONLY sources; acquires cache lock for serial install per app per workspace.

- **doInstallApplication(appRegistration, {version?, workspaceId}) → Promise<boolean>** (line 120)
  Main install: resolves package, validates server version, checks version constraints, writes files, runs pre/post hooks, syncs manifest, generates SDK client.

- **runPreInstallHook(params) → Promise<void>** (line 286)
  Syncs pre-install logic function, executes it (skips if shouldRunOnVersionUpgrade is false on upgrade), throws on error.

- **runPostInstallHook(params) → Promise<void>** (line 373)
  Similar to pre-install but enqueues asynchronously unless shouldRunSynchronously is true.

- **writeFilesToStorage(extractedDir, manifest, universalIdentifier, workspaceId) → Promise<void>** (line 465)
  Validates path traversal safety, writes package.json, manifest.json, logic functions, front components, and public assets to storage.

- **buildFileList(manifest) → {relativePath, fileFolder}[]** (line 505)
  Builds list of files to write from manifest declarations (dependencies, sources, built artifacts, assets).

- **ensureApplicationExists(params) → Promise<ApplicationEntity>** (line 539)
  Returns existing app or creates new one with manifest metadata.

### application-install.resolver.ts
`file:src/engine/core-modules/application/application-install/application-install.resolver.ts`

**Resolver: ApplicationInstallResolver** — GraphQL endpoints for querying installed applications.

- **findManyApplications() → Query<ApplicationDTO[]>** (line 32)
  Returns all applications in workspace; requires applications permission.

- **findOneApplication({id?, universalIdentifier?}) → Query<ApplicationDTO>** (line 40)
  Finds specific application by id or universalIdentifier; throws if not found.

## Application Manifest Synchronization

### application-sync.service.ts
`file:src/engine/core-modules/application/application-manifest/application-sync.service.ts`

**Service: ApplicationSyncService** — Syncs manifest into workspace metadata (objects, fields, logic functions, etc.).

- **synchronizeFromManifest({workspaceId, manifest, applicationRegistrationId?}) → Promise<{workspaceMigration, hasSchemaMetadataChanged}>** (line 40)
  Syncs application entity, then full metadata from manifest; returns migration and change flag.

- **preInstallSynchronizeFromManifest({workspaceId, manifest, applicationRegistrationId?}) → Promise<void>** (line 76)
  Pared-down sync registering only the pre-install logic function before main install; no-op if not declared.

- **uninstallApplication({workspaceId, applicationUniversalIdentifier}) → Promise<WorkspaceMigration>** (line 161)
  Generates migration to remove all application-owned entities; throws if app cannot be uninstalled.

### application-manifest.resolver.ts
`file:src/engine/core-modules/application/application-manifest/application-manifest.resolver.ts`

**Resolver: ApplicationManifestResolver** — GraphQL endpoints for manifest operations (install, uninstall, migrations).

- **runWorkspaceMigration({workspaceMigration: {actions}}) → Mutation<Boolean>** (line 40)
  Executes workspace migration actions for custom application context.

- **uninstallApplication({universalIdentifier}) → Mutation<Boolean>** (line 65)
  Uninstalls application by universal identifier.

## Application Variables

### application-variable.service.ts
`file:src/engine/core-modules/application/application-variable/application-variable.service.ts`

**Service: ApplicationVariableEntityService** — Manages encrypted application variables (environment-like secrets).

- **getDisplayValue(applicationVariable) → String** (line 26)
  Returns decrypted value (masked if secret); returns empty string if value is empty.

- **update({key, plainTextValue, applicationId, workspaceId}) → Promise<void>** (line 45)
  Encrypts and updates application variable; invalidates cache; throws if variable not found.

### application-variable.resolver.ts
`file:src/engine/core-modules/application/application-variable/application-variable.resolver.ts`

**Resolver: ApplicationVariableEntityResolver** — GraphQL resolver for variable access and updates.

- **value(applicationVariable) → ResolveField<String>** (line 28)
  Resolves decrypted display value.

- **updateOneApplicationVariable({key, value, applicationId}) → Mutation<Boolean>** (line 34)
  Updates variable value; returns true.

### workspace-application-variable-map-cache.service.ts
`file:src/engine/core-modules/application/application-variable/workspace-application-variable-map-cache.service.ts`

**Service: WorkspaceApplicationVariableMapCacheService** — Caches application variables for fast lookup.

- **computeForCache(workspaceId) → Promise<ApplicationVariableCacheMaps>** (line 29)
  Fetches all variables for workspace, builds flat entity maps indexed by universal identifiers.

## Application Registration Variables

### application-registration-variable.service.ts
`file:src/engine/core-modules/application/application-registration-variable/application-registration-variable.service.ts`

**Service: ApplicationRegistrationVariableService** — Manages encrypted variables bound to application registrations (OAuth credentials, API keys).

- **findVariablesWithObfuscatedValues(applicationRegistrationId, workspaceId) → Promise<ApplicationRegistrationVariableDTO[]>** (line 29)
  Returns variables for registration owned by workspace; secrets masked.

- **findVariablesWithObfuscatedValuesGlobal(applicationRegistrationId) → Promise<ApplicationRegistrationVariableDTO[]>** (line 43)
  Same without workspace ownership check.

- **createVariable(input, workspaceId) → Promise<ApplicationRegistrationVariableEntity>** (line 54)
  Creates encrypted variable for registration owned by workspace.

- **updateVariable(input, workspaceId) → Promise<ApplicationRegistrationVariableEntity>** (line 76)
  Updates variable within workspace scope.

- **updateVariableGlobal(input) → Promise<ApplicationRegistrationVariableDTO>** (line 90)
  Updates variable without workspace ownership check; returns obfuscated DTO.

- **deleteVariable(id, workspaceId) → Promise<boolean>** (line 100)
  Deletes variable within workspace scope; returns true.

- **syncVariableSchemas(applicationRegistrationId, serverVariables) → Promise<void>** (line 114)
  Syncs manifest-declared variable schema: creates missing, updates metadata, removes stale variables.

- **isConfiguredBatch(applicationRegistrationIds) → Promise<Map<string, boolean>>** (line 161)
  Batch-checks if required variables are filled for each registration.

- **findVariableOrThrow(id) → Promise<ApplicationRegistrationVariableEntity>** (line 201)
  Throws if variable not found.

- **applyVariableUpdate(input) → Promise<ApplicationRegistrationVariableEntity>** (line 218)
  Internal: applies value update (or reset), description update.

- **toObfuscatedDTO(variable) → ApplicationRegistrationVariableDTO** (line 246)
  Converts entity to DTO, masking secret values; shows decrypted non-secret values.

- **assertRegistrationOwnedByWorkspace(registrationId, workspaceId) → Promise<void>** (line 263)
  Throws if registration not owned by workspace.

## Application OAuth

### oauth.service.ts
`file:src/engine/core-modules/application/application-oauth/oauth.service.ts`

**Service: OAuthService** — OAuth 2.0 token exchange and application token management.

- **exchangeAuthorizationCode({authorizationCode, clientId, clientSecret?, codeVerifier?, redirectUri}) → Promise<OAuthTokenResponse | OAuthErrorResponse>** (line 43)
  RFC 6749 compliant: validates client, checks code, detects replay, validates expiry, matches redirect_uri, handles PKCE, issues tokens.

- **validateClient(clientId) → Promise<ApplicationRegistrationEntity | OAuthErrorResponse>** (line 65)
  Looks up registration by clientId; returns error if not found.

- **validateClientSecret(registration, clientSecret) → Promise<OAuthErrorResponse | null>** (line 74)
  Verifies client secret via bcrypt; returns error if mismatch or missing.

- **errorResponse(error: string, error_description?: string) → OAuthErrorResponse** (line 59)
  Returns RFC 6749 error response object.

### application-oauth.resolver.ts
`file:src/engine/core-modules/application/application-oauth/application-oauth.resolver.ts`

**Resolver: ApplicationOAuthResolver** — GraphQL endpoint for token refresh.

- **renewApplicationToken(applicationRefreshToken) → Mutation<ApplicationTokenPairDTO>** (line 29)
  Validates refresh token, checks workspace match, renews token pair.

## Connection Provider

### connection-provider.service.ts
`file:src/engine/core-modules/application/connection-provider/connection-provider.service.ts`

**Service: ConnectionProviderService** — Resolves OAuth client credentials from application registrations.

- **getClientCredentials(provider) → Promise<{clientId, clientSecret}>** (line 27)
  Fetches and decrypts OAuth credentials from registration variables; throws if not configured.

- **areClientCredentialsConfigured(provider) → Promise<boolean>** (line 74)
  Checks if OAuth credentials are filled (batch lookup).

- **areClientCredentialsConfiguredBatch(providers) → Promise<Map<string, boolean>>** (line 82)
  Batch-checks if OAuth credentials are configured for multiple providers.

## Application Development

### application-development.resolver.ts
`file:src/engine/core-modules/application/application-development/application-development.resolver.ts`

**Resolver: ApplicationDevelopmentResolver** — GraphQL endpoints for local app development (create, token generation, sync).

- **createDevelopmentApplication({universalIdentifier, name}) → Mutation<DevelopmentApplicationDTO>** (line 77)
  Creates or returns existing LOCAL application; rate-limited per app.

- **generateApplicationToken({applicationId}) → Mutation<ApplicationTokenPairDTO>** (line 114)
  Generates token pair for development; rate-limited.

- **syncApplication({manifest}) → Mutation<WorkspaceMigrationDTO>** (line 131)
  Syncs manifest from CLI into workspace; returns migration.

- **uploadApplicationFile({file, applicationId, filePath, isLogicFunction?}) → Mutation<FileDTO>** (line 150+)
  Uploads built artifact (logic function, front component, asset); rate-limited; validates path.

- **throttlePerApplication(id, workspaceId) → Promise<void>** (line 180+)
  Enforces rate limit per app (30 requests per 30s).

## Application Package Fetching

### application-package-fetcher.service.ts
`file:src/engine/core-modules/application/application-package/application-package-fetcher.service.ts`

**Service: ApplicationPackageFetcherService** — Fetches and extracts application packages from npm, tarballs, or storage.

- **resolvePackage(appRegistration, {targetVersion?}) → Promise<ResolvedPackage | null>** (line 68)
  Routes to appropriate resolver (npm, tarball, or returns null for local/oauth-only).

- **cleanupExtractedDir(extractedDir) → Promise<void>** (line 93)
  Best-effort cleanup of temp directory.

- **resolveFromNpm(packageName, targetVersion?) → Promise<ResolvedPackage>** (line 101)
  Fetches tarball from npm registry, extracts, reads manifest/package.json.

- **resolveFromTarball(appRegistration) → Promise<ResolvedPackage>** (line 150+)
  Retrieves tarball from storage, extracts, reads manifest/package.json.

## Pre-installed Apps

### pre-installed-apps.service.ts
`file:src/engine/core-modules/application/pre-installed-apps/pre-installed-apps.service.ts`

**Service: PreInstalledAppsService** — Installs marketplace pre-installed apps on new workspaces.

- **installOnWorkspace(workspaceId) → Promise<void>** (line 22)
  Installs all isPreInstalled registrations; logs but never blocks on per-app failures.

## Marketplace

### marketplace.service.ts
`file:src/engine/core-modules/application/application-marketplace/marketplace.service.ts`

**Service: MarketplaceService** — Fetches manifests, readmes, and registry search results from CDN and npm registry.

- **fetchManifestFromRegistryCdn(packageName, version) → Promise<Manifest | null>** (line 44)
  Fetches manifest.json from CDN URL; returns null on error or missing application field.

- **fetchReadmeFromRegistryCdn(packageName, version) → Promise<string | null>** (line 76)
  Fetches README.md from CDN URL; returns null if empty or error.

- **fetchAppsFromRegistry() → Promise<RegistryPackageInfo[]>** (line 109)
  Searches npm registry for "twenty-app" keyword; parses response, extracts metadata, returns package info array.

## Utility Functions

### from-application-entity-to-flat-application.util.ts
`file:src/engine/core-modules/application/utils/from-application-entity-to-flat-application.util.ts`

- **fromApplicationEntityToFlatApplication(applicationEntity) → FlatApplication** (line 7)
  Removes relation properties from entity to return flat DTO (used for caching).

### from-flat-application-to-application-dto.util.ts
`file:src/engine/core-modules/application/utils/from-flat-application-to-application-dto.util.ts`

- **fromFlatApplicationToApplicationDto(flatApplication) → ApplicationDTO** (line 4)
  Maps flat application to DTO, normalizing nulls to undefined, ensuring availablePackages defaults to {}, objects defaults to [].

## Application OAuth — Grant Handlers (oauth.service.ts continued)

`file:src/engine/core-modules/application/application-oauth/oauth.service.ts`

Additional OAuth 2.0 grant/management methods on **OAuthService** beyond `exchangeAuthorizationCode` documented above.

- **clientCredentialsGrant({clientId, clientSecret}) → Promise<OAuthTokenResponse | OAuthErrorResponse>** (line 240)
  RFC 6749 §4.4 machine-to-machine grant. Validates client + secret, requires exactly one workspace installation for the registration (errors on zero or multiple), issues an application access token (no refresh token). Returns Bearer token + expires_in + scope.

- **refreshTokenGrant({refreshToken, clientId, clientSecret?}) → Promise<OAuthTokenResponse | OAuthErrorResponse>** (line 301)
  Validates client; requires secret for confidential clients (those with `oAuthClientSecretHash`). Validates refresh token, confirms its application belongs to this registration, renews the token pair via `renewApplicationTokens`. Returns invalid_grant on any failure.

- **revokeToken({token, clientId?, clientSecret?}) → Promise<{success: boolean}>** (line 382)
  RFC 7009. Optionally validates client/secret. Tokens are stateless JWTs so revocation can't truly happen — it validates and logs the request, always returning success:true (per §2.2, 200 for valid and invalid tokens).

- **introspectToken({token, clientId, clientSecret?}) → Promise<Record<string, unknown>>** (line 428)
  RFC 7662. Validates client; tries the token as a refresh token then as an access token; verifies the decoded token's application belongs to the client. Returns `{active:true, sub, client_id, token_type, scope, aud, iss, exp, iat}` or `{active:false}`.

### oauth-token.controller.ts
`file:src/engine/core-modules/application/application-oauth/controllers/oauth-token.controller.ts`

**Controller: OAuthTokenController** (`@Controller('oauth')`, public + rate-limited at 60 req/min/IP via token bucket).

- **token(body, req, res) → Promise<OAuthTokenResponse | OAuthErrorResponse>** (line 43)
  `POST /oauth/token`. Rate-limits, then switches on `grant_type` to call exchangeAuthorizationCode / clientCredentialsGrant / refreshTokenGrant; returns unsupported_grant_type otherwise. Sets no-store cache headers; maps error responses to 401 (invalid_client) or 400.

- **revoke(body, req, res) → Promise<{}>** (line 102)
  `POST /oauth/revoke`. Rate-limits, calls revokeToken, always returns `{}` with 200 (RFC 7009 §2.2).

- **introspect(body, req, res) → Promise<Record<string, unknown>>** (line 124)
  `POST /oauth/introspect`. Rate-limits; rejects missing client_id with 401 invalid_client; delegates to introspectToken.

- **applyRateLimit(req, res) → Promise<boolean>** (line 148, private)
  Token-bucket throttle keyed by `oauth:<ip>`; on ThrottlerException responds 429 and returns true (caller short-circuits).

- **setSecurityHeaders(res) → void** (line 174, private)
  Sets `Cache-Control: no-store` and `Pragma: no-cache`.

### oauth-discovery.controller.ts
`file:src/engine/core-modules/application/application-oauth/controllers/oauth-discovery.controller.ts`

**Controller: OAuthDiscoveryController** (`@Controller('.well-known')`, public).

- **getAuthorizationServerMetadata(request) → Promise<object>** (line 24)
  `GET /.well-known/oauth-authorization-server` (RFC 8414). Returns issuer + authorize/token/register/revoke/introspect endpoints, supported scopes/grants/PKCE methods, `authorization_response_iss_parameter_supported:true` (RFC 9207 mix-up defense). Routes `/authorize` to the frontend base URL when the request host is the API-only host. Adds `cli_client_id` if the Twenty CLI registration exists.

- **getProtectedResourceMetadataRoot(request) → object** (line 75)
  `GET /.well-known/oauth-protected-resource` (RFC 9728). Resource = origin.

- **getProtectedResourceMetadataMcp(request) → object** (line 83)
  `GET /.well-known/oauth-protected-resource/mcp`. Resource = `<origin>/mcp` (path-aware variant; strict clients require the resource to match the probed path).

- **buildProtectedResourceMetadata / getRequestBaseUrl / isApiHost** (lines 89, 98, 102, private)
  Helpers building the resource metadata object, the `protocol://host` base, and detecting whether the request host equals SERVER_URL's host.

### oauth-registration.controller.ts
`file:src/engine/core-modules/application/application-oauth/controllers/oauth-registration.controller.ts`

**Controller: OAuthRegistrationController** (`@Controller('oauth')`, public, RFC 7591 Dynamic Client Registration).

- **register(body, req, res) → Promise<object>** (line 57)
  `POST /oauth/register`. Rate-limited (10/hour/IP prod, 100 dev). Validates redirect URIs (≥1, each via validateRedirectUri), grant_types (only authorization_code/refresh_token), response_types (only code), token_endpoint_auth_method. Dynamic clients are always public — secret is never issued, auth method silently downgraded to `none`. Caps scopes to ALL_OAUTH_SCOPES, generates UUID clientId + universalIdentifier, persists an OAUTH_ONLY registration with null secret/owner, returns the RFC 7591 client metadata document.

- **readRegistration(clientId, req, res) → Promise<object>** (line 184)
  `GET /oauth/register/:clientId` (RFC 7592 read-back). Looks up the OAUTH_ONLY registration; 404 if missing. No registration_access_token is issued (client_id is an unguessable UUID and all returned fields are public).

- **applyRateLimit(req) → Promise<error|null>** (line 222, private)
  Token-bucket throttle keyed by `oauth-register:<ip>`.

## Application OAuth — Stale Registration Cleanup

### stale-registration-cleanup.service.ts
`file:src/engine/core-modules/application/application-oauth/stale-registration-cleanup/services/stale-registration-cleanup.service.ts`

**Service: StaleRegistrationCleanupService** — Garbage-collects abandoned DCR (OAUTH_ONLY) registrations.

- **cleanupStaleRegistrations() → Promise<number>** (line 23)
  Computes cutoff (now − grace period days), then keyset-paginates OAUTH_ONLY registrations older than cutoff in batches; for each batch, excludes any registration that still has a non-deleted installed application, soft-deletes the rest. Returns total deleted.

- **findStaleRegistrationBatch(cutoffDate, batchSize, afterCreatedAt?) → Promise<{id, createdAt}[]>** (line 88, private)
  Keyset query (`createdAt > afterCreatedAt`, ordered ASC, take batchSize) for OAUTH_ONLY rows older than cutoff.

- **calculateCutoffDate() → Date** (line 121, private)
  Midnight UTC minus STALE_REGISTRATION_GRACE_PERIOD_DAYS.

### stale-registration-cleanup.cron.job.ts
`file:src/engine/core-modules/application/application-oauth/stale-registration-cleanup/crons/stale-registration-cleanup.cron.job.ts`

- **StaleRegistrationCleanupCronJob.handle() → Promise<void>** (line 26)
  BullMQ cronQueue processor (`@SentryCronMonitor`). Runs cleanupStaleRegistrations, logs deleted count; on error captures via ExceptionHandlerService and rethrows.

## Application Package Utilities

### application-version-validation.service.ts
`file:src/engine/core-modules/application/application-package/application-version-validation.service.ts`

**Service: ApplicationVersionValidationService**

- **validateServerCompatibility(requiredServerVersion?) → Promise<VersionValidationResult>** (line 26)
  No-op (compatible) if undefined. Validates the manifest's `engines.twenty` is a valid semver range, fetches the server's inferred version via UpgradeMigrationService, and checks `semver.satisfies`. Returns `{compatible:false, reason, message}` for INVALID_REQUIRED_VERSION / INVALID_SERVER_VERSION / INCOMPATIBLE.

### Package utils
`file:src/engine/core-modules/application/application-package/utils/`

- **assertValidNpmPackageName(name) → void** (`assert-valid-npm-package-name.util.ts:11`)
  Throws INVALID_INPUT unless name matches the npm package-name regex (optional @scope/) and contains no `..` (path-traversal guard).

- **extractTarballSecurely(tarballPath, targetDir) → Promise<void>** (`extract-tarball-securely.util.ts:12`)
  `tar.extract` with a per-entry filter that rejects path-escape entries (resolved path must stay under target), rejects symlinks/hardlinks, and aborts if cumulative size exceeds MAX_EXTRACTED_SIZE_BYTES (500 MB).

- **parseAvailablePackagesFromPackageJsonAndYarnLock(packageJsonContent, yarnLockContent) → Record<string,string>** (`parse-available-packages-from-package-json-and-yarn-lock.util.ts:8`)
  Regex-scans yarn.lock (capped at 1000 matches) for `name@…: version:` blocks and records the resolved version for each package that appears in package.json dependencies.

- **copyYarnEngineAndBuildDependencies(buildDirectory) → Promise<void>** (`copy-yarn-engine-and-build-dependencies.ts:10`)
  Copies the vendored yarn engine into the build dir, runs `yarn workspaces focus --all --production` (with NODE_OPTIONS stripped so tsx doesn't interfere), then deletes everything except `node_modules` — leaving only installed production deps.

- **getDefaultApplicationPackageFields() → Promise<DefaultApplicationPackageFields>** (`get-default-application-package-fields.util.ts:21`)
  Reads the seed package.json/yarn.lock, parses available packages, and returns them plus the hard-coded default checksums (SHA512 first-32-char digests).

- **readJsonFile<T>(dir, filename) → Promise<T | null>** / **readJsonFileOrThrow<T>(dir, filename) → Promise<T>** (`read-json-file.util.ts:9, 24`)
  Reads + JSON-parses a file; the OrThrow variant throws PACKAGE_RESOLUTION_FAILED on null.

- **resolvePackageContentDir(extractDir) → Promise<string>** (`tarball-utils.ts:5`)
  Returns `<extractDir>/package` if it exists (npm pack wraps contents in `package/`), else the extract dir itself.

## Marketplace — Catalog Sync & Query

### marketplace-catalog-sync.service.ts
`file:src/engine/core-modules/application/application-marketplace/marketplace-catalog-sync.service.ts`

**Service: MarketplaceCatalogSyncService**

- **syncCatalog() → Promise<void>** (line 20)
  Entry point; calls syncRegistryApps and logs completion.

- **syncRegistryApps() → Promise<void>** (line 26, private)
  Fetches npm registry packages, then per package: fetches manifest from CDN (skips if none), backfills aboutDescription from README, rewrites relative asset URLs to absolute CDN URLs (resolveManifestAssetUrls + buildRegistryCdnUrl), and upserts a NPM registration via `applicationRegistrationService.upsertFromCatalog`. Per-package errors are logged, not fatal.

### marketplace-query.service.ts
`file:src/engine/core-modules/application/application-marketplace/marketplace-query.service.ts`

**Service: MarketplaceQueryService**

- **findManyMarketplaceApps() → Promise<MarketplaceAppDTO[]>** (line 31)
  Returns listed registrations as marketplace DTOs. If none exist, enqueues a one-time catalog-sync job (guarded by `hasSyncBeenEnqueued`) and returns []. Filters out apps whose required variables are unconfigured (batch check).

- **findMarketplaceAppDetail(universalIdentifier) → Promise<MarketplaceAppDetailDTO>** (line 61)
  Resolves the registration and maps to detail DTO.

- **findRegistrationByUniversalIdentifier(universalIdentifier) → Promise<ApplicationRegistrationEntity>** (line 70)
  Throws APPLICATION_REGISTRATION_NOT_FOUND if missing.

- **toMarketplaceAppDTO / toMarketplaceAppDetailDTO** (lines 88, 105, private)
  Map registration + manifest.application into list/detail DTOs (name, description, author, category, logo, isFeatured, etc.).

### marketplace.resolver.ts
`file:src/engine/core-modules/application/application-marketplace/marketplace.resolver.ts`

**Resolver: MarketplaceResolver** (workspace-auth guarded).

- **findManyMarketplaceApps() → Query<MarketplaceAppDTO[]>** (line 38) — delegates to query service.
- **findMarketplaceAppDetail(universalIdentifier) → Query<MarketplaceAppDetailDTO>** (line 43) — delegates to query service.
- **installMarketplaceApp(universalIdentifier, version?) → Mutation<Boolean>** (line 55, deprecated)
  Resolves registration, installs via ApplicationInstallService, returns true. Requires MARKETPLACE_APPS permission.
- **installApplication(universalIdentifier, version?) → Mutation<ApplicationDTO>** (line 77)
  Installs and returns the resulting ApplicationDTO. Requires MARKETPLACE_APPS permission.
- **syncMarketplaceCatalog() → Mutation<Boolean>** (line 102)
  Enqueues the catalog-sync cron job (idempotent job id). Requires MARKETPLACE_APPS permission.

### marketplace-catalog-sync.cron.job.ts / command
`file:src/engine/core-modules/application/application-marketplace/crons/marketplace-catalog-sync.cron.job.ts`

- **MarketplaceCatalogSyncCronJob.handle() → Promise<void>** (line 24)
  BullMQ cronQueue processor (`@SentryCronMonitor`); runs syncCatalog, logs, rethrows on error.

- **MarketplaceCatalogSyncCommand.run() → Promise<void>** (`crons/commands/marketplace-catalog-sync.command.ts:16`)
  `nest-commander` command `marketplace:catalog-sync` that runs syncCatalog manually.

### Marketplace utils
`file:src/engine/core-modules/application/application-marketplace/utils/`

- **buildRegistryCdnUrl({cdnBaseUrl, packageName, version, filePath}) → string** (`build-registry-cdn-url.util.ts:1`)
  Builds `<cdnBaseUrl>/<packageName>@<version>/<filePath>`.

- **resolveManifestAssetUrls(manifest, urlBuilder) → Manifest** (`resolve-manifest-asset-urls.util.ts:6`)
  Returns a manifest clone with `application.logoUrl` and `screenshots` rewritten through urlBuilder (absolute http(s) URLs are left untouched).

## Application Manifest — Migration & Universal Flat Maps

### application-manifest-migration.service.ts
`file:src/engine/core-modules/application/application-manifest/application-manifest-migration.service.ts`

**Service: ApplicationManifestMigrationService** — Diffs a manifest against current workspace metadata and runs the migration.

- **syncPreInstallLogicFunctionFromManifest({manifest, workspaceId, ownerFlatApplication}) → Promise<void>** (line 37)
  No-op if no pre-install logic function declared; otherwise finds it in manifest.logicFunctions (throws ENTITY_NOT_FOUND if absent), builds a single-function "preInstallOnly" manifest, and runs a purely **additive** migration (inferDeletionFromMissingEntities omitted) so existing metadata is untouched on upgrades.

- **syncMetadataFromManifest({manifest, workspaceId, ownerFlatApplication}) → Promise<{workspaceMigration, hasSchemaMetadataChanged}>** (line 160)
  Loads current flat-entity maps + featureFlagsMap from cache, computes the app's existing sub-maps (from) and the manifest's universal flat maps (to), builds dependency maps (always includes the Twenty-standard app unless the owner *is* it), then runs `validateBuildAndRunWorkspaceMigrationFromTo` with `inferDeletionFromMissingEntities:true`. Throws WorkspaceMigrationBuilderException on validation failure. Finally calls syncDefaultRoleAndSettingsCustomTab.

- **syncDefaultRoleAndSettingsCustomTab({manifest, workspaceId, ownerFlatApplication}) → Promise<void>** (line 253, private)
  Re-reads role + front-component maps, resolves the manifest's default role and settings-custom-tab front component to their persisted ids (throws ENTITY_NOT_FOUND if unresolvable), and updates the application's `defaultRoleId` / `settingsCustomTabFrontComponentId`.

### compute-application-manifest-all-universal-flat-entity-maps.service.ts
`file:src/engine/core-modules/application/application-manifest/services/compute-application-manifest-all-universal-flat-entity-maps.service.ts`

**Service: ComputeApplicationManifestAllUniversalFlatEntityMapsService**

- **compute({manifest, ownerFlatApplication, now, workspaceId}) → AllFlatEntityMaps** (line 65)
  The big manifest→universal-flat converter. Iterates every manifest section (objects + their fields/unique-indexes, top-level fields, declared indexes with per-object MAX_CUSTOM_INDEXES_PER_OBJECT guard, logic functions, front components, connection providers, permission flags, roles + their object/field permissions and permission-flag links, skills, agents, views + field-groups/fields/filter-groups/filters/groups/sorts, navigation menu items, page layouts + tabs + widgets, top-level page-layout tabs, application variables, command menu items), converting each through its dedicated `from*ManifestToUniversalFlat*` util and adding it into the empty AllFlatEntityMaps via `addUniversalFlatEntityToUniversalFlatEntityMapsThroughMutationOrThrow`. Auto-generates a TS_VECTOR field's universalSettings from the object's label identifier when missing, and an index for every unique field.

- **encryptApplicationVariableValue(plaintext, workspaceId) → EncryptedString | ''** (line 51, private)
  Returns '' for empty input; otherwise versioned-encrypts the value (secret variables are stored empty in the manifest sync, filled later by the admin).

### Manifest utils
`file:src/engine/core-modules/application/application-manifest/utils/`

- **buildFromToAllUniversalFlatEntityMaps({fromAllFlatEntityMaps, toAllUniversalFlatEntityMaps}) → FromToAllUniversalFlatEntityMaps** (`build-from-to-all-universal-flat-entity-maps.util.ts:7`)
  For each metadata name, pairs the from/to flat-entity maps into a `{from, to}` record keyed by the flat-entity-maps key.

- **computeSearchVectorUniversalSettingsFromObjectManifest({objectManifest}) → FieldMetadataUniversalSettings<TS_VECTOR>** (`compute-search-vector-universal-settings-from-object-manifest.util.ts:10`)
  Finds the label-identifier field; returns null if missing/non-searchable; else builds a STORED generated `asExpression` ts_vector column from that field.

- **getApplicationSubAllFlatEntityMaps({applicationIds, fromAllFlatEntityMaps}) → AllFlatEntityMaps** (`get-application-sub-all-flat-entity-maps.util.ts:9`)
  Extracts the subset of every metadata map that belongs to the given application ids (via getSubFlatEntityMapsByApplicationIdsOrThrow), producing a scoped AllFlatEntityMaps.

### Manifest converters
`file:src/engine/core-modules/application/application-manifest/converters/`

~25 pure `from<Entity>ManifestToUniversalFlat<Entity>(...) → UniversalFlat<Entity>` mappers, one per manifest entity type (object metadata, field metadata, field/object permission, front component, index, logic function, navigation menu item, page layout / tab / widget, permission flag, role-permission-flag, role, skill, view + view field/field-group/filter/filter-group/group/sort, command menu item, connection provider, application variable). Each takes the manifest fragment + `applicationUniversalIdentifier` + `now` (and parent universal identifiers where nested) and returns the corresponding universal-flat entity with timestamps and `isCustom:false`. The connection-provider converter encrypts no values; the application-variable converter is fed an already-encrypted value by the compute service.

### from-agent-manifest-to-universal-flat-agent.util.ts
`file:src/engine/core-modules/application/utils/from-agent-manifest-to-universal-flat-agent.util.ts`

- **fromAgentManifestToUniversalFlatAgent({agentManifest, applicationUniversalIdentifier, now}) → UniversalFlatAgent** (line 7)
  Maps an agent manifest to a flat agent: copies name/label/icon/description/prompt, defaults modelId to AUTO_SELECT_SMART_MODEL_ID, sets responseFormat `{type:'text'}`, empty evaluationInputs, isCustom false, timestamps.

## Connection Provider (OAuth-backed app connections)

### connection-provider.service.ts
`file:src/engine/core-modules/application/connection-provider/connection-provider.service.ts`

**Service: ConnectionProviderService** — Resolves OAuth client credentials for app-declared connection providers and queries providers.

- **getClientCredentials(provider) → Promise<{clientId, clientSecret}>** (line 27)
  Asserts the provider is OAuth-typed, finds the owning application + its registration (throws CLIENT_CREDENTIALS_NOT_CONFIGURED if no registration), loads + decrypts the clientId/clientSecret registration variables; throws if either is empty.

- **areClientCredentialsConfigured(provider) → Promise<boolean>** (line 74) — single-provider wrapper over the batch method.

- **areClientCredentialsConfiguredBatch(providers) → Promise<Map<string,boolean>>** (line 82)
  Filters to OAuth providers, resolves their applications→registrations, loads the relevant registration variables once, and marks a provider configured only if both its clientId and clientSecret variables have non-empty encrypted values.

- **findOneByApplicationAndName({applicationId, name}) → Promise<ConnectionProviderEntity | null>** (line 170)
- **findOneByIdOrThrow(id) → Promise<ConnectionProviderEntity>** (line 182) — throws PROVIDER_NOT_FOUND.
- **findManyByApplication({applicationId, workspaceId}) → Promise<ConnectionProviderEntity[]>** (line 197)

### connection-provider-oauth-flow.service.ts
`file:src/engine/core-modules/application/connection-provider/connection-provider-oauth-flow.service.ts`

**Service: ConnectionProviderOAuthFlowService** — Runs the authorization-code flow that produces a ConnectedAccount for an app provider.

- **startAuthorizationFlow(args) → Promise<{authorizationUrl}>** (line 70)
  Asserts OAuth provider; for reconnect requests, verifies the target ConnectedAccount belongs to the requesting workspace + same provider (FORBIDDEN otherwise). Resolves client credentials, generates a PKCE verifier when usePkce, signs a 10-minute `APP_OAUTH_STATE` JWT carrying workspace/user/visibility/reconnect/redirect/codeVerifier, and assembles the provider authorization URL (client_id, redirect_uri = `/apps/oauth/callback`, scope, state, PKCE challenge, extra authorizationParams).

- **completeAuthorizationFlow(args) → Promise<CallbackResult>** (line 143)
  Verifies the state JWT, re-loads the provider, resolves credentials, exchanges the code via SSRF-safe fetch (errors → TOKEN_EXCHANGE_FAILED), then persists/updates the ConnectedAccount. Returns connectedAccountId, workspaceId, applicationId, redirectLocation.

- **signState / verifyState** (lines 199, 205, private) — sign/verify the APP_OAUTH_STATE JWT (type-checked; INVALID_STATE on failure).
- **getServerUrl()** (line 228, private) — reads SERVER_URL.
- **persistConnectedAccount({...}) → Promise<ConnectedAccountEntity>** (line 232, private)
  Encrypts the access/refresh token pair; on reconnect, workspace-scoped update + findOneByOrFail; otherwise creates a new APP-provider ConnectedAccount named `<displayName> #<n+1>` with visibility, scopes, applicationId, connectionProviderId, userWorkspaceId.

### application-connection-provider.resolver.ts
`file:src/engine/core-modules/application/connection-provider/application-connection-provider.resolver.ts`

- **applicationConnectionProviders(applicationId, workspace) → Query<ApplicationConnectionProviderDTO[]>** (line 22)
  Returns the workspace's providers for an application, batch-checks credential configuration, and maps to DTOs (oauth field carries scopes + isClientCredentialsConfigured).

### connection-provider-oauth.controller.ts
`file:src/engine/core-modules/application/connection-provider/connection-provider-oauth.controller.ts`

**Controller: ConnectionProviderOAuthController** (`@Controller('apps/oauth')`, public; transient token carries identity).

- **authorize(applicationId, providerName, transientToken, visibility?, reconnectingConnectedAccountId?, redirectLocation?, res) → redirect** (line 47)
  Validates params + visibility, verifies the transient token → workspace/user, loads workspace + provider (provider must belong to the workspace), resolves the userWorkspace, then redirects to the provider's authorization URL. On any error logs + redirects to a workspace-scoped error URL (captured early so the redirect lands on the user's own subdomain).

- **callback(code, state, error?, error_description?, res) → redirect** (line 159)
  Handles provider error params / missing code+state; otherwise completes the flow, builds a workspace URL to the application detail page (or redirectLocation), sets `#settings` hash, and redirects.

- **redirectToError(res, error, workspace) → redirect** (line 226, private)
  Builds an error redirect via GuardRedirectService (captures exceptions), falling back to DEFAULT_SUBDOMAIN.

### connections/application-connections.controller.ts
`file:src/engine/core-modules/application/connection-provider/connections/application-connections.controller.ts`

**Controller: ApplicationConnectionsController** (`@Controller('apps/connections')`, requires an APPLICATION_ACCESS token — used by app logic functions at runtime).

- **list(request, filter) → Promise<AppConnectionDto[]>** (line 38) — `POST /apps/connections/list`.
- **get(request, body) → Promise<AppConnectionDto>** (line 55) — `POST /apps/connections/get`.
- **requireAppContext(request) → {applicationId, workspaceId, requestUserWorkspaceId}** (line 70, private)
  Throws ForbiddenException unless the request was authenticated with an application access token.

### connections/services/application-connections-list.service.ts
`file:src/engine/core-modules/application/connection-provider/connections/services/application-connections-list.service.ts`

**Service: ApplicationConnectionsListService** — Lists/fetches an app's connected accounts with fresh decrypted access tokens.

- **list({applicationId, workspaceId, requestUserWorkspaceId, filter}) → Promise<AppConnectionDto[]>** (line 49)
  Loads the app's providers, applies optional providerName/userWorkspaceId filters plus a privacy WHERE, then refreshes + maps each account (dropping any that can't be resolved/refreshed).

- **getOne({applicationId, workspaceId, requestUserWorkspaceId, id}) → Promise<AppConnectionDto>** (line 101)
  Fetches one APP-provider connected account scoped to the app; enforces the same privacy rule (a request-user only sees their own user-visibility connections; workspace-shared ones are visible to all; cron sees all); refreshes + maps it. NotFoundException for missing/foreign/unresolvable.

- **buildPrivacyWhere(baseWhere, requestUserWorkspaceId, visibilityFilter) → FindOptionsWhere | FindOptionsWhere[]** (line 155, private)
  Encodes the visibility privacy rule into TypeORM where clauses (cron with no request user sees everything matching the visibility filter).

- **refreshAndMap(account, workspaceId, providerById) → Promise<AppConnectionDto | null>** (line 190, private)
  Resolves the provider (drops ghost rows referencing a missing provider), refreshes tokens via ConnectedAccountRefreshTokensService, decrypts the access token, and returns the DTO (name, handle, visibility, userWorkspaceId, accessToken, scopes, authFailedAt). Returns null on refresh failure.

### refresh/services/app-oauth-refresh-tokens.service.ts
`file:src/engine/core-modules/application/connection-provider/refresh/services/app-oauth-refresh-tokens.service.ts`

**Service: AppOAuthRefreshAccessTokenService** — Refresh-token driver for APP-provider connected accounts (plugged into the generic refresh-tokens manager).

- **refreshTokens(connectedAccount, refreshToken) → Promise<ConnectedAccountPlaintextTokens>** (line 28)
  Resolves the provider + client credentials, calls the token endpoint with grant_type=refresh_token (SSRF-safe fetch); falls back to the existing refresh token if the provider doesn't rotate it. Maps 4xx (esp. invalid_grant) to INVALID_REFRESH_TOKEN (reconnect needed) and 5xx/transport errors to TEMPORARY_NETWORK_ERROR.

- **resolveProvider(connectionProviderId) → Promise<{provider, clientId, clientSecret}>** (line 80, private)
  Loads + asserts the OAuth provider and its credentials; maps ConnectionProviderException to PROVIDER_NOT_SUPPORTED.

### refresh/services/app-oauth-revoke.service.ts
`file:src/engine/core-modules/application/connection-provider/refresh/services/app-oauth-revoke.service.ts`

**Service: AppOAuthRevokeService**

- **revokeIfApp(connectedAccount) → Promise<void>** (line 21)
  Best-effort revocation: no-ops if not an OAuth APP account with a token + provider revokeEndpoint; otherwise decrypts the access token and POSTs `token` + `token_type_hint=access_token` (form-encoded) to the revoke endpoint. All failures are logged, never thrown (so disconnect never blocks).

### Connection-provider utils
`file:src/engine/core-modules/application/connection-provider/utils/`

- **assertOAuthProvider(provider) → asserts OAuthConnectionProvider** (`assert-oauth-provider.util.ts:13`)
  Type-narrowing guard; throws INVALID_REQUEST unless `type==='oauth'` with an oauthConfig.

- **buildAppOAuthCallbackUrl(serverUrl) → string** (`build-callback-url.util.ts:4`)
  Returns `<serverUrl>/apps/oauth/callback` — workspace-agnostic (identity travels in signed state).

- **computePkceChallenge(verifier) → string** (`compute-pkce-challenge.util.ts:5`)
  base64url(SHA-256(verifier)) — PKCE S256.

- **generatePkceVerifier() → string** (`generate-pkce-verifier.util.ts:5`)
  base64url of 32 random bytes.

- **encodeOAuthBody(contentType, params) → {body, contentTypeHeader}** (`encode-oauth-body.util.ts:3`)
  JSON or `application/x-www-form-urlencoded` body depending on the provider's configured content type.

- **exchangeCodeForToken(args) → Promise<TokenExchangeResponse>** (`exchange-code-for-token.util.ts:8`)
  Builds the authorization_code params (with optional code_verifier) and delegates to postOAuthTokenRequest.

- **exchangeRefreshTokenForToken(args) → Promise<TokenExchangeResponse>** (`exchange-refresh-token-for-token.util.ts:8`)
  Builds refresh_token params and delegates to postOAuthTokenRequest.

- **parseTokenResponse(json) → TokenExchangeResponse** (`parse-token-response.util.ts:4`)
  Extracts access_token (throws if absent), optional refresh_token, and splits `scope` on whitespace/commas.

- **postOAuthTokenRequest(args) → Promise<TokenExchangeResponse>** + **OAuthTokenEndpointError** (`post-oauth-token-request.util.ts:11, 21`)
  POSTs the encoded body with `Accept: application/json`; throws OAuthTokenEndpointError (carrying HTTP status, so callers distinguish transient 5xx from permanent 4xx) on non-OK; otherwise parses the JSON.

## NOT YET COVERED

Only trivial non-logic files remain (DTOs/inputs under `*/dtos/`, type aliases under `types/`, enums, constants such as cron patterns / curated-app lists / oauth-scopes lists, entity classes, exception/exception-filter classes already summarized at the top, and `*.module.ts` wiring). The ~25 manifest converters under `application-manifest/converters/` are documented collectively above (uniform pure mappers).

**Approximate function count documented: 160+ exported functions/methods/handlers across services, resolvers, controllers, cron jobs, commands, and utilities.**
