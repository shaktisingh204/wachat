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

## email (additional)

### EmailSenderService
file: email/email-sender.service.ts:10
Implements `EmailDriverInterface`. **send(sendMailOptions)** → Promise<void> resolves the current driver via `EmailDriverFactory.getCurrentDriver()` and delegates the actual send. This is the worker-side counterpart of `EmailService.send` (which only enqueues).

### EmailSenderJob
file: email/email-sender.job.ts:9
`@Processor(MessageQueue.emailQueue)` BullMQ processor. **handle(data: SendMailOptions)** → Promise<void> is the `@Process(EmailSenderJob.name)` consumer that pops a queued email payload and forwards it to `EmailSenderService.send`. This is how `EmailService.send`'s enqueued jobs are actually dispatched.

### EmailDriverFactory
file: email/email-driver.factory.ts:14
Extends `DriverFactoryBase<EmailDriverInterface>` — caches a driver instance keyed by a config hash.
**buildConfigKey()** (protected) → string returns `'logger'` for `EmailDriver.LOGGER`, or `smtp|<EMAIL_SETTINGS hash>` for SMTP (so SMTP credential changes bust the cache); throws on unsupported driver.
**createDriver()** (protected) → EmailDriverInterface instantiates `LoggerDriver` or builds an `SmtpDriver` from `EMAIL_SMTP_HOST/PORT/USER/PASSWORD/NO_TLS` (requires host+port; adds auth only when user+pass present; sets `secure:false, ignoreTLS:true` when NO_TLS).

### SmtpDriver
file: email/drivers/smtp.driver.ts:13
Constructs a Nodemailer transport from `SMTPConnection.Options`. **send()** fire-and-forgets `transport.sendMail` — logs success/error rather than awaiting, so a failing SMTP send never rejects the caller.

### LoggerDriver
file: email/drivers/logger.driver.ts:7
Dev/test driver. **send()** logs the full message (to/from/subject/text/html) via NestJS `Logger` instead of sending anything.

---

## imap-smtp-caldav-connection (additional)

### ImapSmtpCaldavService
file: imap-smtp-caldav-connection/services/imap-smtp-caldav-connection.service.ts:23

**testImapConnection(handle, params)** → Promise<boolean>
Resolves+validates the host through `SecureHttpClientService.getValidatedHost` (SSRF guard), opens an `ImapFlow` client (TLS, `rejectUnauthorized:false`), attaches an `error` listener (ImapFlow crashes the process otherwise), connects and lists mailboxes. Maps `authenticationFailed` / `ECONNREFUSED` / generic errors to localized `UserInputError`s; always logs out in `finally`.

**testSmtpConnection(handle, params)** → Promise<boolean>
Validates host, creates a Nodemailer transport and calls `transport.verify()`; throws a localized `UserInputError` on failure.

**testCaldavConnection(handle, params)** → Promise<boolean>
Builds a CalDAV client via `CalDavClientService.getClient`, lists event-capable calendars via `CalDavFetchEventsService.listEventCalendars`; throws if zero calendars or on socket/credential errors (re-throws existing `UserInputError`).

**testImapSmtpCaldav({handle, params, accountType})** → Promise<boolean>
Short-circuits to `true` when `IS_IMAP_SMTP_CALDAV_CONNECTION_TEST_ENABLED` is off; otherwise switches to the protocol-specific test (`assertUnreachable` for exhaustiveness).

**validateAndTestConnectionParameters({connectionParameters, handle, existingConnectionParameters})** → Promise<PlaintextImapSmtpCaldavParams>
Iterates `ACCOUNT_TYPES` (IMAP/SMTP/CALDAV); for each present protocol validates via `ImapSmtpCaldavValidatorService.validateProtocolConnectionParams` (carrying over the previously-decrypted password), live-tests it, and accumulates validated plaintext params for persistence.

### ImapSmtpCaldavValidatorService
file: imap-smtp-caldav-connection/services/imap-smtp-caldav-connection-validator.service.ts:14
**validateProtocolConnectionParams({params, existingProtocolParams})** → Promise<PlaintextConnectionParameters>
Picks `connectionParametersUpdateSchema` (when editing) vs `connectionParametersSchema` (when new) and zod-`safeParse`s the input; rolls all issues into one `UserInputError`. Runs the host through `SecureHttpClientService.getValidatedHost` to block private/internal addresses. Falls back to the existing decrypted password when the user didn't supply a new one; throws if no password resolves.

### ImapSmtpCaldavResolver
file: imap-smtp-caldav-connection/imap-smtp-caldav-connection.resolver.ts:31
Guarded by `WorkspaceAuthGuard` + `SettingsPermissionGuard(CONNECTED_ACCOUNTS)`.
**getConnectedImapSmtpCaldavAccount(id)** → Query<ConnectedImapSmtpCaldavAccountDTO>: loads the connected account scoped to the user-workspace, asserts it is an `IMAP_SMTP_CALDAV` provider, and returns it with passwords stripped via `buildPublicConnectionParameters`.
**saveImapSmtpCaldavAccount(handle, connectionParameters, id?)** → Mutation<ImapSmtpCaldavConnectionSuccessDTO>: for edits, loads+decrypts the existing account's params; validates+live-tests the new params; upserts the connected account via `ImapSmtpCalDavAPIService.upsertConnectedAccount`; returns `{success, connectedAccountId}`.

### buildPublicConnectionParameters
file: imap-smtp-caldav-connection/utils/build-public-connection-parameters.util.ts:19
**buildPublicConnectionParameters(connectionParameters)** → PublicConnectionParameters | null
Reduces over `ACCOUNT_TYPES`, copying each protocol's params while destructuring out (dropping) the `password` field — produces the API-safe view of IMAP/SMTP/CALDAV settings.

---

## code-interpreter (additional)

### CodeInterpreterDriverFactory
file: code-interpreter/code-interpreter-driver.factory.ts:16
Extends `DriverFactoryBase<CodeInterpreterDriver>`.
**buildConfigKey()** (protected): `e2b|<CODE_INTERPRETER_CONFIG hash>` for E2B, else the raw driver-type string.
**createDriver()** (protected): returns `DisabledDriver` (with a guidance message) when DISABLED, or when LOCAL is selected in `NODE_ENV=PRODUCTION` (LOCAL is unsafe in prod); returns `LocalDriver({timeoutMs})` for LOCAL in dev; returns `E2BDriver({apiKey, timeoutMs})` for E2B (throws if `E2B_API_KEY` missing).

### LocalDriver
file: code-interpreter/drivers/local.driver.ts:43
UNSAFE dev-only Python sandbox (no isolation). **execute(code, files?, context?, callbacks?)** → Promise<CodeExecutionResult>: makes a tmp workdir + `output/` + `scripts/` (recursively copies bundled `sandbox-scripts`), writes input files (basename-sanitized), rewrites E2B-style `/home/user/...` paths to local paths, writes `script.py`, then `runPythonScript` spawns `python3` with `OUTPUT_DIR` env, streams stdout/stderr line-by-line through callbacks, SIGKILLs on timeout, and reads back any files in `output/` (mime-typed via `getMimeType`); always `rm -rf`s the workdir in `finally`.
**copyDirectoryRecursive(src, dest)** (module-level): recursive directory copy helper used to seed the sandbox scripts.

### E2BDriver
file: code-interpreter/drivers/e2b.driver.ts:47
Cloud sandbox driver. **execute(...)** creates an `@e2b/code-interpreter` `Sandbox`, uploads bundled scripts + input files, prepends a generated `os.environ[...]` setup block (values shell-escaped) from `context.env`, runs the code streaming stdout/stderr and collecting inline `result.png` charts plus any files in `/home/user/output`; returns joined logs, `exitCode` (1 if `execution.error`), output files, and error value; always `sbx.kill()` in `finally`.
**uploadDirectoryToSandbox(sbx, localPath, remotePath)** (module-level): recursively uploads a local dir into the sandbox filesystem.

### DisabledDriver
file: code-interpreter/drivers/disabled.driver.ts:9
**execute(...)** unconditionally throws the configured `reason` string — used when code execution is turned off or LOCAL is blocked in prod.

### getMimeType
file: code-interpreter/utils/get-mime-type.util.ts:13
**getMimeType(filename)** → string: maps the lowercased extension to a MIME type from a small table (png/jpg/csv/xlsx/pptx/pdf/json/txt), defaulting to `application/octet-stream`.

---

## email-verification (additional)

### EmailVerificationService
file: email-verification/services/email-verification.service.ts:33

**sendVerificationEmail({userId, email, workspace, locale, verifyEmailRedirectPath?, verificationTrigger?})** → Promise<{success}>
No-ops (returns `{success:false}`) unless `IS_EMAIL_VERIFICATION_REQUIRED`. Generates a verification token via `EmailVerificationTokenService.generateToken`, builds the `VerifyEmail` link against the workspace URL (or base URL when no workspace), renders the `SendEmailVerificationLinkEmail` React Email to html+text, localizes the subject (different copy for EMAIL_UPDATE vs SIGN_UP) via `I18nService`, and sends through `EmailService`.

**resendEmailVerificationToken(email, workspace, locale)** → Promise<{success}>
Throws `EMAIL_VERIFICATION_NOT_REQUIRED` when the feature is off. Loads the user, throws `EMAIL_ALREADY_VERIFIED` if verified. Enforces a 1-minute cooldown against any existing token (throws `RATE_LIMIT_EXCEEDED` with a human-readable wait), deletes the old token, then re-sends a SIGN_UP verification email.

### EmailVerificationResolver
file: email-verification/email-verification.resolver.ts:22
`@PublicEndpointGuard` + `NoPermissionGuard` (currently unauthenticated, flagged as a TODO).
**resendEmailVerificationToken(input, origin, context)** → Mutation<ResendEmailVerificationTokenDTO>: resolves the workspace from `origin` via `WorkspaceDomainsService.getWorkspaceByOriginOrDefaultWorkspace`, then delegates to the service using the request locale.

---

## client-config (additional)

### ClientConfigService
file: client-config/services/client-config.service.ts:27
**getClientConfig()** → Promise<ClientConfig>
Assembles the entire runtime config the frontend bootstraps from: app version; billing flags + the two trial-period variants (with/without credit card); the full AI model catalog (`AiModelRegistryService.getAdminFilteredModels` enriched with per-model cost/context/capability metadata, then unshifting the two synthetic "auto-select smart/fast" entries from the default performance/speed models); auth providers (google/microsoft/password, magicLink hardcoded false); multiworkspace/email-verification flags; front domain; support driver; Sentry DSN/release/env; captcha provider+siteKey; API mutation cap; many feature toggles (Microsoft/Google messaging+calendar, IMAP/SMTP/CalDAV, config-in-DB, attachment preview, analytics, ClickHouse, DDL lock); `canManageFeatureFlags` (dev OR billing enabled); `isEmailGroupEnabled` (S3 storage + inbound email domain); `isCloudflareIntegrationEnabled` (private helper checks API key + zone id). Finally merges maintenance-window data from `MaintenanceModeService.getMaintenanceMode` when present.
**isCloudflareIntegrationEnabled()** (private) → boolean: true only when both `CLOUDFLARE_API_KEY` and `CLOUDFLARE_ZONE_ID` are set.

### ClientConfigController
file: client-config/client-config.controller.ts:9
`@Controller('/client-config')`, `@PublicEndpointGuard`. **getClientConfig()** → `GET /client-config` REST passthrough to `ClientConfigService.getClientConfig` (unauthenticated bootstrap endpoint).

### ClientConfigResolver
file: client-config/client-config.resolver.ts:20
`@CoreResolver`, guarded by Workspace+User auth. **isMaintenanceModeBannerDismissed(user, workspace)** → Query<boolean> and **dismissMaintenanceModeBanner(user, workspace)** → Mutation<boolean> proxy `MaintenanceModeService` per-user-per-workspace banner state.

---

## cloudflare (additional)

### DnsCloudflareService
file: cloudflare/services/dns-cloudflare.service.ts:10
**checkHostname(hostname)** → Promise<void>
Cloudflare custom-hostname webhook handler. Resolves the hostname to a workspace custom domain (`WorkspaceDomainsService.findByCustomDomain` → `CustomDomainManagerService.checkCustomDomainValidRecords`) and/or a public domain (`PublicDomainService.findByDomain` → `checkPublicDomainValidRecords`), refreshing validation state when the hostname's DNS becomes active.

---

## dns-manager (additional — full method coverage)

### DnsManagerService
file: dns-manager/services/dns-manager.service.ts:26
Enterprise-licensed. Lazily constructs a `Cloudflare` client when `CLOUDFLARE_API_KEY` is set; all mutating methods first assert it via `dnsManagerValidator.isCloudflareInstanceDefined`.

**registerHostname(customDomain, options?)** → creates a Cloudflare custom hostname (with TXT-based DV SSL params); throws `HOSTNAME_ALREADY_REGISTERED` if it exists.
**getHostnameWithRecords(domain, options?)** → DomainValidRecords | undefined: returns the redirection (CNAME → base/public domain) and SSL (ACME challenge CNAME, using DCV delegation records when available) records with computed statuses; throws `MISSING_PUBLIC_DOMAIN_URL` if a public-domain lookup lacks a configured public domain URL.
**updateHostname(fromHostname, toHostname, options?)** → deletes the old hostname (if present) then registers the new one.
**refreshHostname(hostname, options?)** → re-issues SSL by calling `customHostnames.edit` with fresh SSL params; returns the records.
**deleteHostnameSilently(hostname, options?)** → best-effort delete that swallows errors.
**isHostnameWorking(hostname, options?)** → boolean: true only when both redirection and SSL statuses are `success`.
**getHostnameId(hostname, options?)** → the Cloudflare custom-hostname id, or undefined.
**deleteHostname(customHostnameId, options?)** → deletes by Cloudflare id in the correct zone.
**sslParams** (private getter) → the standardized DV/TXT SSL config (http2/early-hints on, min TLS 1.2, TLS 1.3, cipher list).
**getZoneId(options?)** (private) → picks `CLOUDFLARE_PUBLIC_DOMAIN_ZONE_ID` vs `CLOUDFLARE_ZONE_ID` based on `isPublicDomain`.
**getHostnameDetails(hostname, options?)** (private) → single Cloudflare hostname record; returns undefined for none, throws `MULTIPLE_HOSTNAMES_FOUND` for >1.
**getHostnameStatuses(customHostname)** (private) → `{redirection, ssl}` status strings, treating the first 10s after creation as `pending` and mapping Cloudflare verification errors/SSL states.

---

## geo-map (additional)

### GeoMapService
file: geo-map/services/geo-map.service.ts:14
Caches `GOOGLE_MAP_API_KEY` in the constructor only when `IS_MAPS_AND_ADDRESS_AUTOCOMPLETE_ENABLED` and the key are set (otherwise the service is effectively inert).
**getAutoCompleteAddress(address, token, country?, isFieldCity?)** → builds a Google Places autocomplete URL (optional `components=country:` and `types=(cities)` filters), fetches via the SSRF-safe HTTP client, and returns `sanitizeAutocompleteResults` on `status==='OK'` (else `[]`).
**getAddressDetails(placeId, token)** → fetches Google Place Details (address_components + geometry) and returns `sanitizePlaceDetailsResults` on OK (else `{}`).

### GeoMapResolver
file: geo-map/resolver/geo-map.resolver.ts:13
`WorkspaceAuthGuard` + `NoPermissionGuard`. **getAutoCompleteAddress(...)** and **getAddressDetails(...)** are thin GraphQL queries over the matching service methods.

### sanitizeAutocompleteResults
file: geo-map/utils/sanitize-autocomplete-results.util.ts:6
Maps Google predictions to `{text: description, placeId: place_id}`; `[]` for empty input.

### sanitizePlaceDetailsResults
file: geo-map/utils/sanitize-place-details-results.util.ts:12
Folds Google `address_components` into Twenty address fields (street from street_number+route, postcode + suffix, city from locality/postal_town/admin_level_3, state from admin_level_1/2, country short_name) and attaches the lat/lng `location`.

---

## guard-redirect (additional)

### GuardRedirectService
file: guard-redirect/services/guard-redirect.service.ts:17
**dispatchErrorFromGuard(context, error, workspace, pathname=Verify)** → rethrows for GraphQL contexts; for HTTP, redirects the response to a workspace error URL.
**getSubdomainAndCustomDomainFromContext(context)** → derives subdomain/customDomain from the request `referer` (via `DomainServerConfigService`), falling back to `DEFAULT_SUBDOMAIN`.
**getRedirectErrorUrlAndCaptureExceptions({error, workspace, pathname})** → captures the exception then builds the redirect URL through `WorkspaceDomainsService.computeWorkspaceRedirectErrorUrl`.
**captureException(err, workspaceId?)** (private) → forwards to `ExceptionHandlerService` but skips non-internal `AuthException`s (expected auth failures aren't reported to Sentry).

---

## messaging (additional — full coverage)

### TimelineMessagingService
file: messaging/services/timeline-messaging.service.ts:21
**getAndCountMessageThreads(personIds, workspaceId, offset, pageSize)** → paginated message threads (without participant/visibility fields) + total count, executed inside a system workspace-ORM context.
**getThreadParticipantsByThreadId(...)** → groups message participants by thread id (with person/workspaceMember relations) for display.
**getThreadVisibilityByThreadId(...)** → resolves each thread's `MessageChannelVisibility` based on whether the requesting member owns the connected message channel.

### GetMessagesService
file: messaging/services/get-messages.service.ts:13
**getMessagesFromPersonIds(workspaceMemberId, personIds, workspaceId, page=1, pageSize)** → `TimelineThreadsWithTotalDTO`: pages threads via `TimelineMessagingService.getAndCountMessageThreads`, then enriches with participant summaries and visibility-gated subject/body via `formatThreads`.
**getMessagesFromCompanyId(...)** → resolves a company to its person ids, then delegates to the person-ids path.
**getMessagesFromOpportunityId(...)** → resolves opportunity → company → persons, then fetches messages.

### TimelineMessagingResolver
file: messaging/timeline-messaging.resolver.ts:65
**getTimelineThreadsFromPersonId / FromCompanyId / FromOpportunityId** → paginated `TimelineThreadsWithTotalDTO` queries over `GetMessagesService`.
**dismissReconnectAccountBanner(input)** → Mutation<boolean> that persists per-member dismissal of the "reconnect your account" banner.

### formatThreads
file: messaging/utils/format-threads.util.ts:9
Drops threads with no participants, then attaches participant summary fields and applies visibility gating: subject shown for SHARE_EVERYTHING|SUBJECT, body only for SHARE_EVERYTHING — otherwise replaced with `FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED`.

### extractParticipantSummary
file: messaging/utils/extract-participant-summary.util.ts:6
From a thread's participants returns `{firstParticipant, lastTwoParticipants, participantCount}` (de-duplicating first/last by handle) for compact timeline display.

### filterActiveParticipants
file: messaging/utils/filter-active-participants.util.ts:5
Keeps only participants with `MessageParticipantRole.FROM` (the senders).

### formatThreadParticipant
file: messaging/utils/format-thread-participant.util.ts:6
Maps a `MessageParticipantWorkspaceEntity` to a `TimelineThreadParticipantDTO`, resolving name/avatar from the linked person, then workspace member, then raw handle; throws if the handle is empty.

---

## metrics (additional)

### MetricsCacheService
file: metrics/metrics-cache.service.ts:12
Time-bucketed set-based event counter on the `EngineMetrics` cache namespace; buckets are 15s wide and TTL is twice the configured health window.
**updateCounter(key, items)** → adds event ids to the current 15s bucket's Redis set.
**computeCount({key, timeWindowInSeconds, date})** → sums set cardinality across all 15s buckets in the window (requires the window be divisible by 15s) for sliding-window metrics.
**computeTimeStampedCacheKeys(key, cacheBucketsCount, date)** → the list of bucket cache keys for a window. Private helpers `getCacheBucketStartTimestamp`, `getCacheKeyWithTimestamp`, `getLastCacheBucketStartTimestampsFromDate` implement the bucketing math.

---

## public-domain (additional — full method coverage)

### PublicDomainService
file: public-domain/public-domain.service.ts:22
**createPublicDomain({domain, workspace, applicationId})** → registers a Cloudflare hostname (public-domain zone) then inserts a `PublicDomainEntity`; throws if the domain is already a custom domain, already a public domain, or the application doesn't exist.
**updatePublicDomainApplication({domain, workspace, applicationId})** → reassigns which application a public domain points at; validates both domain and application exist.
**deletePublicDomain({domain, workspace})** → silently deletes the Cloudflare hostname then removes the row.
**checkPublicDomainValidRecords(publicDomain, domainValidRecords?)** → fetches/uses DNS records, flips `isValidated` to match `DnsManagerService.isHostnameWorking`, persists if changed, returns the records.
**findByDomain(domain)** → unscoped lookup (used during request routing before workspace context exists).

### PublicDomainResolver
file: public-domain/public-domain.resolver.ts:40
Guarded by `WorkspaceAuthGuard` + `SettingsPermissionGuard(WORKSPACE_MEMBERS)`.
**findManyPublicDomains** → Query lists workspace public domains.
**createPublicDomain / updatePublicDomain / deletePublicDomain** → Mutations over the matching service methods.
**checkPublicDomainValidRecords(input)** → Mutation that asserts the domain exists, calls `DnsManagerService.refreshHostname`, then `PublicDomainService.checkPublicDomainValidRecords`.

---

## record-position (additional — full method coverage)

### RecordPositionService
file: record-position/services/record-position.service.ts:19
Computes fractional list ordering positions, always running inside a system workspace-ORM context with permission checks bypassed.
**buildRecordPosition({objectMetadata, value, workspaceId, index})** → number: returns numeric `value` as-is; for `'first'` returns `minPosition - index - 1` (or 1 if empty); for `'last'` returns `maxPosition + index + 1`.
**overridePositionOnRecords({partialRecordInputs, workspaceId, objectMetadata, shouldBackfillPositionIfUndefined})** → buckets inputs into first/last/existing-number/no-update sets (undefined positions go "first" when backfill is on), computes batch min/max against existing records, assigns sequential positions, and returns the recombined list. No-ops if the object has no `position` field.
**findByPosition(positionValue, objectMetadata, workspaceId)** → `{id, position}` of the record at an exact position, or null.
**updatePosition(recordId, positionValue, objectMetadata, workspaceId)** → writes a new position.
Private **findMinPosition / findMaxPosition** use repository `minimum/maximum('position')` (sanitized via `sanitizeNumber`).

---

## record-transformer (additional — full coverage)

### RecordInputTransformerService
file: record-transformer/services/record-input-transformer.service.ts:21
**process({recordInput, flatObjectMetadata, flatFieldMetadataMaps})** → Partial<ObjectRecord>: for each input field, resolves its field metadata, then `stringifySubFields` → `transformFieldValue` → `parseSubFields`, copying unknown fields through unchanged. RAW_JSON composite sub-fields are stringified before transform and re-parsed after.
**transformFieldValue(fieldType, value)** (private) → dispatches by `FieldMetadataType`: UUID `''→null`, NUMBER coerced via `Number`, RICH_TEXT/LINKS/EMAILS/PHONES via their util transforms, else passthrough.

### transformRichTextValue
file: record-transformer/utils/transform-rich-text.util.ts
Async. Lazily creates and caches a single `ServerBlockNoteEditor` (via a `new Function('import()')` native import to dodge SWC's CJS rewrite), then computes the missing direction of the markdown↔blocknote pair (markdown→blocks, blocks→lossy-markdown), tolerating conversion failures by falling back to the raw value.

### transformEmailsValue
file: record-transformer/utils/transform-emails-value.util.ts:4
Lowercases `primaryEmail` and every entry of `additionalEmails` (parsing the JSON array), returning nulls when empty.

### transformLinksValue
file: record-transformer/utils/transform-links-value.util.ts
Parses `secondaryLinks` JSON, runs `removeEmptyLinks` (validates URLs, promotes the first link to primary), normalizes URL origins via `normalizeUrlOrigin`, and re-serializes secondary links (null when empty).

### removeEmptyLinks
file: record-transformer/utils/remove-empty-links.ts
Filters out blank links, validates every remaining URL (`isValidUrl`, else throws `INVALID_URL`), and splits the list into `{primaryLinkUrl, primaryLinkLabel, secondaryLinks}` (first link becomes primary).

### transformPhonesValue
file: record-transformer/utils/transform-phones-value.util.ts
Validates+infers primary and additional phones with `libphonenumber-js`: cross-checks supplied vs inferred country/calling codes (throwing the various `CONFLICTING_*`/`INVALID_*` `RecordTransformerException`s), derives missing country/calling codes from the parsed number, and re-serializes `additionalPhones` (null when empty). Module helpers: `validatePrimaryPhoneCountryCodeAndCallingCode`, `parsePhoneNumberExceptionWrapper`, `validateAndInferMetadataFromPrimaryPhoneNumber`, `validateAndInferPhoneInput`.

### recordTransformerGraphqlApiExceptionHandler
file: record-transformer/utils/record-transformer-graphql-api-exception-handler.util.ts
Re-throws every `RecordTransformerExceptionCode` (phone/url validation codes) as a GraphQL `UserInputError`; `assertUnreachable` enforces exhaustiveness.

---

## secret-encryption

### SecretEncryptionService
file: secret-encryption/secret-encryption.service.ts:24
Two-tier secret encryption: legacy unversioned AES-CTR and the modern versioned `enc:v2` AES-256-GCM envelope.
**encrypt(value)** / **decrypt(value)** → legacy AES-CTR using the primary resolved key (no integrity tag; intentionally unbranded for pre-envelope callers).
**encryptVersioned(value, {workspaceId?})** → EncryptedString: GCM-encrypts with an HKDF-derived per-workspace (or instance) key and wraps as `enc:v2:<keyId>:<payload>`.
**decryptVersioned(value, {workspaceId?})** → PlaintextString: parses the envelope; for v2 picks the key by `keyId` (supports rotation via fallback key) and GCM-decrypts; for legacy values logs a one-time warning and falls back to CTR decrypt.
**decryptAndMask({value, mask})** / **decryptAndMaskVersioned({value, mask, workspaceId?})** → decrypts then masks via `maskDecryptedValue`.
**maskDecryptedValue(decryptedValue, mask)** (private) → reveals at most `min(5, len/10)` leading chars then appends the mask.
**warnLegacyCtrDecryptionOnce()** (private) → emits the legacy-decryption migration warning exactly once.

### Crypto utils
**encryptAesGcmV2 / decryptAesGcmV2OrThrow** (utils/encrypt-aes-gcm-v2.util.ts, decrypt-aes-gcm-v2-or-throw.util.ts) → AES-256-GCM with a random 12-byte IV; payload layout is `IV || ciphertext || authTag` base64. Decrypt validates length and throws `CIPHERTEXT_TOO_SHORT` / GCM auth failures.
**encryptAesCtr / decryptAesCtrOrThrow** (utils/encrypt-aes-ctr.util.ts, decrypt-aes-ctr-or-throw.util.ts) → legacy AES-256-CTR; key is `sha512(rawKey).hex[:32]`, IV is 16 random bytes prepended; `OrThrow` only covers malformed-input errors (CTR has no integrity check).
**deriveGcmKey({rawKey, workspaceId?})** (utils/derive-gcm-key.util.ts) → HKDF-SHA256 32-byte key with info `<HKDF_INFO_PREFIX><workspaceId | INSTANCE_CONTEXT>`, zero salt — gives per-workspace key separation.
**deriveInstanceHmacKey({rawKey, purpose})** (utils/derive-instance-hmac-key.util.ts) → HKDF-SHA256 key scoped by a purpose string (used for session-cookie signing).
**computeEncryptionKeyId({rawKey})** (utils/compute-encryption-key-id.util.ts) → first 8 hex chars of `sha256(rawKey)`; identifies which key encrypted a row.
**resolveEncryptionKeysOrThrow({environmentConfigDriver})** (utils/resolve-encryption-keys-or-throw.util.ts) → `{primary, fallback}` from `ENCRYPTION_KEY` (or legacy `APP_SECRET`) + optional `FALLBACK_ENCRYPTION_KEY`; throws `NO_ENCRYPTION_KEY_CONFIGURED` if none.
**pickEncryptionKeyByKeyIdOrThrow({keyId, keys})** (utils/pick-encryption-key-by-key-id-or-throw.util.ts) → returns the primary or fallback key whose id matches; throws `UNKNOWN_KEY_ID` otherwise (rotation guidance).
**formatSecretEncryptionEnvelopeV2 / parseSecretEncryptionEnvelopeOrThrow** (utils) → build/parse the `enc:v2:<keyId>:<payload>` string; parse returns `{version:null}` for non-enveloped values and throws `MALFORMED_ENVELOPE` / `INVALID_KEY_ID_FORMAT` / `UNKNOWN_ENVELOPE_VERSION` for malformed ones.
**resolveSessionCookieSecretsOrThrow({twentyConfigService})** (utils/resolve-session-cookie-secrets.util.ts) → ordered list of express-session signing secrets: HKDF-derived from primary key, then fallback key, then the legacy `sha256(APP_SECRET + 'SESSION_STORE_SECRET')` — supports rotation while still verifying old cookies.
**isEncryptedString(value)** (branded-strings/is-encrypted-string.util.ts) → type guard: true when the value starts with the envelope prefix.

---

## secure-http-client

### SecureHttpClientService
file: secure-http-client/secure-http-client.service.ts:24
SSRF-hardened outbound HTTP. **getHttpClient(config?, context?)** → AxiosInstance: when `OUTBOUND_HTTP_SAFE_MODE_ENABLED`, attaches SSRF-safe http/https agents, caps redirects at 5, and adds an interceptor rejecting non-http(s) protocols; optionally wires `axios-retry`; logs each request with workspace/user/source when a context is supplied.
**getInternalHttpClient(config?)** → plain (unprotected) axios client for trusted internal URLs.
**createSsrfSafeFetch()** → a `fetch`-compatible function backed by the safe axios client (or the global fetch when safe mode is off).
**getValidatedHost(hostnameOrUrl)** → resolves+validates a host (returns it unchanged when safe mode off), used by IMAP/SMTP/CalDAV and geo-map before connecting.

### createSsrfSafeAgent
file: secure-http-client/utils/create-ssrf-safe-agent.util.ts:83
Returns an `http.Agent`/`https.Agent` subclass that validates the connect host and attaches a socket `lookup` handler destroying the socket if the resolved IP is private — checks run on every connection including redirect-followed ones, failing closed on unparseable IPs.

### resolveAndValidateHostname
file: secure-http-client/utils/resolve-and-validate-hostname.util.ts:5
DNS-resolves a hostname/URL and throws if the resolved IP is private; returns the resolved IP.

### isPrivateIp
file: secure-http-client/utils/is-private-ip.util.ts:100
Checks an address against a `BlockList` of private/reserved IPv4+IPv6 ranges. Normalizes IPv4 in any encoding (dotted/octal/hex/bare-integer via `normalizeToLong`) and unwraps IPv4-mapped IPv6 in both hex (`::ffff:a9fe:a9fe`) and dotted (`::ffff:127.0.0.1`) forms before checking; throws on invalid IPv4.

---

## sentry

### applyWorkspaceSentryContext
file: sentry/utils/apply-workspace-sentry-context.util.ts
Reads workspace id (and, for user/pendingActivationUser auth, the userWorkspaceId) from a `WorkspaceAuthContext` and forwards to `applyWorkspaceSentryFields`; no-ops without a workspace.

### applyWorkspaceSentryContextFromJobData
file: sentry/utils/apply-workspace-sentry-context-from-job-data.util.ts
Defensively extracts `workspaceId`/`userWorkspaceId` from arbitrary BullMQ job data and forwards to `applyWorkspaceSentryFields`.

### applyWorkspaceSentryfields
file: sentry/utils/apply-workspace-sentry-fields.util.ts
Sets the Sentry user id, `twenty.workspace.id` / `twenty.user_workspace.id` tags, and a `twenty` context block for error correlation.

---

## session-storage

### getSessionStorageOptions
file: session-storage/session-storage.module-factory.ts
Builds the express-session options: 30-minute httpOnly `sameSite:lax` cookie (secure when SERVER_URL is https), secrets from `resolveSessionCookieSecretsOrThrow`, and a Redis-backed `connect-redis` store (prefix `engine:session:`, 60s ping) created from `REDIS_URL` (throws if missing).

---

## sql-sanitization

### validateAllowedValue
file: sql-sanitization/utils/validate-allowed-value.util.ts:4
**validateAllowedValue(value, allowedValues, label)** → void: throws `Invalid <label>: <value>` unless `value` is in the allow-list — a runtime guard for strings interpolated into SQL (enum values, action keywords).

---

## sdk-client (additional — full coverage)

### SdkClientGenerationService
file: sdk-client/sdk-client-generation.service.ts:38
**enqueueSdkClientGenerationForWorkspace(...)** → enqueues a `GenerateSdkClientJob` on the workspace queue.
**generateSdkClientForApplication({...})** → generates the TypeScript SDK package for an application's schema and stores it (delegates to private `generateAndStore`).
**generateAndStore(...)** (private) → renders the SDK package structure/types and persists the archive to file storage.

### SdkClientArchiveService
file: sdk-client/sdk-client-archive.service.ts:27
**downloadAndExtractToPackage({...})** / **downloadArchiveBuffer({...})** → fetch a stored SDK archive (buffer) for distribution.
**getClientModuleFromArchive({...})** → extracts a single allowed module file from the archive (used by the controller to serve SDK modules).
**markSdkLayerFresh({...})** → marks the cached SDK layer as up to date.
**downloadArchiveBufferOrGenerate(...)** (private) → returns the existing archive or triggers generation when stale/missing.

### SdkClientController
file: sdk-client/controllers/sdk-client.controller.ts:26
**getSdkModule(applicationId, moduleName)** → `GET /:applicationId/:moduleName` serves a generated SDK module file (validated against the allowed-modules list) from the archive.

### GenerateSdkClientJob
file: sdk-client/jobs/generate-sdk-client.job.ts:11
`@Processor(MessageQueue.workspaceQueue)`. **handle(data)** → `@Process` consumer that runs `SdkClientGenerationService.generateSdkClientForApplication` for the queued application.

---

## NOT YET COVERED

Effectively complete for this lane. Genuinely-trivial leftovers (not individually documented): module classes (`*.module.ts`) that only wire providers, DTO/input/entity/type/enum/constant declaration files, exception classes (enumerated indirectly via the services that throw them), `__mocks__` and `*.spec.ts` test fixtures, and the modules explicitly owned by other documentation lanes (auth, billing/billing-webhook, api-key, application/application-logs deep internals, file/file-storage, jwt, search, tool/tool-provider, twenty-config, two-factor-authentication, upgrade, usage, user, workflow, audit, event-logs, admin-panel, i18n, logic-function, message-queue internals, exception-handler internals).

