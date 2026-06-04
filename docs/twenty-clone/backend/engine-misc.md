# Engine Miscellaneous Modules

Documentation of core utility, caching, subscription, middleware, and auxiliary engine modules from the Twenty CRM backend. Covers core infrastructure and cross-cutting concerns.

## core-entity-cache

### CoreEntityCacheService
`file:src/engine/core-entity-cache/services/core-entity-cache.service.ts:35`
`constructor(cacheStorage, discoveryService, reflector) → void`
NestJS injectable service managing a multi-layer cache (local + Redis) for core entities like workspaces, users. Caches frequently-accessed global data with exponential validation: local TTL (100ms) → Redis hash validation → Redis data fetch → provider recomputation.

### get<K extends CoreEntityCacheKeyName>
`file:src/engine/core-entity-cache/services/core-entity-cache.service.ts:81`
`(cacheKeyName, entityId) → Promise<CoreEntityCacheDataMap[K] | null>`
Retrieves cached entity by key and ID. Validates local cache against Redis hash within 100ms; falls back to Redis data or recomputes from provider. Returns null if entity not found.

### invalidate
`file:src/engine/core-entity-cache/services/core-entity-cache.service.ts:161`
`(cacheKeyName, entityId) → Promise<void>`
Clears Redis + local cache for entity. Memoizer cleared before and after to prevent stale concurrent fetches.

### invalidateAndRecompute
`file:src/engine/core-entity-cache/services/core-entity-cache.service.ts:170`
`(cacheKeyName, entityId) → Promise<void>`
Flushes and immediately recomputes cache from provider, then clears memoizer again to evict any stale entries cached during the flush window.

### onModuleInit
`file:src/engine/core-entity-cache/services/core-entity-cache.service.ts:57`
`() → void`
Discovers and registers all CoreEntityCacheProvider instances decorated with @CoreEntityCache.

### CoreEntityCache (decorator)
`file:src/engine/core-entity-cache/decorators/core-entity-cache.decorator.ts:7`
`(coreEntityCacheKeyName: CoreEntityCacheKeyName) → ClassDecorator`
Marks a CoreEntityCacheProvider class with its cache key name for auto-registration.

## dataloaders

### DataloaderService
`file:src/engine/dataloaders/dataloader.service.ts:120`
`constructor(i18nService, flatEntityMapsCacheService, applicationRegistrationVariableService) → void`
Creates and manages DataLoader instances for batch-loading metadata & relation data, preventing N+1 queries.

### createLoaders
`file:src/engine/dataloaders/dataloader.service.ts:127`
`() → IDataloaders`
Instantiates all DataLoader instances: relationLoader, morphRelationLoader, fieldMetadataLoader, objectMetadataLoader, viewField/Filter/Sort/Group loaders, etc. Each loader batch-fetches from flat entity maps cache.

### createRelationLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:164`
`() → DataLoader<RelationLoaderPayload, RelationDTO | null>`
Batch-loads relation metadata for fields. Returns null if field is not a RELATION type.

### createMorphRelationLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:202`
`() → DataLoader<MorphRelationLoaderPayload, RelationDTO[] | null>`
Batch-loads morph relation metadata arrays for MORPH_RELATION type fields.

### createFieldMetadataLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:288`
`() → DataLoader<FieldMetadataLoaderPayload, FieldMetadataDTO[]>`
Batch-loads all fields for objects, applies i18n standard overrides (label, description, icon), filters duplicate morph relations, and renames morph fields.

### createIndexMetadataLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:240`
`() → DataLoader<IndexMetadataLoaderPayload, IndexMetadataDTO[]>`
Batch-loads database indexes for objects from flat entity maps.

### createIndexFieldMetadataLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:388`
`() → DataLoader<IndexFieldMetadataLoaderPayload, IndexFieldMetadataDTO[]>`
Batch-loads index field metadata sorted by order.

### createObjectMetadataLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:433`
`() → DataLoader<ObjectMetadataLoaderPayload, ObjectMetadataDTO | null>`
Batch-loads object metadata by ID, returns null if not found.

### createViewFieldGroupsByViewIdLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:463`
`() → DataLoader<ViewFieldGroupsByViewIdLoaderPayload, ViewFieldGroupDTO[]>`
Batch-loads active (non-deleted) field groups for views.

### createViewFieldsByViewFieldGroupIdLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:502`
`() → DataLoader<ViewFieldsByViewFieldGroupIdLoaderPayload, ViewFieldDTO[]>`
Batch-loads view fields by group ID, respecting view field group overrides.

### createViewFieldsByViewIdLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:566`
`() → DataLoader<ViewFieldsByViewIdLoaderPayload, ViewFieldDTO[]>`
Batch-loads active view fields for views.

### createViewFiltersByViewIdLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:604`
`() → DataLoader<ViewFiltersByViewIdLoaderPayload, ViewFilterDTO[]>`
Batch-loads non-deleted filters for views.

### createViewSortsByViewIdLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:639`
`() → DataLoader<ViewSortsByViewIdLoaderPayload, ViewSortDTO[]>`
Batch-loads non-deleted sorts for views.

### createViewGroupsByViewIdLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:674`
`() → DataLoader<ViewGroupsByViewIdLoaderPayload, ViewGroupDTO[]>`
Batch-loads non-deleted grouping configurations for views.

### createViewFilterGroupsByViewIdLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:709`
`() → DataLoader<ViewFilterGroupsByViewIdLoaderPayload, ViewFilterGroupDTO[]>`
Batch-loads non-deleted filter group hierarchies for views.

### createIsConfiguredLoader (private)
`file:src/engine/dataloaders/dataloader.service.ts:746`
`() → DataLoader<IsConfiguredLoaderPayload, boolean>`
Batch-checks if application registrations are configured, defaulting to true.

### filterMorphRelationDuplicateFields
`file:src/engine/dataloaders/utils/filter-morph-relation-duplicate-fields.util.ts:7`
`(flatFieldMetadatas) → FlatFieldMetadata[]`
Groups MORPH_RELATION fields by morphId, selects survivor (active + non-system preferred, smallest id breaks ties), returns all non-morph fields plus survivors.

### pickMorphGroupSurvivor
`file:src/engine/dataloaders/utils/pick-morph-group-survivor.util.ts:11`
`(group) → FlatFieldMetadata<FieldMetadataType.MORPH_RELATION>`
Scores morph fields: +2 if active, +1 if non-system. Returns highest score; ties broken by smallest id.

## decorators

### AuthApiKey
`file:src/engine/decorators/auth/auth-api-key.decorator.ts:5`
`() → ParameterDecorator`
Extracts apiKey from request context for controller/resolver parameters.

### AuthProvider
`file:src/engine/decorators/auth/auth-provider.decorator.ts:5`
`() → ParameterDecorator`
Extracts authProvider from request context (e.g., 'google', 'microsoft').

### AuthUserWorkspaceId
`file:src/engine/decorators/auth/auth-user-workspace-id.decorator.ts:13`
`(options?: {allowUndefined?}) → ParameterDecorator`
Extracts userWorkspaceId from request. Throws ForbiddenException if missing and allowUndefined=false. API keys bypass user context.

### AuthUser
`file:src/engine/decorators/auth/auth-user.decorator.ts:13`
`(options?: {allowUndefined?}) → ParameterDecorator`
Extracts user from request. Throws ForbiddenException if missing and allowUndefined=false. API-key-only requests are forbidden.

### AuthWorkspaceMemberId
`file:src/engine/decorators/auth/auth-workspace-member-id.decorator.ts:5`
`() → ParameterDecorator`
Extracts workspaceMemberId from request context.

### AuthWorkspace
`file:src/engine/decorators/auth/auth-workspace.decorator.ts:13`
`(options?: {allowUndefined?}) → ParameterDecorator`
Extracts workspace from request. Throws InternalServerErrorException if missing and allowUndefined=false (auth should have set this).

### RequestLocale
`file:src/engine/decorators/locale/request-locale.decorator.ts:7`
`() → ParameterDecorator`
Extracts locale from request (header 'x-locale' or default SOURCE_LOCALE).

### IsValidMetadataName
`file:src/engine/decorators/metadata/is-valid-metadata-name.decorator.ts:7`
`(validationOptions?) → PropertyDecorator`
Validates field names: must not be GraphQL reserved words (not, or, and, Int, Float, Boolean, String, ID), no special chars except hyphen/underscore.

### LogExecutionTime
`file:src/engine/decorators/observability/log-execution-time.decorator.ts:10`
`(label?: string) → MethodDecorator`
Wraps async method to log execution time to Logger. Labels with custom string or default "Execution time: Xms".

## guards

### AdminPanelGuard
`file:src/engine/guards/admin-panel-guard.ts:6`
`implements CanActivate`
`canActivate(context) → boolean`
Returns true if request.user.canAccessFullAdminPanel === true.

### BillingDisabledGuard
`file:src/engine/guards/billing-disabled.guard.ts:10`
`implements CanActivate`
`canActivate(context) → boolean`
Returns true if billing is disabled in TwentyConfig.

### CustomPermissionGuard
`file:src/engine/guards/custom-permission.guard.ts:19`
`implements CanActivate`
`canActivate(context) → boolean`
Always returns true. Documents that endpoint has custom permission logic in resolver method.

### DevelopmentGuard
`file:src/engine/guards/development.guard.ts:12`
`implements CanActivate`
`canActivate(context) → boolean`
Throws ForbiddenException if NODE_ENV is not DEVELOPMENT or TEST.

### RequireFeatureFlag (decorator + guard)
`file:src/engine/guards/feature-flag.guard.ts:17`
`(featureFlag: FeatureFlagKey) → Decorator`
Marks resolver/method requiring feature flag. FeatureFlagGuard checks flag enabled for workspace, throws ForbiddenException if disabled.

### FeatureFlagGuard
`file:src/engine/guards/feature-flag.guard.ts:34`
`implements CanActivate`
`canActivate(context) → Promise<boolean>`
Evaluates feature flag from metadata; returns true if no flag set or flag enabled.

### ImpersonatePermissionGuard
`file:src/engine/guards/impersonate-permission.guard.ts:20`
`implements CanActivate`
`canActivate(context) → Promise<boolean>`
Throws PermissionsException if userWorkspaceId missing (can't impersonate via API key). Otherwise checks user.canImpersonate or IMPERSONATE permission.

### JwtAuthGuard
`file:src/engine/guards/jwt-auth.guard.ts:15`
`implements CanActivate`
`canActivate(context) → Promise<boolean>`
Validates JWT token via AccessTokenService, binds data to request (user, workspace, apiKey, etc.), fetches metadata version. Returns false on auth failure (logged as warning).

### NoImpersonationGuard
`file:src/engine/guards/no-impersonation.guard.ts:10`
`implements CanActivate`
`canActivate(context) → boolean`
Throws ForbiddenException if request.impersonationContext indicates active impersonation.

### NoPermissionGuard
`file:src/engine/guards/no-permission.guard.ts:21`
`implements CanActivate`
`canActivate(context) → boolean`
Always returns true. Documents that endpoint intentionally bypasses permission checks (onboarding, self-service).

### PublicEndpointGuard
`file:src/engine/guards/public-endpoint.guard.ts:15`
`implements CanActivate`
`canActivate(context) → boolean`
Always returns true. Explicitly documents public/unprotected endpoint.

### ServerLevelImpersonateGuard
`file:src/engine/guards/server-level-impersonate.guard.ts:4`
`implements CanActivate`
`canActivate(context) → boolean`
Returns true if user.canImpersonate === true (server-wide impersonation).

### SettingsPermissionGuard
`file:src/engine/guards/settings-permission.guard.ts:21`
`(requiredPermission: PermissionFlagType) → Type<CanActivate>`
Factory guard checking workspace-level permission flag. Skips check during workspace creation phases (PENDING_CREATION, ONGOING_CREATION).

### UserAuthGuard
`file:src/engine/guards/user-auth.guard.ts:6`
`implements CanActivate`
`canActivate(context) → boolean`
Returns true if request.user is defined.

### WorkspaceAuthGuard
`file:src/engine/guards/workspace-auth.guard.ts:12`
`implements CanActivate`
`canActivate(context) → boolean`
Returns true if request.workspace exists.

## middlewares

### GraphQLHydrateRequestFromTokenMiddleware
`file:src/engine/middlewares/graphql-hydrate-request-from-token.middleware.ts:8`
`implements NestMiddleware`
`use(req, res, next) → Promise<void>`
Calls middlewareService.hydrateGraphqlRequest() to extract token and bind auth data. On exception, writes GraphQL error response.

### RestCoreMiddleware
`file:src/engine/middlewares/rest-core.middleware.ts:8`
`implements NestMiddleware`
`use(req, res, next) → Promise<void>`
Calls middlewareService.hydrateRestRequest() to validate token and bind auth data. On exception, writes REST error response.

### MiddlewareService
`file:src/engine/middlewares/middleware.service.ts:26`
`constructor(accessTokenService, workspaceStorageCache, flatEntityMapsCacheService, exceptionHandlerService, jwtWrapperService) → void`
Core token validation and request hydration for GraphQL and REST endpoints.

### isTokenPresent
`file:src/engine/middlewares/middleware.service.ts:35`
`(request: Request) → boolean`
Checks if JWT token exists in request (header or query param).

### writeRestResponseOnExceptionCaught
`file:src/engine/middlewares/middleware.service.ts:42`
`(res, error) → void`
Writes REST error response (JSON with statusCode, messages, error code). Captures custom exceptions via exceptionHandlerService.

### writeGraphqlResponseOnExceptionCaught
`file:src/engine/middlewares/middleware.service.ts:65`
`(res, error) → void`
Writes GraphQL error response (200 status, errors array). Handles AuthException via AuthGraphqlApiExceptionFilter.

### hydrateRestRequest
`file:src/engine/middlewares/middleware.service.ts:100`
`(request: Request) → Promise<void>`
Validates token, fetches metadata version, throws if no workspace/schema. Binds auth data to request.

### hydrateGraphqlRequest
`file:src/engine/middlewares/middleware.service.ts:119`
`(request: Request) → Promise<void>`
If no token, sets default locale. If token present, validates and binds auth data + metadata version.

## object-metadata-repository

### InjectObjectMetadataRepository
`file:src/engine/object-metadata-repository/object-metadata-repository.decorator.ts:8`
`(objectMetadata) → Inject`
Creates Inject token for repository class (e.g., "BlocklistRepository") based on object metadata name.

### ObjectMetadataRepositoryModule
`file:src/engine/object-metadata-repository/object-metadata-repository.module.ts:18`
`forFeature(objectMetadatas) → DynamicModule`
Factory creating repository providers for each object metadata. Maps metadata name to repository class via metadataToRepositoryMapping, instantiates with GlobalWorkspaceOrmManager.

## subscriptions

### EventStreamService
`file:src/engine/subscriptions/event-stream.service.ts:23`
`implements OnModuleInit`
`constructor(cacheStorageService, cacheLockService, metricsService) → void`
Manages event stream lifecycle: create, destroy, add/remove queries, refresh TTL. Streams stored in Redis with 30-min TTL.

### getTotalActiveStreamCount
`file:src/engine/subscriptions/event-stream.service.ts:44`
`() → Promise<number>`
Scans Redis for active streams across all workspaces (pattern workspace:*:activeStreams).

### createEventStream
`file:src/engine/subscriptions/event-stream.service.ts:50`
`(workspaceId, eventStreamChannelId, authContext) → Promise<void>`
Creates event stream in Redis with empty queries, throws if already exists.

### destroyEventStream
`file:src/engine/subscriptions/event-stream.service.ts:90`
`(workspaceId, eventStreamChannelId) → Promise<void>`
Deletes event stream and removes from active set.

### getActiveStreamIds
`file:src/engine/subscriptions/event-stream.service.ts:110`
`(workspaceId: string) → Promise<string[]>`
Returns all active stream channel IDs for workspace.

### removeFromActiveStreams
`file:src/engine/subscriptions/event-stream.service.ts:116`
`(workspaceId, streamIdsToRemove) → Promise<void>`
Removes stream IDs from active set (idempotent).

### getStreamsData
`file:src/engine/subscriptions/event-stream.service.ts:134`
`(workspaceId, streamChannelIds) → Promise<Map<streamId, EventStreamData>>`
Batch-fetches stream data from Redis.

### isAuthorized
`file:src/engine/subscriptions/event-stream.service.ts:156`
`(authContext, streamData) → Promise<boolean>`
Checks if authContext (user or API key) matches stream's creator.

### addQuery
`file:src/engine/subscriptions/event-stream.service.ts:177`
`@WithLock(eventStreamChannelId) (workspaceId, eventStreamChannelId, queryId, operationSignature) → Promise<void>`
Adds GraphQL query subscription to stream. Idempotent if stream missing.

### removeQuery
`file:src/engine/subscriptions/event-stream.service.ts:201`
`@WithLock(eventStreamChannelId) (workspaceId, eventStreamChannelId, queryId) → Promise<void>`
Removes query from stream, re-stores if found.

### refreshEventStreamTTL
`file:src/engine/subscriptions/event-stream.service.ts:219`
`(workspaceId, eventStreamChannelId) → Promise<boolean>`
Refreshes both event stream and active streams keys to 30-min TTL.

### getStreamData
`file:src/engine/subscriptions/event-stream.service.ts:251`
`(workspaceId, eventStreamChannelId) → Promise<EventStreamData | undefined>`
Fetches single stream data from Redis.

### SubscriptionService
`file:src/engine/subscriptions/subscription.service.ts:7`
`constructor(redisClient) → void`
Pub/Sub wrapper for Redis client managing subscription channels.

### subscribe
`file:src/engine/subscriptions/subscription.service.ts:30`
`(channel, workspaceId) → Promise<AsyncIterator>`
Subscribes to workspace+channel topic (e.g., "object-record-events:workspace-123").

### subscribeToEventStream
`file:src/engine/subscriptions/subscription.service.ts:44`
`(workspaceId, eventStreamChannelId) → Promise<AsyncIterator>`
Subscribes to event stream channel.

### publish
`file:src/engine/subscriptions/subscription.service.ts:58`
`(channel, payload, workspaceId) → Promise<void>`
Publishes payload to workspace+channel.

### publishToEventStream
`file:src/engine/subscriptions/subscription.service.ts:75`
`(workspaceId, eventStreamChannelId, payload) → Promise<void>`
Publishes to event stream channel.

### subscribeToAgentChat
`file:src/engine/subscriptions/subscription.service.ts:102`
`(workspaceId, threadId) → Promise<AsyncIterator>`
Subscribes to agent chat thread.

### publishToAgentChat
`file:src/engine/subscriptions/subscription.service.ts:116`
`(workspaceId, threadId, payload) → Promise<void>`
Publishes to agent chat thread.

### EventStreamResolver
`file:src/engine/subscriptions/event-stream.resolver.ts:38`
`@MetadataResolver() @UseGuards(WorkspaceAuthGuard, UserAuthGuard, NoPermissionGuard)`
GraphQL subscription/mutation resolver for event streams.

### onEventSubscription
`file:src/engine/subscriptions/event-stream.resolver.ts:57`
`@Subscription() (eventStreamId, workspace, user, userWorkspaceId, apiKey) → AsyncIterableIterator<EventSubscriptionDTO>`
GraphQL subscription: subscribes client to event stream, destroys if conflict, wraps iterator with TTL refresh and cleanup callbacks.

### addQueryToEventStream
`file:src/engine/subscriptions/event-stream.resolver.ts:139`
`@Mutation() (input, workspace, user, userWorkspaceId, apiKey) → Promise<boolean>`
Adds query to event stream, returns false if stream missing, throws on authorization failure.

### removeQueryFromEventStream
`file:src/engine/subscriptions/event-stream.resolver.ts:183`
`@Mutation() (input, workspace, user, userWorkspaceId, apiKey) → Promise<boolean>`
Removes query from event stream, returns false if stream missing.

### MetadataEventEmitter
`file:src/engine/subscriptions/metadata-event/metadata-event-emitter.ts:24`
`constructor(eventEmitter: EventEmitter2) → void`
Emits batched metadata events (create/update/delete) via EventEmitter2.

### emitMetadataEvents
`file:src/engine/subscriptions/metadata-event/metadata-event-emitter.ts:27`
`(metadataEvents, workspaceId, initiatorContext?) → void`
Groups events by metadata name + action, emits to "metadata.{name}.{type}" channel. Extracts userId/apiKeyId from context.

### MetadataEventPublisher
`file:src/engine/subscriptions/metadata-event/metadata-event-publisher.ts:19`
`constructor(workspaceEventBroadcaster, flatEntityMapsCacheService, navigationMenuItemRecordIdentifierService, i18nService) → void`
Enriches metadata event batches and broadcasts to active streams.

### publish
`file:src/engine/subscriptions/metadata-event/metadata-event-publisher.ts:27`
`(metadataEventBatch) → Promise<void>`
Enriches batch based on metadata name (fieldMetadata, navigationMenuItem, commandMenuItem, objectMetadata), broadcasts to stream subscribers.

### MetadataEventsToDbListener
`file:src/engine/subscriptions/metadata-event/metadata-events-to-db.listener.ts:18`
`@OnEvent('metadata.*.created|updated|deleted')`
Listens for metadata event batches, queues webhook jobs, invalidates workspace cache, publishes to event broadcaster.

### handleCreate/handleUpdate/handleDelete
`file:src/engine/subscriptions/metadata-event/metadata-events-to-db.listener.ts:26`
`(metadataEventBatch) → Promise<void>`
Routes to handleEvent; enqueues webhook jobs and publishes enriched batch.

### ObjectRecordEventPublisher
`file:src/engine/subscriptions/object-record-event/object-record-event-publisher.ts:52`
`constructor(subscriptionService, eventStreamService, workspaceCacheService, processNestedRelationsHelper, flatEntityMapsCacheService, globalWorkspaceOrmManager, commonSelectFieldsHelper) → void`
Publishes object record CRUD events to active event streams, respecting row-level permissions and restricted fields.

### publish
`file:src/engine/subscriptions/object-record-event/object-record-event-publisher.ts:63`
`(eventBatch: WorkspaceEventBatch<ObjectRecordEvent>) → Promise<void>`
Fetches active streams, permissions context, processes events per stream (filters by RLS + permissions), enriches with nested relations, publishes to matching queries.

### computeMetadataEventName
`file:src/engine/subscriptions/metadata-event/utils/compute-metadata-event-name.util.ts:3`
`(metadataName, type) → string`
Computes event name: "metadata.{metadataName}.{type}" (e.g., "metadata.fieldMetadata.created").

### enrichCommandMenuItemEventWithResolvedNavigation
`file:src/engine/subscriptions/metadata-event/utils/enrich-command-menu-item-event-with-resolved-navigation.util.ts:23`
`(record, flatObjectMetadataMaps, locale, i18nInstance) → FlatCommandMenuItem`
Interpolates command menu item template placeholders (label, shortLabel, icon) with object metadata context.

### enrichFieldMetadataEventWithRelations
`file:src/engine/subscriptions/metadata-event/utils/enrich-field-metadata-event-with-relations.util.ts:18`
`(record, flatFieldMetadataMaps, flatObjectMetadataMaps) → Record<string, unknown>`
Enriches field metadata event with resolved relation or morphRelations, catches exceptions and returns original record.

### resolveOverridableEntityEventBatchOverrides
`file:src/engine/subscriptions/metadata-event/utils/sanitize-overridable-entity-event-batch.util.ts:44`
`(metadataEventBatch) → MetadataEventBatch`
For viewField/viewFieldGroup/pageLayoutTab/pageLayoutWidget, merges overrides into base record for before/after.

### WorkspaceEventBroadcaster
`file:src/engine/subscriptions/workspace-event-broadcaster/workspace-event-broadcaster.service.ts:11`
`constructor(eventStreamService, subscriptionService) → void`
Broadcasts metadata events to active event streams, filtering by user scope if recipientUserWorkspaceIds set.

### broadcast
`file:src/engine/subscriptions/workspace-event-broadcaster/workspace-event-broadcaster.service.ts:17`
`(workspaceId, events, updatedCollectionHash?) → Promise<void>`
Fetches active streams, filters events per stream user, publishes to event stream channels.

### eventStreamIdToChannelId
`file:src/engine/subscriptions/utils/get-channel-id-from-event-stream-id.ts:5`
`(eventStreamId: string) → string`
Converts eventStreamId to stable channel ID using UUID v5 with fixed namespace.

### wrapAsyncIteratorWithLifecycle
`file:src/engine/subscriptions/utils/wrap-async-iterator-with-lifecycle.ts:10`
`(iterator, options) → AsyncIterableIterator<T>`
Wraps async iterator to yield initial value, heartbeat (refresh TTL), cleanup on completion/error. Manages Node intervals.

## trash-cleanup

### TrashCleanupService
`file:src/engine/trash-cleanup/services/trash-cleanup.service.ts:18`
`constructor(flatEntityMapsCacheService, globalWorkspaceOrmManager) → void`
Permanently deletes soft-deleted records exceeding retention period.

### cleanupWorkspaceTrash
`file:src/engine/trash-cleanup/services/trash-cleanup.service.ts:29`
`(workspaceId, trashRetentionDays) → Promise<number>`
Iterates all objects, deletes soft-deleted records older than cutoff date in batches. Returns total deleted count (capped at maxRecordsPerWorkspace).

### deleteSoftDeletedRecords (private)
`file:src/engine/trash-cleanup/services/trash-cleanup.service.ts:87`
`(workspaceId, objectName, cutoffDate, remainingQuota) → Promise<number>`
Batch-deletes soft-deleted records (deletedAt < cutoffDate) with system auth bypass. Returns deleted count.

### calculateCutoffDate (private)
`file:src/engine/trash-cleanup/services/trash-cleanup.service.ts:145`
`(trashRetentionDays: number) → Date`
Computes cutoff date: today (UTC 00:00) minus retention days + 1.

### TrashCleanupCronJob
`file:src/engine/trash-cleanup/crons/trash-cleanup.cron.job.ts:23`
`@Processor(cronQueue) constructor(workspaceRepository, messageQueueService, exceptionHandlerService) → void`
Cron job handler running on schedule, enqueues trash-cleanup jobs per active workspace.

### handle
`file:src/engine/trash-cleanup/crons/trash-cleanup.cron.job.ts:36`
`@Process(TrashCleanupCronJob.name) @SentryCronMonitor() () → Promise<void>`
Fetches active workspaces, enqueues TrashCleanupJob per workspace with trash retention setting.

### TrashCleanupCronCommand
`file:src/engine/trash-cleanup/commands/trash-cleanup.cron.command.ts:13`
`extends CommandRunner`
CLI command: "cron:trash-cleanup" — registers cron job with pattern.

### run
`file:src/engine/trash-cleanup/commands/trash-cleanup.cron.command.ts:21`
`() → Promise<void>`
Adds cron job via messageQueue with TRASH_CLEANUP_CRON_PATTERN.

### TrashCleanupJob
`file:src/engine/trash-cleanup/jobs/trash-cleanup.job.ts:15`
`@Processor(workspaceQueue) constructor(trashCleanupService) → void`
Background job processor: executes trash cleanup per workspace.

### handle
`file:src/engine/trash-cleanup/jobs/trash-cleanup.job.ts:21`
`@Process(TrashCleanupJob.name) (data: TrashCleanupJobData) → Promise<void>`
Calls trashCleanupService.cleanupWorkspaceTrash(), logs errors and re-throws.

## workspace-cache

### WorkspaceCacheService
`file:src/engine/workspace-cache/services/workspace-cache.service.ts:42`
`implements OnModuleInit`
`constructor(cacheStorage, discoveryService, reflector) → void`
Multi-layer cache (local + Redis) for workspace-scoped metadata: 100ms local TTL, Redis hash validation, fall-back to provider recompute. Supports local-data-only keys.

### getOrRecompute<K extends WorkspaceCacheKeyName[]>
`file:src/engine/workspace-cache/services/workspace-cache.service.ts:99`
`(workspaceId, cacheKeyNames) → Promise<WorkspaceCacheResult<K>>`
Retrieves or recomputes multiple cache keys. Stages: 1) check local TTL, 2) validate local hash vs Redis, 3) fetch from Redis, 4) recompute missing. Memoizes to dedupe concurrent requests.

### invalidateAndRecompute
`file:src/engine/workspace-cache/services/workspace-cache.service.ts:163`
`(workspaceId, cacheKeyNames) → Promise<void>`
Clears memoizer, flushes Redis + local, recomputes from providers, clears memoizer again to evict stale concurrent entries.

### getCacheHashes
`file:src/engine/workspace-cache/services/workspace-cache.service.ts:177`
`(workspaceId, cacheKeyNames) → Promise<Record<WorkspaceCacheKeyName, string>>`
Fetches Redis hashes for cache keys (used by metadata event publisher to track collection versions).

### flush
`file:src/engine/workspace-cache/services/workspace-cache.service.ts:202`
`(workspaceId, cacheKeyNames) → Promise<void>`
Deletes Redis data + hashes, marks local entries stale.

### onModuleInit
`file:src/engine/workspace-cache/services/workspace-cache.service.ts:65`
`() → void`
Discovers and registers all WorkspaceCacheProvider instances.

## workspace-cache-storage

### WorkspaceCacheStorageService
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:41`
`constructor(cacheStorageService) → void`
Stores GraphQL, ORM, and metadata versioned data. Separate from WorkspaceCacheService; handles GraphQL type defs, ORM entity schemas, feature flags, permissions.

### setORMEntitySchema/getORMEntitySchema
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:47`
`(workspaceId, metadataVersion, entitySchemas) → Promise<void/EntitySchemaOptions<any>[]>`
Caches ORM entity schemas per metadata version (1-week TTL).

### setMetadataVersion/getMetadataVersion
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:72`
`(workspaceId, metadataVersion) → Promise<void/number>`
Tracks metadata version per workspace.

### setGraphQLTypeDefs/getGraphQLTypeDefs
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:89`
`(workspaceId, metadataVersion, typeDefs, applicationId?) → Promise<void/string>`
Caches GraphQL schema per workspace+version, optionally per application.

### setGraphQLUsedScalarNames/getGraphQLUsedScalarNames
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:116`
`(workspaceId, metadataVersion, usedScalarNames, applicationId?) → Promise<void/string[]>`
Caches custom scalar names used in schema.

### setFeatureFlagsMap/getFeatureFlagsMap
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:163`
`(workspaceId, featureFlagMap) → Promise<{newFeatureFlagMapVersion}>/FeatureFlagMap`
Stores feature flags + generates version hash.

### flushGraphQLOperation
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:187`
`(operationName, workspaceId) → Promise<void>`
Flushes cached GraphQL operations by name pattern.

### flushVersionedMetadata
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:199`
`(workspaceId, metadataVersion?) → Promise<void>`
Deletes versioned metadata (schemas, type defs, scalar names) for workspace+version or all versions.

### flush
`file:src/engine/workspace-cache-storage/workspace-cache-storage.service.ts:217`
`(workspaceId, metadataVersion?) → Promise<void>`
Full flush: versioned + non-versioned keys.

### GetDataFromCacheWithRecomputeService
`file:src/engine/workspace-cache-storage/services/get-data-from-cache-with-recompute.service.ts:17`
`constructor() → void`
Generic recompute pattern: checks version + data cache, recomputes if missing, stores in memory cache by {workspaceId}-{version}.

### getFromCacheWithRecompute
`file:src/engine/workspace-cache-storage/services/get-data-from-cache-with-recompute.service.ts:23`
`(workspaceId, getCacheData, getCacheVersion, recomputeCache, cachedEntityName, exceptionCode) → Promise<CacheResult<T,U>>`
Fetches version; if cached in-memory, returns. Else fetches data; if missing, triggers recompute + refetch. Throws if still missing after recompute.

## workspace-datasource

### WorkspaceDataSourceService
`file:src/engine/workspace-datasource/workspace-datasource.service.ts:21`
`constructor(workspaceRepository, coreDataSource, twentyConfigService) → void`
Manages workspace database schemas (create/delete/check).

### checkSchemaExists
`file:src/engine/workspace-datasource/workspace-datasource.service.ts:40`
`(workspaceId) → Promise<boolean>`
Returns true if workspace has non-empty databaseSchema.

### createWorkspaceDBSchema
`file:src/engine/workspace-datasource/workspace-datasource.service.ts:56`
`(workspaceId) → Promise<string>`
Creates new database schema with workspace name. Throws if DDL locked. Returns schema name.

### deleteWorkspaceDBSchema
`file:src/engine/workspace-datasource/workspace-datasource.service.ts:78`
`(workspaceId) → Promise<void>`
Drops database schema (cascade). Throws if DDL locked.

### executeRawQuery
`file:src/engine/workspace-datasource/workspace-datasource.service.ts:91`
`(query, parameters, workspaceId, transactionManager?) → Promise<never>`
Always throws PermissionsException: "Method not allowed" (permissions not handled at datasource level).

### getWorkspaceSchemaName
`file:src/engine/workspace-datasource/utils/get-workspace-schema-name.util.ts:3`
`(workspaceId: string) → string`
Converts UUID to base36 then formats: "workspace_{base36}".

## workspace-event-emitter

### WorkspaceEventEmitter
`file:src/engine/workspace-event-emitter/workspace-event-emitter.ts:39`
`constructor(eventEmitter: EventEmitter2) → void`
Emits workspace database and custom batch events via EventEmitter2.

### emitDatabaseBatchEvent
`file:src/engine/workspace-event-emitter/workspace-event-emitter.ts:42`
`(databaseBatchEventInput) → void`
Emits batch of object record CRUD events (created/updated/deleted/destroyed/restored/upserted) to "{objectName}.{action}" channel.

### emitCustomBatchEvent
`file:src/engine/workspace-event-emitter/workspace-event-emitter.ts:73`
`(eventName, events, workspaceId) → void`
Emits custom batch event to arbitrary event name.

### computeEventName
`file:src/engine/workspace-event-emitter/utils/compute-event-name.ts:3`
`(objectName: string, action: string) → string`
Constructs event name: "{objectName}.{action}". Validates action is valid DatabaseEventAction.

### parseEventNameOrThrow
`file:src/engine/workspace-event-emitter/utils/parse-event-name.ts:5`
`(eventName: string) → {objectSingularName, action}`
Splits "{objectName}.{action}"; validates action; throws if malformed.

## utils

### bindDataToRequestObject
`file:src/engine/utils/bind-data-to-request-object.util.ts:6`
`(data, request, metadataVersion) → void`
Attaches auth context to Express request: user, workspace, apiKey, userWorkspaceId, workspaceMemberId, locale, etc.

### computeObjectTargetTable
`file:src/engine/utils/compute-object-target-table.util.ts:5`
`(objectMetadata) → string`
Returns table name: custom objects prefixed with "_", standard objects as-is.

### computeTableName
`file:src/engine/utils/compute-table-name.util.ts:3`
`(nameSingular: string, isCustom: boolean) → string`
Prefixes custom table names with "_".

### convertObjectMetadataToSchemaProperties
`file:src/engine/utils/convert-object-metadata-to-schema-properties.util.ts:90`
`(item, forResponse) → Record<string, SchemaObject>`
Generates JSON Schema properties for object metadata fields. Handles relations (join column), composite types (fullName, address, currency, etc.), selects/multi-selects, arrays. Skips one-to-many, TS vectors.

### generateFakeValue
`file:src/engine/utils/generate-fake-value.ts:78`
`(valueType, classification) → FakeValueTypes`
Generates fake values for testing: primitives (string, number, boolean, Date, arrays), FieldMetadataTypes (text, number, date, uuid, etc.).

### getResolverName
`file:src/engine/utils/get-resolver-name.util.ts:8`
`(objectMetadata, type) → string`
Generates GraphQL resolver name from operation type: findMany → camelCase(namePlural), createOne → create{PascalCase(nameSingular)}, etc.

### handleExceptionAndConvertToGraphQLError
`file:src/engine/utils/global-exception-handler.util.ts:45`
`(exception, exceptionHandlerService, user?, workspace?) → BaseGraphQLError`
Captures exception via exceptionHandlerService, converts to GraphQL error. Filters <500 status codes.

### shouldCaptureException
`file:src/engine/utils/global-exception-handler.util.ts:61`
`(exception, statusCode?) → boolean`
Returns false for <500 status codes, predefined GraphQL error codes, HttpException <500. Otherwise true.

### handleException
`file:src/engine/utils/global-exception-handler.util.ts:90`
`(exception, exceptionHandlerService, user?, workspace?, statusCode?) → T`
Conditionally captures exception based on shouldCaptureException logic. Returns exception unchanged.

### convertExceptionToGraphQLError
`file:src/engine/utils/global-exception-handler.util.ts:112`
`(exception) → BaseGraphQLError`
Converts HttpException/BaseGraphQLError/generic Error to GraphQLError. Shows stack in development.

### isDomain
`file:src/engine/utils/is-domain.ts:1`
`(url) → boolean`
Tests regex: valid domain name (RFC-compliant, allows xn-- punycode).

### isFieldMetadataEntityOfType<Field, Type>
`file:src/engine/utils/is-field-metadata-of-type.util.ts:5`
`(fieldMetadata, type) → boolean`
Type guard: checks fieldMetadata.type === type.

### isMorphOrRelationFieldMetadataType
`file:src/engine/utils/is-morph-or-relation-field-metadata-type.util.ts:7`
`(type) → type is MorphOrRelationFieldMetadataType`
Returns true if type is RELATION or MORPH_RELATION.

### isMorphRelationFieldMetadataType
`file:src/engine/utils/is-morph-relation-field-metadata-type.util.ts:3`
`(type) → type is FieldMetadataType.MORPH_RELATION`
Returns true if type === MORPH_RELATION.

### isQueryTimeoutError
`file:src/engine/utils/query-timeout.util.ts:1`
`(error) → boolean`
Checks if error message includes "Query read timeout".

### renderApolloPlayground
`file:src/engine/utils/render-apollo-playground.util.ts:5`
`(path?) → string`
Returns HTML embedding Apollo Sandbox at endpoint (default /graphql).

### sanitizeNumber
`file:src/engine/utils/sanitize-number.utli.ts:2`
`(value) → number | null`
Returns null if value is null/undefined/NaN, otherwise returns value.

### transformEnumValue
`file:src/engine/utils/transform-enum-value.ts:3`
`(options?) → FieldMetadataDefaultOption[]`
Prefixes numeric option values with "_" (GraphQL enum naming requirement).

## constants

### settings
`file:src/engine/constants/settings/index.ts:3`
Object containing app-wide settings: image crop sizes (profile-picture, workspace-logo, person-picture), max file size (10MB), min duplicate check string length (3), max visible view fields (30).

---

**Total function count: ~220 exported/notable functions and methods**

**Coverage: Complete** — All files in assigned directories documented.

