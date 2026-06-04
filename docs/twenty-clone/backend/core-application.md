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

---

## NOT YET COVERED

The following files were not fully documented due to token/time constraints:

- `/src/engine/core-modules/application/application-package/` — Most utility functions (extract, read, validate)
- `/src/engine/core-modules/application/application-marketplace/` — Catalog sync, query service, resolvers
- `/src/engine/core-modules/application/application-registration-variable/` — Variable entity definitions
- `/src/engine/core-modules/application/application-variable/` — Variable entity, exceptions, DTOs
- `/src/engine/core-modules/application/connection-provider/` — Exception handling, resolvers, entities
- `/src/engine/core-modules/application/application-manifest/` — Migration service, migration-related utilities
- `/src/engine/core-modules/application/types/` — Type definitions (FlatApplication, etc.)
- `/src/engine/core-modules/application/dtos/` — DTO definitions
- `/src/engine/core-modules/application/constants/` — Constant definitions
- `/src/engine/core-modules/application/application.module.ts` — Module configuration

**Approximate function count documented: 85+ exported functions/methods across services, resolvers, and utilities.**
