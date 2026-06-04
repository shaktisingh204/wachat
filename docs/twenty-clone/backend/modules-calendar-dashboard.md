# Calendar, Dashboard, Dashboard-Sync, and Timeline Modules

Backend service documentation for calendar event import/sync, dashboard management, chart data, and timeline activity tracking in the twenty-server monorepo.

---

## modules/calendar/calendar-event-import-manager

### CalendarEventsImportService

`file: src/modules/calendar/calendar-event-import-manager/services/calendar-events-import.service.ts:38`

**Method: `processCalendarEventsImport(calendarChannel, connectedAccount, workspaceId, fetchedCalendarEvents?) → Promise<void>`**

Orchestrates the import of calendar events into the workspace. Fetches queued event IDs from cache, retrieves full event details from the provider (Microsoft), filters events based on blocklist and calendar handles, saves events in batches (1000 per transaction), creates/updates participants, and updates sync status. Marks as completed after successful import or delegates error handling to exception handler service.

### CalendarFetchEventsService

`file: src/modules/calendar/calendar-event-import-manager/services/calendar-fetch-events.service.ts:26`

**Method: `fetchCalendarEvents(calendarChannel, connectedAccount, workspaceId) → Promise<void>`**

Initiates the event list fetch phase. Calls the calendar provider's event list API via `getCalendarEventsService`, updates the sync cursor, and either enqueues event IDs for import or directly imports full events if returned by the provider. Updates sync status to reflect progress.

### CalendarGetCalendarEventsService

`file: src/modules/calendar/calendar-event-import-manager/services/calendar-get-events.service.ts:23`

**Method: `getCalendarEvents(connectedAccount, syncCursor?) → Promise<GetCalendarEventsResponse>`**

Provider-agnostic dispatcher that routes to Google, Microsoft, or CalDAV drivers based on `connectedAccount.provider`. Returns either full event objects or event IDs for batch fetching, plus a new sync cursor.

### CalendarSaveEventsService

`file: src/modules/calendar/calendar-event-import-manager/services/calendar-save-events.service.ts:23`

**Method: `saveCalendarEventsAndEnqueueContactCreationJob(fetchedCalendarEvents, calendarChannel, connectedAccount, workspaceId) → Promise<void>`**

Transactional save of calendar events. Finds existing events by external ID, inserts new ones with UUID, updates existing ones, creates/updates channel-event associations, handles participant lifecycle (create/update/delete), and enqueues contact creation job if auto-creation is enabled.

### CalendarEventImportErrorHandlerService

`file: src/modules/calendar/calendar-event-import-manager/services/calendar-event-import-exception-handler.service.ts:31`

**Method: `handleDriverException(exception, syncStep, calendarChannel, workspaceId) → Promise<void>`**

Error classification and handling. Routes to specific handlers based on exception type: sync cursor errors reset sync state, temporary errors increment throttle counter and retry (up to `CALENDAR_THROTTLE_MAX_ATTEMPTS`), insufficient permission errors mark account as needing reconnection, and unknown errors fail the channel with logging and metrics.

---

## modules/calendar/calendar-event-import-manager/drivers/caldav

### CalDavFetchEventsService

`file: src/modules/calendar/calendar-event-import-manager/drivers/caldav/services/caldav-fetch-events.service.ts:36`

**Method: `fetchEvents(client, options) → Promise<{events: FetchedCalendarEvent[], syncCursor: CalDavSyncCursor}>`**

Fetches events from all CalDAV calendars. Supports sync-collection protocol (incremental) or fallback to ctag/etag comparison (full re-fetch if ctag changed). Merges results across calendars and returns new sync cursor for next run.

**Method: `listEventCalendars(client) → Promise<DAVCalendar[]>`**

Returns all VEVENT-supporting calendars from the CalDAV server.

### CalDavGetEventsService

`file: src/modules/calendar/calendar-event-import-manager/drivers/caldav/services/caldav-get-events.service.ts:10`

**Method: `getCalendarEvents(connectedAccountId, syncCursor?) → Promise<GetCalendarEventsResponse>`**

Wraps CalDAV fetch with 5-year past and 1-year future date windows. Returns full events in JSON format. Parses and propagates CalDAV errors.

---

## modules/calendar/calendar-event-import-manager/drivers/google-calendar

### GoogleCalendarGetEventsService

`file: src/modules/calendar/calendar-event-import-manager/drivers/google-calendar/services/google-calendar-get-events.service.ts:14`

**Method: `getCalendarEvents(connectedAccount, syncCursor?) → Promise<GetCalendarEventsResponse>`**

Fetches Google Calendar events using OAuth2 auth. Paginated list (500 events/page) with sync token for incremental fetches. Handles network errors and HTTP 410 (sync token expired) by resetting. Returns formatted events.

---

## modules/calendar/calendar-event-import-manager/drivers/microsoft-calendar

### MicrosoftCalendarImportEventsService

`file: src/modules/calendar/calendar-event-import-manager/drivers/microsoft-calendar/services/microsoft-calendar-import-events.service.ts`

Batch fetches full event details from Microsoft Graph for a list of external event IDs. Used when provider returns only IDs (not full events) from initial fetch.

---

## modules/calendar/calendar-event-participant-manager

### CalendarEventParticipantService

`file: src/modules/calendar/calendar-event-participant-manager/services/calendar-event-participant.service.ts:36`

**Method: `upsertAndDeleteCalendarEventParticipants({participantsToCreate, participantsToUpdate, ...}) → Promise<void>`**

Manages participant lifecycle in chunks (200 at a time). Separates new from existing participants, deletes removed ones, updates existing, and inserts new. Enqueues contact creation job if enabled and matches participants to workspace members/persons.

---

## modules/calendar/calendar-event-cleaner

### CalendarEventCleanerService

`file: src/modules/calendar/calendar-event-cleaner/services/calendar-event-cleaner.service.ts:11`

**Method: `deleteCalendarChannelEventAssociationsByChannelId({workspaceId, calendarChannelId}) → Promise<void>`**

Paginated (500 per iteration) deletion of channel-event associations when a channel is removed.

**Method: `cleanWorkspaceCalendarEvents(workspaceId) → Promise<void>`**

Removes orphaned calendar events (those with no associations) via pagination, preventing data bloat after event cancellations.

---

## modules/calendar/common/services

### CalendarChannelSyncStatusService

`file: src/modules/calendar/common/services/calendar-channel-sync-status.service.ts:23`

**Method: `markAsCalendarEventListFetchPending(calendarChannelIds, workspaceId, preserveSyncStageStartedAt?) → Promise<void>`**

Sets sync stage to `CALENDAR_EVENT_LIST_FETCH_PENDING`, optionally preserving the started-at timestamp.

**Method: `markAsCalendarEventListFetchOngoing(calendarChannelIds, workspaceId) → Promise<void>`**

Sets to `CALENDAR_EVENT_LIST_FETCH_ONGOING` with `ONGOING` status and current timestamp.

**Method: `markAsCalendarEventsImportPending(calendarChannelIds, workspaceId, preserveSyncStageStartedAt?) → Promise<void>`**

Moves to `CALENDAR_EVENTS_IMPORT_PENDING`.

**Method: `markAsCalendarEventsImportOngoing(calendarChannelIds, workspaceId) → Promise<void>`**

Moves to `CALENDAR_EVENTS_IMPORT_ONGOING` with current timestamp.

**Method: `markAsCompletedAndMarkAsCalendarEventListFetchPending(calendarChannelIds, workspaceId) → Promise<void>`**

Completes sync cycle: sets status to `ACTIVE`, resets throttle counter, updates `syncedAt`, and increments metrics.

**Method: `markAsFailedInsufficientPermissionsAndFlushCalendarEventsToImport(calendarChannelIds, workspaceId) → Promise<void>`**

Marks auth failure, clears queued events, marks connected account as needing reconnection, and increments failure metrics.

**Method: `resetAndMarkAsCalendarEventListFetchPending(calendarChannelIds, workspaceId) → Promise<void>`**

Clears sync cursor and queued events, resets throttle count, used for sync-token invalidation recovery.

---

## modules/calendar/calendar-event-import-manager/jobs

### CalendarEventListFetchJob

`file: src/modules/calendar/calendar-event-import-manager/jobs/calendar-event-list-fetch.job.ts:24`

**Process: `handle(data: CalendarEventListFetchJobData) → Promise<void>`**

Message queue processor. Verifies channel sync is enabled and in `CALENDAR_EVENT_LIST_FETCH_SCHEDULED` state, then invokes `calendarFetchEventsService`.

### CalendarEventsImportJob

`file: src/modules/calendar/calendar-event-import-manager/jobs/calendar-events-import.job.ts:24`

**Process: `handle(data: CalendarEventsImportJobData) → Promise<void>`**

Message queue processor for event import. Checks sync enabled and `CALENDAR_EVENTS_IMPORT_SCHEDULED` state before processing.

---

## modules/calendar/calendar-event-import-manager/commands

### CalendarTriggerEventListFetchCommand

`file: src/modules/calendar/calendar-event-import-manager/commands/calendar-trigger-event-list-fetch.command.ts:29`

**Method: `run(_passedParam, options) → Promise<void>`**

CLI command to manually trigger event list fetch. Finds channels in `CALENDAR_EVENT_LIST_FETCH_PENDING` status (optionally filtered by channel ID), marks them as `SCHEDULED`, and enqueues jobs. Supports `--workspace-id` (required) and `--calendar-channel-id` (optional) options.

---

## modules/calendar/calendar-event-import-manager/utils

### filterEventsAndReturnCancelledEvents

`file: src/modules/calendar/calendar-event-import-manager/utils/filter-events.util.ts:4`

**Function: `(calendarChannelHandles, events, blocklist) → {filteredEvents, cancelledEvents}`**

Filters events by blocklist and organizer, separates cancelled events from active ones. Used to exclude events from blocked senders and split processing path.

---

## modules/dashboard

### DashboardDuplicationService

`file: src/modules/dashboard/services/dashboard-duplication.service.ts:20`

**Method: `duplicateDashboard(dashboardId, authContext) → Promise<DuplicatedDashboardDTO>`**

Clones a dashboard: duplicates its associated page layout (with all tabs/widgets) and creates a new dashboard entity linked to the new layout. Appends " (copy)" to title.

### DashboardToPageLayoutSyncService

`file: src/modules/dashboard/services/dashboard-to-page-layout-sync.service.ts:14`

**Method: `createPageLayoutForDashboard({workspaceId}) → Promise<string>`**

Creates a new dashboard page layout and a default "Tab 1", returns layout ID.

**Method: `destroyPageLayoutsForDashboards({dashboardIds, workspaceId}) → Promise<void>`**

Finds all page layouts linked to dashboards and deletes them.

---

## modules/dashboard/resolvers

### DashboardResolver

`file: src/modules/dashboard/resolvers/dashboard.resolver.ts:22`

**Mutation: `duplicateDashboard(id) → Promise<DuplicatedDashboardDTO>`**

GraphQL mutation endpoint. Calls duplication service and returns new dashboard details.

---

## modules/dashboard/controllers

### DashboardController

`file: src/modules/dashboard/controllers/dashboard.controller.ts:14`

**Route: POST `/rest/dashboards/:id/duplicate` → Promise<DuplicatedDashboardDTO>`**

REST API endpoint for dashboard duplication. Delegates to same service as GraphQL resolver.

---

## modules/dashboard/chart-data/services

### ChartDataQueryService

`file: src/modules/dashboard/chart-data/services/chart-data-query.service.ts:68`

**Method: `executeGroupByQuery(params) → Promise<GroupByRawResult[]>`**

Core query executor for all chart types. Builds group-by and aggregate fields, applies date granularity, handles multi-value field unnesting, runs via common group-by query runner, and transforms results (aggregation format, date formatting). Supports primary and secondary axes with optional ordering.

### BarChartDataService

`file: src/modules/dashboard/chart-data/services/bar-chart-data.service.ts:49`

**Method: `getBarChartData({workspaceId, objectMetadataId, configuration, authContext}) → Promise<BarChartDataDTO>`**

Executes group-by query with bar chart limits and transformations. Handles 1D and 2D (stacked/grouped) modes. Applies gap filling, sorting, cumulative aggregation, and enforces bar/group count limits. Returns formatted data with labels, series, and layout config.

**Private: `transformToOneDimensionalBarChartData(...) → BarChartDataDTO`**

Processes 1D results: filters nulls, applies gap filling, sorts data, applies cumulative if enabled, formats for chart.

**Private: `transformToTwoDimensionalBarChartData(...) → BarChartDataDTO`**

Processes 2D results: organizes by primary/secondary dimension, respects stacking vs grouped mode, applies cumulative, enforces segment limits.

### LineChartDataService

`file: src/modules/dashboard/chart-data/services/line-chart-data.service.ts:48`

**Method: `getLineChartData({workspaceId, objectMetadataId, configuration, authContext}) → Promise<LineChartDataDTO>`**

Executes group-by query for line charts. Supports 1D (single series) and 2D (multi-series, stacked or separate). Applies gap filling and cumulative aggregation per series.

**Private: `transformToOneDimensionalLineChartData(...) → LineChartDataDTO`**

Formats single-series line: transforms to x/y pairs, applies cumulative if enabled.

**Private: `transformToTwoDimensionalLineChartData(...) → LineChartDataDTO`**

Formats multi-series: aggregates by x-value across series, applies cumulative per series, enforces series/data-point limits.

### PieChartDataService

`file: src/modules/dashboard/chart-data/services/pie-chart-data.service.ts:38`

**Method: `getPieChartData({workspaceId, objectMetadataId, configuration, authContext}) → Promise<PieChartDataDTO>`**

Single-dimension group-by query for pie charts. Filters empty categories, enforces slice limit, applies sorting.

**Private: `transformToPieChartData(...) → PieChartDataDTO`**

Formats pie slices: maps aggregated values to id/value pairs with optional hiding of zero-value slices.

---

## modules/dashboard/chart-data/resolvers

### BarChartDataResolver

`file: src/modules/dashboard/chart-data/resolvers/bar-chart-data.resolver.ts:18`

**Query: `barChartData(input: BarChartDataInput) → Promise<BarChartDataDTO>`**

GraphQL query endpoint. Delegates to `BarChartDataService.getBarChartData`.

### LineChartDataResolver

`file: src/modules/dashboard/chart-data/resolvers/line-chart-data.resolver.ts:18`

**Query: `lineChartData(input: LineChartDataInput) → Promise<LineChartDataDTO>`**

GraphQL query endpoint. Delegates to `LineChartDataService.getLineChartData`.

### PieChartDataResolver

`file: src/modules/dashboard/chart-data/resolvers/pie-chart-data.resolver.ts:18`

**Query: `pieChartData(input: PieChartDataInput) → Promise<PieChartDataDTO>`**

GraphQL query endpoint. Delegates to `PieChartDataService.getPieChartData`.

---

## modules/dashboard-sync

### DashboardSyncService

`file: src/modules/dashboard-sync/services/dashboard-sync.service.ts:12`

**Method: `updateLinkedDashboardsUpdatedAtByPageLayoutId({pageLayoutId, workspaceId, updatedAt}) → Promise<void>`**

Updates `updatedAt` of all dashboards linked to a page layout (if layout is type DASHBOARD). Used to cascade updates from layout changes to dashboard entities.

**Method: `updateLinkedDashboardsUpdatedAtByTabId({tabId, workspaceId, updatedAt}) → Promise<void>`**

Finds tab's parent layout and updates all linked dashboards (if layout is DASHBOARD type).

**Method: `updateLinkedDashboardsUpdatedAtByWidgetId({widgetId, workspaceId, updatedAt}) → Promise<void>`**

Traverses widget → tab → layout chain and updates dashboards if layout is DASHBOARD type.

**Private: `isPageLayoutOfTypeDashboard({pageLayoutId, workspaceId}) → Promise<boolean>`**

Checks if a page layout has type `DASHBOARD`.

---

## modules/dashboard/tools

### DashboardToolWorkspaceService

`file: src/modules/dashboard/tools/services/dashboard-tool.workspace-service.ts:23`

**Method: `generateDashboardTools(workspaceId, _rolePermissionConfig) → ToolSet`**

Factory for AI agent tools. Returns ToolSet with: `createCompleteDashboard`, `listDashboards`, `getDashboard`, `addDashboardTab`, `addDashboardWidget`, `updateDashboardWidget`, `deleteDashboardWidget`. Each tool wraps the corresponding dashboard operations.

---

## modules/timeline

### TimelineActivityService

`file: src/modules/timeline/services/timeline-activity.service.ts:26`

**Method: `upsertEvents({events, name, objectMetadata, workspaceId}) → Promise<void>`**

Entry point for workspace event processing. Parses event name, transforms events to timeline activity payloads (handles notes, tasks, and targets linking), and delegates to repository for upsertion.

**Private: `transformEventsToTimelineActivityPayloads(...) → Promise<TimelineActivityPayload[] | undefined>`**

Routes transformation based on object type: notes/tasks create linked-activity payloads for targets plus direct payloads; targets create linked-activity payloads to target records.

**Private: `computeTimelineActivityPayloadsForActivities({events, activityType, ...}) → Promise<TimelineActivityPayload[]>`**

Finds activity targets (noteTarget/taskTarget records), maps to target object singular names, and creates linked-activity payloads.

**Private: `computeTimelineActivityPayloadsForActivityTargets({events, activityType, ...}) → Promise<TimelineActivityPayload[]>`**

Reverses direction: finds activities by IDs from target events, extracts target column, and creates linked-activity payloads.

### TimelineActivityRepository

`file: src/modules/timeline/repositories/timeline-activity.repository.ts:22`

**Method: `upsertTimelineActivities({objectSingularName, workspaceId, payloads}) → Promise<void>`**

Upserts timeline activities. Finds recent (10-minute window) matching activities by record ID, workspace member, and name; merges diffs if found, otherwise inserts new. Filters out empty diffs before processing.

**Private: `findRecentTimelineActivities(...) → Promise<TimelineActivity[]>`**

Queries activities from last 10 minutes matching workspace member, record ID, and name criteria.

**Private: `insertTimelineActivities({objectSingularName, workspaceId, payloads}) → Promise<void>`**

Batch inserts timeline activity records with diff properties.

**Private: `updateTimelineActivity({id, properties, workspaceMemberId, workspaceId}) → Promise<void>`**

Updates existing activity with merged properties and workspace member.

**Private: `getTimelineActivityPropertyName(objectSingularName) → Promise<string>`**

Returns the morph relation field name for the object (e.g., `companyId` for company).

---

## modules/timeline/jobs

### UpsertTimelineActivityFromInternalEvent

`file: src/modules/timeline/jobs/upsert-timeline-activity-from-internal-event.job.ts:16`

**Process: `handle(workspaceEventBatch) → Promise<void>`**

Message queue processor for internal events. Filters system objects to only those in `SYSTEM_OBJECTS_WITH_TIMELINE_ACTIVITIES`, maps user IDs to workspace member IDs, and delegates to timeline activity service.

---

## Key Patterns & Utilities

### Auth Context
Most services use `buildSystemAuthContext(workspaceId)` to execute operations with full permissions (no permission checks), ensuring background jobs and cron tasks can complete.

### Workspace Context Execution
`globalWorkspaceOrmManager.executeInWorkspaceContext(asyncFn, authContext, {lite?: true})` wraps operations in workspace-scoped database context. `lite: true` disables some caching for performance.

### Pagination & Bulk Operations
Large deletions and updates use pagination (500-1000 items per batch) via utilities like `deleteUsingPagination` to prevent memory/lock issues.

### Transactional Saving
Calendar event saves use `workspaceDataSource.transaction(async (manager) => {...})` to ensure atomicity of event, association, and participant inserts/updates.

### Cache Storage
Calendar channels use Redis (via `CacheStorageService`) to queue event IDs for batch processing, with keys like `calendar-events-to-import:${workspaceId}:${calendarChannelId}`.

### Message Queue
Import jobs are enqueued via `MessageQueueService` to the `calendarQueue` for async processing. Contact creation also uses message queue for batching.

### Error Handling & Metrics
`CalendarEventImportErrorHandlerService` classifies errors and calls specific handlers. `MetricsService` tracks sync job outcomes (active, failed_unknown, failed_insufficient_permissions).

### Event Filtering
Calendar events are filtered by blocklist (contact emails on user's blocklist) and calendar handles (to avoid duplicates when user has multiple calendar aliases).

---

## NOT YET COVERED

The following files in the assigned area were not fully documented due to scope (mostly constants, DTOs, types, listeners, and utility helper functions):

### Calendar Module (partial coverage):
- `/modules/calendar/common/query-hooks/*` (post-query hooks for visibility restrictions)
- `/modules/calendar/calendar-event-participant-manager/listeners/*` (event listeners for person/workspace member updates)
- `/modules/calendar/blocklist-manager/*` (blocklist-based event filtering jobs/listeners)
- `/modules/calendar/calendar-event-import-manager/drivers/caldav/utils/*` (iCal parsing, validation, attribute extraction)
- `/modules/calendar/calendar-event-import-manager/drivers/{google,microsoft}/utils/*` (event formatting, error parsing)
- `/modules/calendar/calendar-event-import-manager/utils/{calendar-event-mapper,filter-out-blocklisted-events,is-sync-stale,get-flattened-values-and-values-string-for-batch-raw-query}` (data transformation utilities)
- All `*.constants.ts`, `*.type.ts`, `*.entity.ts` files (declarations only)

### Dashboard Module (partial coverage):
- `/modules/dashboard/chart-data/utils/*` (50+ utility functions: gap filling, sorting, formatting, aggregation transformation, field lookups)
- `/modules/dashboard/chart-data/filters/*` (GraphQL exception filters)
- `/modules/dashboard/query-hooks/*` (pre/post-query hooks for dashboard CRUD)
- `/modules/dashboard/tools/{create-complete-dashboard,add-dashboard-tab,add-dashboard-widget,update-dashboard-widget,delete-dashboard-widget}.tool.ts` (AI agent tool definitions)
- All `*.constants.ts`, `*.dto.ts`, `*.entity.ts` files (declarations only)

### Dashboard-Sync Module:
- Module file only (2 methods documented)

### Timeline Module (partial coverage):
- `/modules/timeline/utils/{extract-object-singular-name-from-target-column-name,timeline-activity-related-morph-field-metadata-name-builder}` (helper functions)
- `/modules/timeline/standard-objects/*`, `*.type.ts`, `*.constant.ts` (type/entity definitions)

**Total Functions Documented: ~75 service methods, query resolvers, job handlers, CLI commands, and critical utility functions**

