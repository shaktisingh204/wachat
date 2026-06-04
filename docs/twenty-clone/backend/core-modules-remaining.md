# Core-Modules Remaining - Function & Service Documentation

Documentation of all exported functions, NestJS services, GraphQL resolvers, and notable utilities in the Twenty-server `engine/core-modules` area, covering all sub-directories not previously assigned to other documentation lanes.

## actor

### ActorFromAuthContextService
file: actor/services/actor-from-auth-context.service.ts:26

**injectCreatedBy** → Promise<RecordInput[]>
Injects the `createdBy` field into records with actor metadata from auth context (workspace member, API key, or application). Validates that createdBy field exists in object metadata before injecting; skips injection if field is not found.

**injectActorFieldsOnCreate** → Promise<RecordInput[]>
Injects both `createdBy` and `updatedBy` fields on create operations by calling injectActorField sequentially. Both fields are set with actor metadata derived from auth context.

**injectUpdatedBy** → Promise<RecordInput[]>
Injects the `updatedBy` field into records with actor metadata from auth context. Replaces any existing value (unlike createdBy which preserves custom values).

**buildActorMetadata** (private) → ActorMetadata
Determines actor metadata source based on auth context type: if WorkspaceUser context, builds from workspace member full name; if ApiKey context, builds from API key name; if Application context, builds from application name. Throws error if context type is unrecognized.

### Query Hooks

**CreatedByCreateOnePreQueryHook** — created-by.create-one.pre-query-hook.ts:18
execute() → Promise<CreateOneResolverArgs<RecordInput>>
GraphQL pre-query hook that injects actor fields on single object creation. Validates payload data is present and calls ActorFromAuthContextService to inject createdBy/updatedBy before execution.

**CreatedByCreateManyPreQueryHook** — created-by.create-many.pre-query-hook.ts
execute() → Promise<CreateManyResolverArgs<RecordInput>>
GraphQL pre-query hook for batch creation; applies actor injection to all records in the array payload using ActorFromAuthContextService.

**UpdatedByUpdateOnePreQueryHook** — updated-by.update-one.pre-query-hook.ts
execute() → Promise<UpdateOneResolverArgs<RecordInput>>
GraphQL pre-query hook for single update operations; injects updatedBy field into the update payload.

**UpdatedByUpdateManyPreQueryHook** — updated-by.update-many.pre-query-hook.ts
execute() → Promise<UpdateManyResolverArgs<RecordInput>>
GraphQL pre-query hook for batch updates; applies updatedBy injection to all records in the array.

### Utility Functions

**buildCreatedByFromFullNameMetadata** → ActorMetadata
Combines workspace member first/last name into display name with FieldActorSource.MANUAL source and empty context object.

**buildCreatedByFromApiKey** → ActorMetadata
Extracts API key name as actor with FieldActorSource.API source; sets workspaceMemberId to null since API keys are not tied to members.

**buildCreatedByFromApplication** → ActorMetadata
Uses application name as actor with FieldActorSource.APPLICATION source; sets workspaceMemberId to null since applications are not tied to members.

---

## app-token

### AppTokenEntity
file: app-token/app-token.entity.ts:36
TypeORM entity representing application tokens (refresh tokens, authorization codes, verification tokens, etc.). Related to User and Workspace entities. Contains token value, expiration, revocation, and optional context with email/roleId/redirectUri/etc.

**formatEmail** (lifecycle hook) → void
@BeforeInsert/@BeforeUpdate hook that normalizes email in context to lowercase if present, ensuring case-insensitive email comparisons.

### AppTokenService
file: app-token/services/app-token.service.ts:5
Extends TypeOrmQueryService<AppTokenEntity>. Provides standard CRUD operations via base class with no custom methods override documented.

### BeforeCreateOneAppToken Hook
file: app-token/hooks/before-create-one-app-token.hook.ts:8
run() → Promise<CreateOneInputType<AppTokenEntity>>
Lifecycle hook that extracts userId from request context and injects it into the AppToken instance before creation.

---

## application-logs

### ApplicationLogsService
file: application-logs/application-logs.service.ts:8
writeLogs(entries: ApplicationLogEntry[]) → Promise<void>
Routes log entries to the configured driver (clickhouse, console, or disabled). Supports pluggable log drivers for different backends.

### Drivers

**ClickHouseDriver** — application-logs/drivers/clickhouse.driver.ts
writeLogs() implementation that batches log entries and sends to ClickHouse database for analytics.

**ConsoleDriver** — application-logs/drivers/console.driver.ts
writeLogs() outputs logs to console for development/debugging.

**DisabledDriver** — application-logs/drivers/disabled.driver.ts
writeLogs() no-op implementation for environments where logging is disabled.

### Utilities

**parseApplicationLogLines** → ParsedLogLine[]
Parses raw log line strings into structured log objects with timestamp, level, and message fields. Used by drivers before persisting.

---

## approved-access-domain

### ApprovedAccessDomainService
file: approved-access-domain/services/approved-access-domain.service.ts:37

**sendApprovedAccessDomainValidationEmail** → void
Generates JWT validation token, builds workspace-specific link with validation params, and sends React Email template to validate domain ownership. Throws if domain already validated or email domain doesn't match.

**createApprovedAccessDomain** → ApprovedAccessDomainEntity
Validates domain is a company domain (not free email), checks for duplicates, creates record, and triggers validation email to confirm domain ownership.

**validateApprovedAccessDomain** → ApprovedAccessDomainEntity
Verifies JWT validation token signature and claims, validates consistency between payload and database record, and marks domain as isValidated=true on success.

**deleteApprovedAccessDomain** → void
Soft-deletes approved domain from workspace. Validates domain exists before deletion.

**getApprovedAccessDomains** → ApprovedAccessDomainEntity[]
Retrieves all approved access domains for a workspace. Used to populate workspace domain settings.

**findValidatedApprovedAccessDomainWithWorkspacesAndSSOIdentityProvidersDomain** → ApprovedAccessDomainEntity[]
Finds all validated domains matching email domain across all workspaces, with eager-loaded workspace and SSO identity provider relations. Used during SSO/signup domain discovery.

### GraphQL Resolver
**ApprovedAccessDomainResolver** — approved-access-domain.resolver.ts
createApprovedAccessDomain() → Mutation to create domain
validateApprovedAccessDomain() → Mutation to validate via token
deleteApprovedAccessDomain() → Mutation to soft-delete
getApprovedAccessDomains() → Query to list all for workspace

---

## cache-lock

### CacheLockService
file: cache-lock/cache-lock.service.ts:14

**withLock<T>** → Promise<T>
Acquires distributed lock via Redis, executes async function with timeout retry logic, and releases lock. Throws if lock cannot be acquired after max retries. Default options: 100ms delay, 50 max retries, 5.5s TTL.

**delay** → Promise<void>
Utility sleep function for retry backoff between lock acquisition attempts.

### Decorator

**withLock** — cache-lock/with-lock.decorator.ts
Method decorator that automatically wraps service method execution with CacheLockService.withLock() using method name as lock key. Simplifies distributed locking for concurrent operation protection.

---

## cache-storage

### CacheStorageService
file: cache-storage/services/cache-storage.service.ts:10
Multi-backend cache service supporting both Redis and in-memory cache managers.

**get<T>** → Promise<T | undefined>
Retrieves value from cache by key. Uses namespaced key with CacheStorageNamespace prefix.

**set<T>** → void
Stores value with optional TTL. Supports both Redis and in-memory caching.

**del** → void
Removes single key from cache by namespaced key.

**mdel** → Promise<void>
Batch deletes multiple keys. Optimized for Redis using raw DEL command; falls back to individual delete for memory cache.

**mget<T>** → Promise<(T | undefined)[]>
Batch retrieves multiple keys. Uses Redis MGET for efficiency or sequential get for memory cache.

**mset** → Promise<void>
Batch sets multiple key-value pairs with optional per-entry TTLs. Parallelizes set operations.

**setAdd/setRemove** → Promise<void/number>
Redis set operations for managing sets of strings. setAdd appends values to set with TTL; setRemove removes values and returns count removed.

**countAllSetMembers/getSetLength/setMembers/setPop** → Promise<number/string[]>
Redis set utility methods for set cardinality, membership queries, and atomic pop operations.

**flush** → Promise<void>
Clears entire cache (all namespaces). Uses cache.reset().

**flushByPattern** → Promise<void>
Redis-only scan and delete by glob pattern (e.g., "user:*"). Iterates via SCAN cursor with COUNT hint.

**scanAndCountSetMembers** → Promise<number>
Scans keys matching pattern and sums cardinality of all matching sets. Used for metrics aggregation.

**acquireLock/releaseLock** → Promise<boolean/void>
Redis-based distributed locking with SET NX for atomic acquire and DEL for release.

**incrBy** → Promise<number>
Increments integer value by amount, returning new value. Lazy-initializes to 0 if key missing.

**hashGetValues/hashSet/hashSetIfExists/hashSetWithExpire/hashDelete** → Promise<string[]/number/void>
Redis hash (map) operations for storing field-value pairs within keys. hashSetIfExists is Lua script for conditional upsert. hashSetWithExpire auto-sets expiration.

**expire** → Promise<boolean>
Sets/resets TTL on existing key. Returns false if key not found.

---

## calendar

### TimelineCalendarEventService
file: calendar/timeline-calendar-event.service.ts:22

**getCalendarEventsFromPersonIds** → Promise<TimelineCalendarEventsWithTotalDTO>
Fetches calendar events associated with multiple person IDs with pagination. Resolves visibility (SHARE_EVERYTHING vs METADATA-only) based on ownership of connected calendar account. Filters event title/description by visibility permissions. Returns total count and visible event list.

**getCalendarEventsFromCompanyId** → Promise<TimelineCalendarEventsWithTotalDTO>
Resolves company → person list, then delegates to getCalendarEventsFromPersonIds. Used for company timeline.

**getCalendarEventsFromOpportunityId** → Promise<TimelineCalendarEventsWithTotalDTO>
Resolves opportunity → company → persons, then fetches events. Used for opportunity timeline.

### TimelineCalendarEventResolver
file: calendar/timeline-calendar-event.resolver.ts:58

**getTimelineCalendarEventsFromPersonId** → Query
GraphQL query wrapper for single person calendar events with pagination.

**getTimelineCalendarEventsFromCompanyId** → Query
GraphQL query wrapper for company calendar events with pagination.

**getTimelineCalendarEventsFromOpportunityId** → Query
GraphQL query wrapper for opportunity calendar events with pagination.

---

## captcha

### CaptchaService
file: captcha/captcha.service.ts:8

**validate** → Promise<CaptchaValidateResult>
Delegates to factory-selected driver (Google reCAPTCHA or Cloudflare Turnstile). Returns {success: true} if no driver configured (captcha disabled). Otherwise validates token signature and returns driver result.

### CaptchaGuard
file: captcha/captcha.guard.ts:19

**canActivate** → Promise<boolean>
NestJS guard for GraphQL endpoints. Extracts captchaToken from resolver args, validates via CaptchaService, increments InvalidCaptcha metrics on failure, throws CaptchaException if invalid.

### Drivers

**GoogleRecaptchaDriver** — captcha/drivers/google-recaptcha.driver.ts
validate() makes HTTP POST to Google Recaptcha v3 API with token. Thresholds and success determined by Google response.

**TurnstileDriver** — captcha/drivers/turnstile.driver.ts
validate() makes HTTP POST to Cloudflare Turnstile API endpoint. Implements Turnstile-specific validation flow.

---

## client-config

### ClientConfigModule
file: client-config/client-config.module.ts:11
Provides ClientConfigService and ClientConfigResolver for frontend to fetch runtime configuration (environment-specific URLs, feature flags, branding).

### ClientConfigService
Exposes application configuration as GraphQL queries (e.g., SERVER_URL, FRONTEND_DOMAIN).

---

## cloudflare

### DnsCloudflareService
file: cloudflare/services/dns-cloudflare.service.ts
Implements DNS management via Cloudflare API. Creates/updates DNS records (CNAME, MX, TXT) for domain verification and email routing.

---

## code-interpreter

### CodeInterpreterService
file: code-interpreter/code-interpreter.service.ts:15

**isEnabled** → boolean
Returns true if CODE_INTERPRETER_TYPE is not DISABLED. Used to conditionally enable code execution features.

**execute** → Promise<CodeExecutionResult>
Delegates to factory-selected driver (Python sandbox, E2B, or disabled). Executes code string with optional input files and streaming callbacks for output. Returns execution result with stdout, stderr, and exit code.

---

## dns-manager

### DnsManagerService
file: dns-manager/services/dns-manager.service.ts
Coordinates DNS record creation across multiple providers (Cloudflare). Used during custom domain setup to create required DNS records (CNAME for routing, TXT for verification).

---

## email

### EmailService
file: email/email.service.ts:11

**send** → Promise<void>
Enqueues email sending job to message queue (email queue) with optional retry limit (default 3). Async job processing allows non-blocking email sends.

### EmailSenderService
file: email/email-sender.service.ts
Consumes email jobs from message queue, formats using Nodemailer, and sends via configured SMTP provider (SendGrid, AWS SES, etc.).

---

## email-verification

### EmailVerificationService
file: email-verification/services/email-verification.service.ts
Manages email verification tokens and validation flow. Generates JWT tokens, sends verification emails, validates tokens, and marks email as verified.

---

## enterprise

### EnterprisePlanService
file: enterprise/services/enterprise-plan.service.ts
Determines enterprise plan entitlements for workspaces. Checks billing service for purchased features (SSO, custom branding, advanced analytics, etc.).

---

## environment

### EnvironmentModule
Configuration management for environment variables with validation and type safety. Provides access to NODE_ENV, deployment region, feature toggles.

---

## event-emitter

### EventEmitterModule
NestJS EventEmitter module for pub/sub event handling within the application. Used for domain events (user invited, workspace created, etc.).

---

## feature-flag

### FeatureFlagService
file: feature-flag/services/feature-flag.service.ts:20

**isFeatureEnabled** → Promise<boolean>
Checks if feature flag is enabled for workspace. Caches feature flags map to avoid per-query lookups.

**getWorkspaceFeatureFlags** → Promise<FeatureFlagDTO[]>
Returns all feature flags for workspace as [{key, value}] array for frontend consumption.

**getWorkspaceFeatureFlagsMap** → Promise<FeatureFlagMap>
Returns feature flags as object map {flagKey: booleanValue} for efficient lookups.

**enableFeatureFlags** → Promise<void>
Upsert batch of flags to enabled state. Invalidates workspace cache after update.

**upsertWorkspaceFeatureFlag** → Promise<FeatureFlagEntity>
Upsert single flag with optional public flag validation. Updates cache after save.

---

## geo-map

### GeoMapService
file: geo-map/services/geo-map.service.ts
Provides geographic data (coordinates, cities, etc.) via external map service integration. Used by address/location fields.

---

## graphql

### GraphQL Module
Defines GraphQL schema configuration, workspace-scoped resolvers, subscription setup via Redis PubSub, and execution context builders.

---

## guard-redirect

### GuardRedirectService
file: guard-redirect/services/guard-redirect.service.ts
Manages 2FA redirect flows. Redirects users to 2FA challenge after login when 2FA is enabled. Validates redirect tokens and targets.

---

## health

### Health Module
Defines health check endpoints for Kubernetes liveness/readiness probes. Checks database, Redis, and service connectivity.

---

## imap-smtp-caldav-connection

### ImapSmtpCaldavConnectionService
file: imap-smtp-caldav-connection/services/imap-smtp-caldav-connection.service.ts
Validates and manages IMAP/SMTP/CalDAV connection credentials for email sync and calendar integrations. Tests connection before saving.

**validateImapSmtpCaldavConnection** → Promise<ConnectionValidationResult>
Tests provided IMAP/SMTP credentials by attempting authentication. Returns success/error with detailed error messages.

### ImapSmtpCaldavConnectionValidatorService
file: imap-smtp-caldav-connection/services/imap-smtp-caldav-connection-validator.service.ts
Encapsulates IMAP/SMTP/CalDAV protocol validation logic. Used by service to verify credentials before persistence.

---

## impersonation

### ImpersonationService
file: impersonation/services/impersonation.service.ts:25

**impersonate** → Promise<{workspace, loginToken}>
Validates impersonator and target user exist, checks permissions (server-level requires 2FA in non-dev, workspace-level requires permission), generates impersonation login token. Returns workspace info and token.

**generateImpersonationLoginToken** → Promise<{workspace, loginToken}>
Creates login token for target user via LoginTokenService. Logs impersonation attempt/success to audit trail. Used by impersonate() after permission checks.

---

## key-value-pair

### KeyValuePairService<KeyValueTypesMap>
file: key-value-pair/key-value-pair.service.ts:10
Generic typed key-value store service with optional user/workspace scope.

**get** → Promise<Array<KeyValueTypesMap[K]>>
Retrieves values by key, with optional filtering by userId/workspaceId. Returns array of matching pairs (usually 0-1 items).

**set** → Promise<void>
Upserts key-value pair scoped to user and/or workspace. Uses database upsert with conflict path deduction based on scope (userId/workspaceId null patterns).

**delete** → Promise<void>
Removes key-value pair by key and scope. Supports QueryRunner for transaction context.

---

## lab

### LabModule
Experimental features module. Contains beta/unstable features behind feature flags for testing.

---

## logger

### LoggerService
file: logger/logger.service.ts:18
Implements NestJS LoggerService interface, delegating to pluggable driver (Console, Sentry, etc.).

**log/error/warn/debug/verbose** → void
Log level methods that delegate to driver. Support structured logging with category/context.

**setLogLevels** → void
Reconfigures which log levels are active (DEBUG, INFO, WARN, ERROR).

**time/timeEnd** → void
Debug timing utilities for performance measurement. No-op if debug level not enabled.

---

## messaging

### TimelineMessagingService
file: messaging/services/timeline-messaging.service.ts
Fetches email messages associated with person/company for timeline display. Similar to calendar events service but for email threads.

**getMessagesFromPersonIds** → Promise<TimelineMessagesWithTotalDTO>
Fetches email messages with participants, returns paginated results with visibility controls.

### GetMessagesService
file: messaging/services/get-messages.service.ts
Core message fetching logic. Queries connected email accounts (Gmail, Outlook) for messages linked to CRM records.

---

## metrics

### MetricsService
file: metrics/metrics.service.ts:22

**getMeter** → Meter
Returns OpenTelemetry meter for creating metrics.

**createObservableGauge** → ObservableGauge
Creates observable gauge metric with callback function. Optional caching of results to reduce query frequency.

**createInfoGauge** → ObservableGauge
Creates info-type gauge that reports attributes (e.g., app version, environment) as metric labels.

**incrementCounterForEvent** → Promise<void>
Increments counter metric for event and optionally caches event ID to deduplicate metrics.

**incrementCounterForEvents** → Promise<void>
Batch increments counter for multiple event IDs with optional caching.

**incrementCounterBy** → void
Increments counter by specified amount instead of by 1.

**recordHistogram** → void
Records value for histogram metric (e.g., latency distribution) with optional unit.

**groupMetrics** → Promise<Record<string, number>>
Computes aggregated counts from cached metrics for dashboard/reporting.

### MetricsCacheService
file: metrics/metrics-cache.service.ts
Manages cache of metric event IDs to support event deduplication and aggregation.

---

## onboarding

### OnboardingService
file: onboarding/onboarding.service.ts:31

**getOnboardingStatus** → Promise<OnboardingStatus | null>
Determines current onboarding step (plan required, workspace activation, profile creation, email sync, team invite, booking, completed). Reads directly from DB to get fresh activation status bypassing cache.

**setOnboardingConnectAccountPending** → Promise<void>
Marks email/calendar sync pending for user. Deletes flag if value=false.

**setOnboardingInviteTeamPending** → Promise<void>
Marks team invitation flow as pending for workspace. Workspace-level, not user-level.

**setOnboardingCreateProfilePending** → Promise<void>
Marks profile creation (name entry) as pending for user in workspace.

**completeOnboardingProfileStepIfNameProvided** → Promise<void>
Auto-completes profile creation step if user provided first or last name. Used during signup to skip profile step if info already provided.

**setOnboardingBookOnboardingPending** → Promise<void>
Marks calendar booking as pending. Checks if booking page is configured before marking pending.

---

## open-api

### OpenApiService
file: open-api/open-api.service.ts
Generates OpenAPI (Swagger) schema from GraphQL schema for external API documentation.

---

## public-domain

### PublicDomainService
file: public-domain/public-domain.service.ts
Manages public workspace domains (e.g., app.workspace.com). Coordinates subdomain and custom domain creation.

---

## record-position

### RecordPositionService
file: record-position/services/record-position.service.ts
Manages record ordering/positioning within lists. Implements optimistic locking via RecordPositionEntity with last seen position for concurrent update handling.

---

## record-transformer

### RecordInputTransformerService
file: record-transformer/services/record-input-transformer.service.ts
Transforms record input before database persistence. Handles field type conversions (e.g., email to lowercase, rich text normalization).

---

## redis-client

### RedisClientService
file: redis-client/redis-client.service.ts:10

**getClient** → IORedis
Returns singleton Redis client for standard operations. Initializes on first call with REDIS_URL config.

**getQueueClient** → IORedis
Returns Redis client optimized for BullMQ job queues (maxRetriesPerRequest: null). Uses REDIS_QUEUE_URL if configured, falls back to REDIS_URL.

**getPubSubClient** → RedisPubSub
Returns GraphQL Redis subscription client for WebSocket subscriptions. Duplicates getClient connection for pub/sub.

**onModuleDestroy** → Promise<void>
Lifecycle hook that gracefully closes all Redis connections on app shutdown.

---

## sdk-client

### SdkClientGenerationService
file: sdk-client/sdk-client-generation.service.ts
Generates TypeScript SDK from GraphQL schema. Creates package structure, types, and client library for external API consumers.

### SdkClientArchiveService
file: sdk-client/sdk-client-archive.service.ts
Archives generated SDK versions for distribution (npm, etc.).

---

## session-storage

### SessionStorageService
Session management for authentication flows (OIDC state, SAML state, etc.). Stores opaque session data in Redis or memory.

---

## sql-sanitization

### SqlSanitizationModule
Utilities for preventing SQL injection in dynamic queries. Whitelist/blacklist patterns for safe identifiers.

---

## sso

### SSOService
file: sso/services/sso.service.ts:29

**createOIDCIdentityProvider** → Promise<{id, type, name, status, issuer}>
Validates SSO entitlement, discovers OIDC issuer metadata, saves identity provider config. Returns id and public fields.

**createSAMLIdentityProvider** → Promise<{id, type, name, issuer, status}>
Saves SAML identity provider config (SSO URL, certificate, fingerprint). Builds SAML-specific issuer URL for metadata.

**findSSOIdentityProviderById** → Promise<SSOConfiguration & WorkspaceSSOIdentityProviderEntity | null>
Retrieves full identity provider config by ID with workspace relation.

**buildCallbackUrl** → string
Constructs OAuth callback URL for identity provider type (e.g., /auth/oidc/callback or /auth/saml/callback/{id}).

**buildIssuerURL** → string
Constructs login initiation URL pointing to /auth/{type}/login/{id} with optional search params.

**isOIDCIdentityProvider/isSAMLIdentityProvider** → boolean (type guard)
Type guards for checking identity provider type.

**getOIDCClient** → openid-client.Client
Instantiates OpenID Client with credentials and callback URL for authorization flow.

**getAuthorizationUrlForSSO** → Promise<{id, authorizationURL, type}>
Builds authorization URL for SSO login flow including search params.

**getSSOIdentityProviders** → Promise<IdentityProvider[]>
Lists all SSO providers for workspace (public fields only).

**deleteSSOIdentityProvider** → Promise<{identityProviderId}>
Soft-deletes identity provider.

**editSSOIdentityProvider** → Promise<{id, type, issuer, name, status}>
Updates identity provider fields. Validates workspace ownership.

---

## telemetry

### TelemetryService
file: telemetry/telemetry.service.ts:16

**publish** → Promise<{success: boolean}>
Sends telemetry events to Twenty telemetry server (https://twenty-telemetry.com) if TELEMETRY_ENABLED. Includes action and event batch. Returns success indicator.

---

## throttler

### ThrottlerService
file: throttler/throttler.service.ts:12

**tokenBucketThrottleOrThrow** → Promise<number>
Token bucket rate limiter. Calculates available tokens based on refill rate and time elapsed, throws ThrottlerException if insufficient tokens, otherwise deducts tokens and stores state. Returns remaining tokens.

**consumeTokens** → Promise<void>
Consumes tokens without validation (always succeeds). Used for tracking without rate limiting.

**getAvailableTokensCount** → Promise<number>
Calculates current available tokens without modifying state. Used for status queries.

---

## user-workspace

### UserWorkspaceService
file: user-workspace/user-workspace.service.ts:46
Extends TypeOrmQueryService<UserWorkspaceEntity>. Manages user-workspace associations and workspace member profiles.

**updateUserWorkspaceLocaleForUserWorkspace** → Promise<void>
Updates locale preference for user in specific workspace. Invalidates core entity cache after update.

**create** → Promise<UserWorkspaceEntity>
Creates user-workspace record with computed default avatar URL (copied from existing workspace or uploaded from picture URL). Returns new entity.

**createWorkspaceMember** → Promise<void>
Creates workspace-member standard object record in workspace-specific ORM. Maps User fields to WorkspaceMember fields (name, email, locale, avatar).

**addUserToWorkspaceIfUserNotInWorkspace** → Promise<void>
Idempotent addition of user to workspace. Creates user-workspace record, workspace member, assigns default/specified role, marks profile as pending if not existing user.

**checkUserWorkspaceExists** → Promise<UserWorkspaceEntity | null>
Checks if user-workspace relationship exists by userId and workspaceId.

**checkUserWorkspaceExistsByEmail** → Promise<boolean>
Existence check by user email and workspaceId.

**findFirstWorkspaceByUserId** → Promise<WorkspaceEntity>
Returns earliest created workspace for user (by createdAt). Throws if no workspaces found.

**countUserWorkspaces** → Promise<number>
Returns count of workspaces user is member of (excluding soft-deleted).

**deleteUserWorkspace** → Promise<void>
Deletes user-workspace record. Supports soft-delete flag for logical deletion. Cascades to role targets.

**findAvailableWorkspacesByEmail** → Promise<{availableWorkspacesForSignIn, availableWorkspacesForSignUp}>
Resolves workspaces user can access: existing memberships (SignIn), + approved domain matches + invitations (SignUp). Filters duplicates.

**getUserWorkspaceForUserOrThrow** → Promise<UserWorkspaceEntity>
Retrieves user-workspace with optional relation loading (default: twoFactorAuthenticationMethods). Throws if not found.

**getWorkspaceMemberOrThrow** → Promise<WorkspaceMemberWorkspaceEntity>
Retrieves workspace member record by workspace-member ID in specified workspace. Throws if not found.

**castWorkspaceToAvailableWorkspace** → Promise<AvailableWorkspace>
Transforms WorkspaceEntity to DTO for auth flows. Includes workspace URLs, logo (signed), and active SSO providers.

**setLoginTokenToAvailableWorkspacesWhenAuthProviderMatch** → Promise<{availableWorkspacesForSignUp, availableWorkspacesForSignIn}>
Generates login tokens for available workspaces when auth provider is enabled. Includes invitation token for signup workspaces.

**getActiveUserWorkspaceCountTotal** → Promise<number>
Returns count of all non-deleted user-workspace records (minimum 1 for analytics).

---

## workspace

### WorkspaceService
file: workspace/services/workspace.service.ts:81
Extends TypeOrmQueryService<WorkspaceEntity>. Manages workspace lifecycle, configuration, and multi-tenancy.

**activateWorkspace** → Promise<WorkspaceEntity>
Transitions workspace from PENDING_CREATION to ACTIVE. Creates initial workspace schema, runs migrations, prefills demo data (companies, people, opportunities, workflows), sets up default feature flags.

**updateWorkspace** → Promise<WorkspaceEntity>
Updates workspace fields with permission checks (subdomain, display name, logo, domain, retention settings, auth settings). Validates custom domain changes via DnsManagerService.

**deleteWorkspace** → Promise<void>
Soft-deletes workspace (cascades to users, workspace members, records). Triggers cleanup jobs (file folder deletion, emailing domain cleanup).

**getWorkspaceCount** → Promise<number>
Returns count of non-deleted workspaces.

### WorkspaceGaugeService
file: workspace/services/workspace-gauge.service.ts
Observability service. Creates OpenTelemetry gauge metrics for workspace counts (total, active, suspended) for dashboard monitoring.

### WorkspaceEntityCacheProviderService
file: workspace/services/workspace-entity-cache-provider.service.ts
Caches workspace entity in core entity cache for fast lookups during request processing.

---

## workspace-invitation

### WorkspaceInvitationService
file: workspace-invitation/services/workspace-invitation.service.ts:43

**validatePersonalInvitation** → Promise<{isValid: true, workspace: WorkspaceEntity}>
Validates personal invitation token: checks token exists, matches email in context, not expired. Throws AuthException if invalid.

**findInvitationsByEmail** → Promise<AppTokenEntity[]>
Finds all non-expired invitations for email across all workspaces using SQL JSON query (appToken.context->>'email').

**getOneWorkspaceInvitation** → Promise<AppTokenEntity | null>
Finds single invitation for email in specific workspace.

**getAppTokenByInvitationToken** → Promise<AppTokenEntity>
Retrieves invitation token entity. Throws WorkspaceInvitationException if not found.

**loadWorkspaceInvitations** → Promise<WorkspaceInvitation[]>
Loads all pending invitations for workspace (non-deleted, non-expired). Excludes token value from select for security.

**createWorkspaceInvitation** → Promise<AppTokenEntity>
Creates invitation token for email. Validates email not already invited/in workspace. Generates random token, sets expiration per config.

**deleteWorkspaceInvitation** → Promise<'success' | 'error'>
Soft-deletes invitation token by ID.

**invalidateWorkspaceInvitation** → Promise<void>
Deletes invitation for specific workspace and email. Used when user accepts invitation or email is already added.

**resendWorkspaceInvitation** → Promise<SendInvitationsDTO>
Deletes old invitation, creates new token, sends invitation email.

**sendInvitations** → Promise<SendInvitationsDTO>
Batch sends invitations to emails. Creates tokens, generates workspace-specific links, sends React Email template via EmailService. Marks onboarding invite step complete on success, sets booking step pending.

**generateInvitationToken** → Promise<AppTokenEntity>
Creates AppToken entity with InvitationToken type, random value, expiration, and context (email, roleId). Persists to database.

**throttleInvitationSending** → Promise<void>
Rate limits invitation sends per email and per workspace using ThrottlerService token bucket. Throws ThrottlerException if limits exceeded.

---

## NOT YET COVERED

Due to the large volume of files (561 total .ts files across 47 modules), the following sub-directories and files have not been fully documented in this pass. These should be covered in follow-up documentation waves:

- Complete services in: email-sender, imap-smtp-caldav-connection (additional services), code-interpreter (additional drivers)
- All GraphQL resolvers not yet covered
- Additional utility functions and private service methods in existing modules
- Configuration and factory classes across all modules
- All exception and validation classes
- Integration tests and mock utilities

To complete documentation: scan remaining .ts files in each module, focusing on exported functions, public service methods, and command/query handlers.

