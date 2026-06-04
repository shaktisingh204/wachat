# Core Admin Panel, Audit, Event Logs & Exception Handler

Complete function documentation for admin-panel, audit, event-logs, and exception-handler core modules in the Twenty backend.

## admin-panel/admin-panel.resolver.ts

### userLookupAdminPanel
`file:admin-panel.resolver.ts:128`, `async (userIdentifier: string) → Promise<UserLookup>`, line 128-134
Queries user data by email or ID, returning complete workspace membership, feature flags, and user profiles for the target user across all their workspaces.

### adminPanelRecentUsers
`file:admin-panel.resolver.ts:137`, `async (searchTerm: string) → Promise<AdminPanelRecentUserDTO[]>`, line 137-147
Fetches the 10 most recently created users, optionally filtered by email, name, or user ID for admin search and discovery.

### adminPanelTopWorkspaces
`file:admin-panel.resolver.ts:150`, `async (searchTerm: string) → Promise<AdminPanelTopWorkspaceDTO[]>`, line 150-160
Returns the 10 largest workspaces by user count, with search capability by name, subdomain, or workspace ID.

### updateWorkspaceFeatureFlag
`file:admin-panel.resolver.ts:163`, `async (updateFlagInput: UpdateWorkspaceFeatureFlagInput) → Promise<boolean>`, line 163-182
Creates or updates a feature flag for a workspace; throws UserInputError if the flag key is invalid.

### getConfigVariablesGrouped
`file:admin-panel.resolver.ts:185`, `async () → Promise<ConfigVariablesDTO>`, line 185-188
Retrieves all configuration variables grouped by category (auth, features, etc.), excluding hidden/sensitive vars from admin panel.

### getSystemHealthStatus
`file:admin-panel.resolver.ts:191`, `async () → Promise<SystemHealthDTO>`, line 191-194
Performs full system health check across database, Redis, workers, connected accounts, and app endpoints, returning aggregated status.

### getIndicatorHealthStatus
`file:admin-panel.resolver.ts:197`, `async (indicatorId: HealthIndicatorId) → Promise<AdminPanelHealthServiceDataDTO>`, line 197-205
Gets detailed health metrics for a specific health indicator (database, redis, worker, etc.) including error details and queue info.

### getQueueMetrics
`file:admin-panel.resolver.ts:208`, `async (queueName: string, timeRange: QueueMetricsTimeRange) → Promise<QueueMetricsDataDTO>`, line 208-223
Retrieves job metrics (completed/failed counts) for a message queue over a specified time range with visualization-friendly data points.

### versionInfo
`file:admin-panel.resolver.ts:226`, `async () → Promise<VersionInfoDTO>`, line 226-229
Returns current app version and latest available version from Docker Hub registry.

### getAdminAiModels
`file:admin-panel.resolver.ts:232`, `async () → Promise<AdminAiModelsDTO>`, line 232-279
Queries all available AI models from the registry with availability, enabled status, recommendations, and pricing info per model.

### setAdminAiModelEnabled
`file:admin-panel.resolver.ts:282`, `async (modelId: string, enabled: boolean) → Promise<boolean>`, line 282-290
Enables or disables a single AI model at the admin level, affecting workspace availability.

### setAdminAiModelsEnabled
`file:admin-panel.resolver.ts:293`, `async (modelIds: string[], enabled: boolean) → Promise<boolean>`, line 293-301
Bulk enables/disables multiple AI models in one operation.

### setAdminAiModelRecommended
`file:admin-panel.resolver.ts:304`, `async (modelId: string, recommended: boolean) → Promise<boolean>`, line 304-312
Marks a single AI model as recommended (or not) for users.

### setAdminAiModelsRecommended
`file:admin-panel.resolver.ts:315`, `async (modelIds: string[], recommended: boolean) → Promise<boolean>`, line 315-326
Bulk-marks multiple AI models as recommended.

### setAdminDefaultAiModel
`file:admin-panel.resolver.ts:329`, `async (role: AiModelRole, modelId: string) → Promise<boolean>`, line 329-337
Sets the default AI model for a specific role (e.g., fast vs. smart inference).

### getDatabaseConfigVariable
`file:admin-panel.resolver.ts:340`, `async (key: keyof ConfigVariables) → Promise<ConfigVariableDTO>`, line 340-347
Fetches a single configuration variable by key with metadata (type, sensitivity, options).

### createDatabaseConfigVariable
`file:admin-panel.resolver.ts:350`, `async (key: keyof ConfigVariables, value: unknown) → Promise<boolean>`, line 350-359
Creates a new database-backed configuration variable after validating the key exists in the schema.

### updateDatabaseConfigVariable
`file:admin-panel.resolver.ts:362`, `async (key: keyof ConfigVariables, value: unknown) → Promise<boolean>`, line 362-371
Updates an existing configuration variable in the database.

### deleteDatabaseConfigVariable
`file:admin-panel.resolver.ts:374`, `async (key: keyof ConfigVariables) → Promise<boolean>`, line 374-381
Removes a configuration variable from the database.

### getQueueJobs
`file:admin-panel.resolver.ts:384`, `async (queueName: string, state: JobStateEnum, limit?: number, offset?: number) → Promise<QueueJobsResponseDTO>`, line 384-401
Queries jobs in a specific queue by state (active, failed, completed, etc.) with pagination; enforces 50-200 limit per page.

### retryJobs
`file:admin-panel.resolver.ts:404`, `async (queueName: string, jobIds: string[]) → Promise<RetryJobsResponseDTO>`, line 404-415
Retries failed jobs or all failed jobs if jobIds is empty; returns success/failure per job.

### deleteJobs
`file:admin-panel.resolver.ts:418`, `async (queueName: string, jobIds: string[]) → Promise<DeleteJobsResponseDTO>`, line 418-429
Removes jobs from a queue by ID; returns per-job deletion status.

### findAllApplicationRegistrations
`file:admin-panel.resolver.ts:432`, `async () → Promise<ApplicationRegistrationEntity[]>`, line 432-437
Lists all application registrations (OAuth apps, integrations, etc.) in the instance.

### getAiProviders
`file:admin-panel.resolver.ts:440`, `async () → Promise<Record<string, unknown>>`, line 440-473
Returns all configured AI providers with masked API keys, source (catalog or custom), and auth type info.

### addAiProvider
`file:admin-panel.resolver.ts:476`, `async (providerName: string, providerConfig: AiProviderConfig) → Promise<boolean>`, line 476-494
Adds a custom AI provider after validating the provider name (alphanumeric + dash/underscore only).

### removeAiProvider
`file:admin-panel.resolver.ts:497`, `async (providerName: string) → Promise<boolean>`, line 497-510
Removes a custom AI provider from config.

### getModelsDevProviders
`file:admin-panel.resolver.ts:513`, `async () → Promise<ModelsDevProviderSuggestionDTO[]>`, line 513-516
Fetches available provider suggestions from models.dev catalog for adding new providers.

### getModelsDevSuggestions
`file:admin-panel.resolver.ts:519`, `async (providerType: string) → Promise<ModelsDevModelSuggestionDTO[]>`, line 519-524
Gets model suggestions for a specific provider type from models.dev.

### addModelToProvider
`file:admin-panel.resolver.ts:527`, `async (providerName: string, modelConfig: AiProviderModelConfig) → Promise<boolean>`, line 527-564
Adds a new model to an existing custom provider; validates provider exists and model doesn't duplicate.

### removeModelFromProvider
`file:admin-panel.resolver.ts:567`, `async (providerName: string, modelName: string) → Promise<boolean>`, line 567-596
Removes a model from a custom provider by name.

### getAdminAiUsageByWorkspace
`file:admin-panel.resolver.ts:599`, `async (periodStart?: Date, periodEnd?: Date) → Promise<UsageBreakdownItemDTO[]>`, line 599-639
Retrieves AI usage metrics aggregated by workspace over a date range (defaults to last 30 days); returns workspace display names.

### getMaintenanceMode
`file:admin-panel.resolver.ts:642`, `async () → Promise<MaintenanceModeDTO | null>`, line 642-655
Fetches current maintenance mode window if active, else returns null.

### setMaintenanceMode
`file:admin-panel.resolver.ts:658`, `async ({ startAt, endAt, link }: SetMaintenanceModeInput) → Promise<boolean>`, line 658-669
Sets a maintenance window with start/end times and optional info link; clears previous banner dismissals.

### clearMaintenanceMode
`file:admin-panel.resolver.ts:672`, `async () → Promise<boolean>`, line 672-677
Deactivates maintenance mode and clears all user dismissal flags for the banner.

### workspaceLookupAdminPanel
`file:admin-panel.resolver.ts:681`, `async (workspaceId: string) → Promise<UserLookup>`, line 681-685
Looks up a workspace by ID, returning workspace details, member list, and feature flags (admin impersonation endpoint).

### workspaceBillingAdminPanel
`file:admin-panel.resolver.ts:688`, `async (workspaceId: string) → Promise<AdminPanelWorkspaceBillingDTO | null>`, line 688-693
Fetches billing subscription and credit balance for a workspace, or null if billing disabled.

### getAdminWorkspaceChatThreads
`file:admin-panel.resolver.ts:696`, `async (workspaceId: string) → Promise<AdminWorkspaceChatThreadDTO[]>`, line 696-701
Retrieves up to 100 recent AI chat threads for a workspace (requires impersonation enabled).

### getAdminChatThreadMessages
`file:admin-panel.resolver.ts:704`, `async (threadId: string) → Promise<AdminChatThreadMessagesDTO>`, line 704-709
Gets all messages in a chat thread with parts and metadata (requires workspace to allow impersonation).

### findOneAdminApplicationRegistration
`file:admin-panel.resolver.ts:712`, `async (id: string) → Promise<ApplicationRegistrationEntity>`, line 712-717
Fetches a single application registration by global ID.

### findAdminApplicationRegistrationVariables
`file:admin-panel.resolver.ts:720`, `async (applicationRegistrationId: string) → Promise<ApplicationRegistrationVariableDTO[]>`, line 720-727
Lists all environment variables for an application registration with values obfuscated for security.

### updateAdminApplicationRegistrationVariable
`file:admin-panel.resolver.ts:730`, `async (input: UpdateApplicationRegistrationVariableInput) → Promise<ApplicationRegistrationVariableDTO>`, line 730-737
Updates a single application registration variable at the global level.

### getInstanceAndAllWorkspacesUpgradeStatus
`file:admin-panel.resolver.ts:740`, `async () → Promise<InstanceAndAllWorkspacesUpgradeStatusDTO>`, line 740-743
Checks upgrade status for the instance and all workspaces at once.

### refreshUpgradeStatus
`file:admin-panel.resolver.ts:746`, `async () → Promise<InstanceAndAllWorkspacesUpgradeStatusDTO>`, line 746-749
Manually triggers a refresh of the upgrade status and returns the result.

### getUpgradeStatus
`file:admin-panel.resolver.ts:752`, `async (workspaceIds: string[]) → Promise<WorkspaceUpgradeStatusDTO[]>`, line 752-762
Checks upgrade status for specific workspaces by ID.

### getSigningKeys
`file:admin-panel.resolver.ts:765`, `async () → Promise<SigningKeysAdminPanelDTO>`, line 765-768
Lists all JWT signing keys with usage stats in a verification window.

### revokeSigningKey
`file:admin-panel.resolver.ts:771`, `async ({ id }: RevokeSigningKeyInput) → Promise<SigningKeyDTO>`, line 771-776
Revokes a signing key and returns its updated state with verification count.

## admin-panel/admin-panel-application-registration.resolver.ts

### isConfigured (ResolveField)
`file:admin-panel-application-registration.resolver.ts:10`, `async (@Parent() registration: ApplicationRegistrationEntity, @Context() context) → Promise<boolean>`, line 10-17
Uses dataloader to efficiently check if an application registration is fully configured (all required variables present).

## admin-panel/admin-panel-queue.service.ts

### getQueueJobs
`file:admin-panel-queue.service.ts:27`, `async (queueName: MessageQueue, state: JobStateEnum, limit?, offset?) → Promise<QueueJobsResponse>`, line 27-118
Retrieves jobs from a BullMQ queue filtered by state; converts BullMQ states to GraphQL enums; includes per-state totals and retention config.

### retryJobs
`file:admin-panel-queue.service.ts:120`, `async (queueName: MessageQueue, jobIds: string[]) → Promise<{retriedCount, results}>`, line 120-190
Attempts to retry specified failed jobs; empty array retries all failed jobs; returns per-job success/error status.

### deleteJobs
`file:admin-panel-queue.service.ts:192`, `async (queueName: MessageQueue, jobIds: string[]) → Promise<{deletedCount, results}>`, line 192-245
Removes jobs from a queue; returns per-job deletion result with error messages for failures.

## admin-panel/admin-panel-health.service.ts

### getSystemHealthStatus
`file:admin-panel-health.service.ts:148`, `async () → Promise<SystemHealthDTO>`, line 148-196
Parallel health checks across all five indicators (database, redis, worker, account-sync, app); returns status for each.

### getIndicatorHealthStatus
`file:admin-panel-health.service.ts:118`, `async (indicatorId: HealthIndicatorId) → Promise<AdminPanelHealthServiceDataDTO>`, line 118-146
Fetches detailed health data for one indicator; for worker health, maps queue statuses and determines operational vs. outage.

### getQueueMetrics
`file:admin-panel-health.service.ts:198`, `async (queueName: MessageQueue, timeRange?: QueueMetricsTimeRange) → Promise<QueueMetricsDataDTO>`, line 198-243
Queries worker health for queue details; extracts completed/failed metrics; transforms into graph-ready time series with sampling.

### getPointsConfiguration (private)
`file:admin-panel-health.service.ts:245`, `(timeRange: QueueMetricsTimeRange) → {pointsNeeded, samplingFactor, targetVisualizationPoints}`, line 245-285
Calculates metric points and sampling strategy based on time range (1hr to 7 days) to fit ~240 visualization points.

### extractMetricsData (private)
`file:admin-panel-health.service.ts:287`, `(metrics?: number[], pointsNeeded: number, samplingFactor?) → number[]`, line 287-320
Downsamples metrics array by sampling factor; backfills missing data with zeros; returns target point count.

### transformMetricsForGraph (private)
`file:admin-panel-health.service.ts:322`, `(completedMetrics, failedMetrics, timeRange, queueName, queueDetails) → QueueMetricsDataDTO`, line 322-358
Converts raw metric arrays into Nivo chart format with x/y coordinates for both completed and failed job series.

### transformStatus (private)
`file:admin-panel-health.service.ts:46`, `(status: HealthIndicatorStatus) → AdminPanelHealthServiceStatus`, line 46-50
Maps 'up'/'down' status to OPERATIONAL/OUTAGE enum values.

### transformServiceDetails (private)
`file:admin-panel-health.service.ts:52`, `(details: any) → any`, line 52-70
Recursively transforms nested messageSync and calendarSync status fields if present.

### getServiceStatus (private)
`file:admin-panel-health.service.ts:72`, `(result: PromiseSettledResult, indicatorId: HealthIndicatorId) → HealthIndicatorStatus`, line 72-116
Extracts status from a promise result; formats error messages and transforms details; handles fulfilled and rejected states.

## admin-panel/maintenance-mode.service.ts

### getMaintenanceMode
`file:maintenance-mode.service.ts:44`, `async () → Promise<MaintenanceModeValue | null>`, line 44-71
Retrieves active maintenance mode window from key-value store; validates start/end times exist before returning.

### setMaintenanceMode
`file:maintenance-mode.service.ts:73`, `async (value: MaintenanceModeValue) → Promise<void>`, line 73-90
Sets a new maintenance window; validates end time is after start time; clears user banner dismissals.

### clearMaintenanceMode
`file:maintenance-mode.service.ts:92`, `async () → Promise<void>`, line 92-101
Removes maintenance mode config and clears all dismissal states.

### isMaintenanceModeBannerDismissed
`file:maintenance-mode.service.ts:103`, `async (userId: string, workspaceId: string) → Promise<boolean>`, line 103-114
Checks if a user has dismissed the maintenance banner in a workspace.

### dismissMaintenanceModeBanner
`file:maintenance-mode.service.ts:116`, `async (userId: string, workspaceId: string) → Promise<void>`, line 116-126
Marks the maintenance banner as dismissed for a user in a workspace.

### clearMaintenanceModeBannerDismissals (private)
`file:maintenance-mode.service.ts:38`, `async () → Promise<void>`, line 38-42
Removes all dismissal records when maintenance mode is set or cleared.

## admin-panel/services/admin-panel-user-lookup.service.ts

### userLookup
`file:admin-panel-user-lookup.service.ts:53`, `async (userIdentifier: string) → Promise<UserLookup>`, line 53-142
Searches for a user by email or ID; fetches all workspaces they're in with member lists, feature flags, and signed avatar URLs.

### workspaceLookup
`file:admin-panel-user-lookup.service.ts:144`, `async (workspaceId: string) → Promise<UserLookup>`, line 144-223
Fetches workspace members and feature flags; returns workspace info structured as if it were a user's workspace list.

### buildFallbackAvatarUrlsByUserId (private)
`file:admin-panel-user-lookup.service.ts:40`, `(workspaceUsers: UserWorkspaceEntity[]) → Map<string, string | null>`, line 40-51
Creates a map of user IDs to their default/fallback avatar URLs from user-workspace associations.

## admin-panel/services/admin-panel-config.service.ts

### getConfigVariablesGrouped
`file:admin-panel-config.service.ts:15`, `() → ConfigVariablesDTO`, line 15-66
Returns all config variables grouped by category; filters hidden admin panel vars; sorts groups and variables alphabetically.

### getConfigVariable
`file:admin-panel-config.service.ts:68`, `(key: string) → ConfigVariableDTO`, line 68-91
Fetches a single config variable with metadata (sensitivity, type, options); throws if key not found.

## admin-panel/services/admin-panel-statistics.service.ts

### getRecentUsers
`file:admin-panel-statistics.service.ts:28`, `async (searchTerm?: string) → Promise<AdminPanelRecentUserDTO[]>`, line 28-89
Returns 10 most recent users sorted by creation date; supports search by email, name, or user ID; includes signed avatar URLs and workspace info.

### getTopWorkspaces
`file:admin-panel-statistics.service.ts:91`, `async (searchTerm?: string) → Promise<AdminPanelTopWorkspaceDTO[]>`, line 91-145
Returns 10 largest workspaces by user count; supports search by name, subdomain, or workspace ID.

### buildSignedAvatarUrlByUserId (private)
`file:admin-panel-statistics.service.ts:147`, `async (users: UserEntity[]) → Promise<Map<string, string | null>>`, line 147-203
Loads signed avatar URLs per workspace; consolidates into a single map preferring non-empty URLs.

## admin-panel/services/admin-panel-billing.service.ts

### getWorkspaceBilling
`file:admin-panel-billing.service.ts:31`, `async (workspaceId: string) → Promise<AdminPanelWorkspaceBillingDTO | null>`, line 31-114
Fetches workspace billing info if enabled; returns subscription details, credit balance, and per-item pricing/tiers; null if billing disabled or no data.

## admin-panel/services/admin-panel-version.service.ts

### getVersionInfo
`file:admin-panel-version.service.ts:17`, `async () → Promise<VersionInfoDTO>`, line 17-49
Fetches current app version from config and latest release from Docker Hub; returns both, falling back to 'latest' on error.

## admin-panel/services/admin-panel-signing-key.service.ts

### getSigningKeys
`file:admin-panel-signing-key.service.ts:16`, `async () → Promise<SigningKeysAdminPanelDTO>`, line 16-29
Lists all JWT signing keys with their verification counts in the current window and legacy fallback count.

### revokeSigningKey
`file:admin-panel-signing-key.service.ts:31`, `async (id: string) → Promise<SigningKeyDTO>`, line 31-38
Revokes a signing key and returns its updated state including verification count.

### toSigningKeyDTO (private)
`file:admin-panel-signing-key.service.ts:40`, `(signingKey: SigningKeyEntity, verifyCountInWindow: number) → SigningKeyDTO`, line 40-52
Transforms a signing key entity into admin DTO format with verification metrics.

## audit/audit.resolver.ts

### trackAnalytics (Mutation)
`file:audit.resolver.ts:74`, `async (input: CreateAnalyticsInputV2, workspace?, user?) → Promise<Analytics>`, line 74-108
Records pageview or workspace-level event; uses audit service to insert into ClickHouse; distinguishes pageview vs. track input types.

### createObjectEvent (Mutation)
`file:audit.resolver.ts:48`, `async (input: CreateObjectEventInput, workspace, user?) → Promise<Analytics>`, line 48-72
Records an object record event with custom flag; validates workspace exists; includes recordId and objectMetadataId.

### createPageview (Mutation - legacy naming)
`file:audit.resolver.ts:35`, `async (input: CreateAnalyticsInputV2, workspace?, user?) → Promise<Analytics>`, line 35-44
Alias for trackAnalytics; prepared for naming migration.

## audit/services/audit.service.ts

### createContext
`file:audit.service.ts:24`, `(context?: {workspaceId?, userId?}) → AuditContextWithMethods`, line 24-81
Returns an object with three methods: insertWorkspaceEvent, createObjectEvent, createPageviewEvent; each validates ClickHouse is enabled before insertion.

### insertWorkspaceEvent (method on context)
`file:audit.service.ts:36`, `<T extends TrackEventName>(event: T, properties: TrackEventProperties<T>) → Promise<{success: boolean}>`, line 36-44
Inserts workspace-level event to ClickHouse; decorates with workspace/user context fields.

### createObjectEvent (method on context)
`file:audit.service.ts:45`, `<T extends TrackEventName>(event: T, properties: {..., recordId, objectMetadataId, isCustom?}) → Promise<{success: boolean}>`, line 45-70
Inserts object record event; separates recordId/objectMetadataId from properties; marks as custom if needed.

### createPageviewEvent (method on context)
`file:audit.service.ts:71`, `(name: string, properties: Partial<PageviewProperties>) → Promise<{success: boolean}>`, line 71-79
Inserts pageview event with name and optional properties.

### preventIfDisabled (private)
`file:audit.service.ts:83`, `async (sendEventOrPageviewFunction) → Promise<{success: boolean}>`, line 83-97
Guards event insertion; skips if ClickHouse URL not configured; catches and logs errors.

## audit/audit.exception.ts

### AuditException (class)
`file:audit.exception.ts:23`, `extends CustomException<AuditExceptionCode>`, line 23-34
Custom exception for audit operations; auto-generates user-friendly message by code.

## audit/audit-exception-filter.ts

### AuditExceptionFilter (ExceptionFilter)
`file:audit-exception-filter.ts:12`, `catch(exception: AuditException) → throws UserInputError`, line 13-22
Converts AuditException to GraphQL UserInputError for client consumption.

## event-logs/event-logs.resolver.ts

### eventLogs (Query)
`file:event-logs.resolver.ts:43`, `async (workspace: WorkspaceEntity, input: EventLogQueryInput) → Promise<EventLogQueryResult>`, line 43-49
Protected query requiring enterprise features enabled; delegates to service for log retrieval.

## event-logs/event-logs.service.ts

### queryEventLogs
`file:event-logs.service.ts:83`, `async (workspaceId: string, input: EventLogQueryInput) → Promise<EventLogQueryResult>`, line 83-172
Main query method; validates ClickHouse config and billing entitlement; applies filters and pagination; returns cursor-based page.

### validateAccess (private)
`file:event-logs.service.ts:174`, `async (workspaceId: string) → Promise<void>`, line 174-193
Checks ClickHouse is configured and workspace has AUDIT_LOGS entitlement; throws if missing either.

### applyFilters (private)
`file:event-logs.service.ts:195`, `async (whereClauses, params, filters?, eventFieldName, table) → Promise<void>`, line 195-257
Builds SQL WHERE clauses for event type, user, date range, and object-specific filters (recordId, objectMetadataId).

### encodeCursor (private)
`file:event-logs.service.ts:259`, `(timestamp: Date) → string`, line 259-261
Base64-encodes a timestamp for cursor-based pagination.

### decodeCursor (private)
`file:event-logs.service.ts:263`, `(cursor: string) → number`, line 263-265
Decodes base64 cursor back to millisecond timestamp.

### normalizeRecords (private)
`file:event-logs.service.ts:267`, `(records, table: EventLogTable) → EventLogRecord[]`, line 267-322
Transforms ClickHouse records to normalized format; handles three table types differently (usage events, application logs, standard events).

## event-logs/event-logs.exception.ts

### EventLogsException (class)
`file:event-logs.exception.ts:27`, `extends CustomException<EventLogsExceptionCode>`, line 27-38
Custom exception for event logs; wraps ClickHouse config or entitlement errors.

## event-logs/filters/event-logs-graphql-api-exception.filter.ts

### EventLogsGraphqlApiExceptionFilter (ExceptionFilter)
`file:event-logs-graphql-api-exception.filter.ts:9`, `catch(exception: EventLogsException)`, line 9-12
Catches EventLogsException and delegates to handler utility for GraphQL error conversion.

## event-logs/utils/event-logs-graphql-api-exception-handler.util.ts

### eventLogsGraphqlApiExceptionHandler
`file:event-logs-graphql-api-exception-handler.util.ts:11`, `(exception: EventLogsException) → throws ForbiddenError`, line 11-22
Converts EventLogsException to GraphQL ForbiddenError for both ClickHouse and entitlement issues.

## event-logs/cleanup/services/event-log-cleanup.service.ts

### cleanupWorkspaceEventLogs
`file:event-log-cleanup.service.ts:29`, `async ({workspaceId, retentionDays}) → Promise<void>`, line 29-75
Schedules async lightweight mutations on ClickHouse to delete old event log records per table; logs results.

## event-logs/cleanup/crons/event-log-cleanup.cron.job.ts

### handle (Process)
`file:event-log-cleanup.cron.job.ts:41`, `async () → Promise<void>`, line 41-75
Cron job that fetches active workspaces; enqueues cleanup jobs for each with their retention settings; handles errors per workspace.

### getActiveWorkspaces (private)
`file:event-log-cleanup.cron.job.ts:77`, `async () → Promise<Array<{id, eventLogRetentionDays}>>`, line 77-96
Queries database for active workspaces and their retention day settings.

## exception-handler/exception-handler.service.ts

### captureExceptions
`file:exception-handler.service.ts:15`, `(exceptions: ReadonlyArray<any>, options?: ExceptionHandlerOptions) → string[]`, line 15-21
Delegates exception capture to the configured driver (console or Sentry); returns event IDs.

## exception-handler/http-exception-handler.service.ts

### handleError
`file:http-exception-handler.service.ts:70`, `(exception, response, errorCode?, user?, workspace?) → Response | undefined`, line 70-127
Transforms various exception types (QueryFailedError, TwentyORMException, PostgresException) to HTTP exceptions; calls global exception handler; returns JSON error response.

### getErrorNameFromStatusCode (helper function)
`file:http-exception-handler.service.ts:32`, `(statusCode: number) → string`, line 32-60
Maps HTTP status codes to NestJS exception names.

## exception-handler/drivers/console.driver.ts

### captureExceptions (ExceptionHandlerConsoleDriver)
`file:console.driver.ts:7`, `(exceptions: ReadonlyArray<any>, options?: ExceptionHandlerOptions) → string[]`, line 7-32
Logs exceptions and options to console; returns empty array (no event IDs for console driver).

## exception-handler/drivers/sentry.driver.ts

### captureExceptions (ExceptionHandlerSentryDriver)
`file:sentry.driver.ts:16`, `(exceptions: ReadonlyArray<any>, options?: ExceptionHandlerOptions) → string[]`, line 16-119
Captures exceptions to Sentry with rich context; sets tags, breadcrumbs, and fingerprints; extracts custom exception codes and postgres error details; returns event IDs.

## audit/jobs/create-audit-log-from-internal-event.ts

### handle (Process)
`file:create-audit-log-from-internal-event.ts:18`, `async (workspaceEventBatch: WorkspaceEventBatch<ObjectRecordEvent>) → Promise<void>`, line 18-63
BullMQ processor that converts internal object record events (created/updated/deleted/upserted) to audit log events in ClickHouse.

## admin-panel/indicators/database.health.ts

### isHealthy (DatabaseHealthIndicator)
`file:database.health.ts:25`, `async () → Promise<HealthIndicatorResult>`, line 25-123
Performs comprehensive PostgreSQL health check: version, connections, uptime, size, cache hit ratio, deadlocks, slow queries, table stats.

## admin-panel/indicators/worker.health.ts

### isHealthy (WorkerHealthIndicator)
`file:worker.health.ts:25`, `async () → Promise<HealthIndicatorResult>`, line 25-49
Checks all message queues for active workers; returns up if any workers are running, down otherwise.

### getQueueDetails
`file:worker.health.ts:51`, `async (queueName: MessageQueue, options?) → Promise<WorkerQueueHealth | null>`, line 51-124
Fetches queue metrics (completed/failed counts, job states) and calculates failure rate; returns null if no workers.

### calculateMetricsSum (private)
`file:worker.health.ts:126`, `(data: string[] | number[]) → number`, line 126-134
Sums metric values, treating non-numeric entries as zero.

### checkWorkers (private)
`file:worker.health.ts:136`, `async () → Returns {status, error?, queues}`, line 136-163
Iterates all message queues; collects health for each; returns status based on whether any workers exist.

## admin-panel/utils/health-state-manager.util.ts

### updateState
`file:health-state-manager.util.ts:9`, `(details: Record<string, any>) → void`, line 9-14
Stores the latest health check details with a timestamp.

### getStateWithAge
`file:health-state-manager.util.ts:16`, `() → {timestamp, details, age} | string`, line 16-23
Returns last known state plus age in milliseconds; or fallback message if no state recorded.

## admin-panel/services/admin-panel-chat.service.ts

### getWorkspaceChatThreads
`file:admin-panel-chat.service.ts:45`, `async (workspaceId: string) → Promise<AdminWorkspaceChatThreadDTO[]>`, line 45-65
Fetches up to 100 AI chat threads for a workspace; asserts workspace allows impersonation first.

### getChatThreadMessages
`file:admin-panel-chat.service.ts:67`, `async (threadId: string) → Promise<{thread, messages}>`, line 67-113
Gets a thread and all its messages with parts sorted by order index; validates workspace allows impersonation.

### assertWorkspaceAllowsImpersonation (private)
`file:admin-panel-chat.service.ts:28`, `async (workspaceId: string) → Promise<void>`, line 28-43
Checks workspace exists and has allowImpersonation flag; throws UserInputError if not.

## admin-panel/indicators/redis.health.ts

### isHealthy (RedisHealthIndicator)
`file:redis.health.ts:23`, `async () → Promise<HealthIndicatorResult>`, line 23-118
Runs four Redis `INFO` calls (server, memory, clients, stats) in parallel under a timeout; parses the `key:value\r\n` blocks into a details object (version, uptime in hours, memory used/peak/fragmentation, current/total/rejected connections, ops-per-second, keyspace hit-rate %, evicted/expired keys, replication role + slaves). On success records state and returns `up`; on timeout/connection failure returns `down` with the last known state and its age.

## admin-panel/indicators/connected-account.health.ts

### isHealthy (ConnectedAccountHealth)
`file:connected-account.health.ts:120`, `async () → Promise<HealthIndicatorResult>`, line 120-157
Runs message-sync and calendar-sync sub-checks in parallel; returns `down` (with a combined error if both fail) when either is down, else `up`, embedding both sub-results in details.

### checkMessageSyncHealth (private)
`file:connected-account.health.ts:22`, `async () → Promise<HealthIndicatorResult>`, line 22-69
Groups message-sync metrics by status under a timeout, computes total/failed job counts and a rounded failure rate; returns `up` when no jobs or below the failure-rate threshold, else `down` (HIGH_FAILURE_RATE); maps timeouts vs. generic failures on error.

### checkCalendarSyncHealth (private)
`file:connected-account.health.ts:71`, `async () → Promise<HealthIndicatorResult>`, line 71-118
Identical logic to checkMessageSyncHealth but for calendar-sync metrics.

## admin-panel/indicators/app.health.ts

### isHealthy (AppHealthIndicator)
`file:app.health.ts:24`, `async () → Promise<HealthIndicatorResult>`, line 24-59
Counts total workspaces (placeholder for per-workspace app-versioning health), reports node version + timestamp and a workspace overview; records state and returns `up`, or `down` with the last state + age on error.

## admin-panel/utils/health-check-timeout.util.ts

### withHealthCheckTimeout
`file:health-check-timeout.util.ts:3`, `<T>(promise: Promise<T>, errorMessage: string) → Promise<T>`, line 3-16
Races the given promise against a `HEALTH_INDICATORS_TIMEOUT` timer that rejects with the supplied error message — used by every health indicator to bound external calls.

## audit/utils/analytics.utils.ts

### makePageview
`file:analytics.utils.ts:22`, `(name: string, properties?: Partial<PageviewProperties>) → parsed pageview event`, line 22-32
Builds and zod-parses a `type:'page'` event with the name, properties, and common fields (timestamp formatted `yyyy-MM-dd HH:mm:ss`, version `'1'`).

### makeTrackEvent
`file:analytics.utils.ts:34`, `<T extends TrackEventName>(event: T, properties: TrackEventProperties<T>) → GenericTrackEvent<T>`, line 34-50
Looks up the event's registered schema (throws if not implemented) and zod-parses a `type:'track'` event with the event name, properties, and common fields.

### common (private)
`file:analytics.utils.ts:17`, `() → {timestamp, version}`, line 17-20
Returns the shared timestamp + version fields stamped on every audit event.

## audit/utils/events/workspace-event/track.ts

### registerEvent
`file:track.ts:26`, `<E, S extends z.ZodObject>(event: E, schema: S) → void`, line 26-31
Merges the per-event schema with `genericTrackSchema` and stores it in the module-level `eventsRegistry` Map. Each event file (object-record-created/updated/deleted/upserted, pageview, user-signup, workspace-created, payment-received, custom-domain activated/deactivated, logic-function-executed, monitoring, webhook-response, workspace-entity-created) calls this at import time, registering its zod schema keyed by event name. `genericTrackSchema` extends `baseEventSchema` with `type:'track'`, `event`, and free-form `properties`; `GenericTrackEvent<E>` is the inferred shape.

## audit/utils/events/common/base-schemas.ts

### baseEventSchema
`file:base-schemas.ts:3`, `z.strictObject({timestamp, userId?, workspaceId?, version})`, line 3-8
The common zod base every audit/pageview event schema extends.

## audit/utils/events/pageview/pageview.ts

### pageviewSchema
`file:pageview.ts:5`, `baseEventSchema.extend({type:'page', name, properties})`, line 5-17
Pageview schema; `properties` carries optional href/locale/pathname/referrer/sessionId/timeZone/userAgent (all defaulting to `''`). `PageviewProperties` is the inferred properties type.

## audit/utils/events/object-event/*.ts

### object-record event schemas (registered)
`file:object-record-created.ts:6` (and object-record-updated/delete/upserted)
Each defines a zod schema (`event` literal + loose `properties`) and calls `registerEvent(...)` at import to register it in `eventsRegistry`. Constants: `OBJECT_RECORD_CREATED_EVENT` = `'Object Record Created'`, plus the Updated/Deleted/Upserted equivalents. These names are the events emitted by `create-audit-log-from-internal-event.ts`.

## event-logs/cleanup/jobs/event-log-cleanup.job.ts

### handle (EventLogCleanupJob)
`file:event-log-cleanup.job.ts:25`, `async (data: EventLogCleanupJobData) → Promise<void>`, line 25-40
Enterprise-licensed BullMQ workspaceQueue processor; delegates to `EventLogCleanupService.cleanupWorkspaceEventLogs` with the workspace's `eventLogRetentionDays`; logs + rethrows on failure. `EventLogCleanupJobData = {workspaceId, eventLogRetentionDays}`.

## event-logs/cleanup/commands/event-log-cleanup.cron.command.ts

### run (EventLogCleanupCronCommand)
`file:event-log-cleanup.cron.command.ts:24`, `async () → Promise<void>`, line 24-34
`nest-commander` command `cron:event-log-cleanup`; registers the repeating `EventLogCleanupCronJob` on the cronQueue with `EVENT_LOG_CLEANUP_CRON_PATTERN`.

## event-logs/filters/forbidden-exception-graphql.filter.ts

### catch (ForbiddenExceptionGraphqlFilter)
`file:forbidden-exception-graphql.filter.ts:13`, `catch(exception: ForbiddenException) → throws AuthenticationError`, line 13-17
Converts a Nest `ForbiddenException` into a GraphQL `AuthenticationError` with a Lingui "Authentication required." user-friendly message.

## exception-handler/exception-handler.module-factory.ts

### exceptionHandlerModuleFactory
`file:exception-handler.module-factory.ts:15`, `async (twentyConfigService, adapterHost) → Promise<OPTIONS_TYPE>`, line 15-45
Reads `EXCEPTION_HANDLER_DRIVER`; returns CONSOLE options, or SENTRY options (environment, release=APP_VERSION, dsn, the HTTP server instance, debug in dev); throws for an invalid driver type.

## exception-handler/hooks/use-sentry-tracing.ts

### useSentryTracing
`file:use-sentry-tracing.ts:11`, `<PluginContext extends GraphQLContext>() → Plugin<PluginContext>`, line 11-58
Envelop GraphQL plugin: on each execute, sets Sentry transaction name (operationName), operation-type tags, the user/workspace scope, and attaches the printed GraphQL document as a Sentry extra.

## exception-handler/mocks/exception-handler-mock.service.ts

### captureExceptions (ExceptionHandlerMockService)
`file:exception-handler-mock.service.ts:9`, `(exceptions, options?) → string[]`, line 9-15
Test/mock driver implementing ExceptionHandlerDriverInterface; returns one `'mocked-exception-id'` per exception.

---

## NOT YET COVERED

Only trivial non-logic files remain: type aliases under `admin-panel/types/`, `audit/types/`, `connected-account.health` metric-status constants, enums under `admin-panel/enums/` and `event-logs/dtos/event-log-table.enum.ts`, constants (`*.const.ts`, cron patterns, health error-message/timeout/threshold consts), DTOs/inputs under `*/dtos/`, `*.module.ts` wiring (`admin-panel.module.ts`, `audit.module.ts`, `audit-job.module.ts`, `event-logs.module.ts`, `cleanup/event-log-cleanup.module.ts`, `exception-handler.module.ts`/`module-definition.ts`), exception classes already summarized above, the `exception-handler/interfaces/` interface declarations, and `exception-handler/mocks/mock-unhandled-exception.filter.ts` (a passthrough test filter).

