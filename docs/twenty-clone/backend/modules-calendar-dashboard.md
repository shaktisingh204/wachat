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

## modules/calendar/common/query-hooks (visibility restrictions — full coverage)

### CalendarEventFindManyPostQueryHook
`file: src/modules/calendar/common/query-hooks/calendar-event/calendar-event-find-many.post-query.hook.ts:17`

**Method: `execute(authContext, _objectName, payload: CalendarEventWorkspaceEntity[]) → Promise<void>`**

POST_HOOK on `calendarEvent.findMany`. Rejects non-user/apiKey/application auth contexts and missing workspace, then delegates to `ApplyCalendarEventsVisibilityRestrictionsService` with the user id (when user context).

### CalendarEventFindOnePostQueryHook
`file: src/modules/calendar/common/query-hooks/calendar-event/calendar-event-find-one.post-query.hook.ts:17`

**Method: `execute(authContext, _objectName, payload) → Promise<void>`**

Identical to the find-many hook but registered on `calendarEvent.findOne`.

### ApplyCalendarEventsVisibilityRestrictionsService
`file: src/modules/calendar/common/query-hooks/calendar-event/services/apply-calendar-events-visibility-restrictions.service.ts:19`

**Method: `applyCalendarEventsVisibilityRestrictions(calendarEvents, workspaceId, userId?) → Promise<CalendarEventWorkspaceEntity[]>`**

Mutates the result list in place (iterates backwards so splices are safe). Loads the channel-event associations and core CalendarChannel rows, groups channels by visibility. SHARE_EVERYTHING events pass through; events on a channel owned by the requesting user (matched via userWorkspace → connectedAccount) pass through; METADATA-only events have title/description replaced with the restricted-permissions placeholder; everything else is removed from the payload. Runs in lite system workspace context.

---

## modules/calendar/calendar-event-participant-manager (jobs & listeners — full coverage)

### CalendarEventParticipantMatchParticipantJob
`file: src/modules/calendar/calendar-event-participant-manager/jobs/calendar-event-participant-match-participant.job.ts:26`

**Process: `handle(data: CalendarEventParticipantMatchParticipantJobData) → Promise<void>`**

Skips inactive workspaces. If the matching payload has personIds/personEmails, calls `matchParticipantsForPeople`; if it has workspaceMemberIds, calls `matchParticipantsForWorkspaceMembers` — both on object `calendarEventParticipant`.

### CalendarEventParticipantListener
`file: src/modules/calendar/calendar-event-participant-manager/listeners/calendar-event-participant.listener.ts:17`

**Method: `handleCalendarEventParticipantMatchedEvent(batchEvent)` (@OnCustomBatchEvent `calendarEventParticipant_matched`)**

When participants are matched to persons, builds `message.linked` timeline-activity payloads linking each person record to its calendarEvent and upserts them via the timeline activity repository.

### CalendarEventParticipantPersonListener
`file: src/modules/calendar/calendar-event-participant-manager/listeners/calendar-event-participant-person.listener.ts`

Listens on person CREATED/UPDATED/DELETED batch events; when a person's emails change (or is created/deleted) enqueues a match-participant job so calendar event participants are (re)linked by email.

### CalendarEventParticipantWorkspaceMemberListener
`file: src/modules/calendar/calendar-event-participant-manager/listeners/calendar-event-participant-workspace-member.listener.ts`

Same pattern for workspaceMember events: enqueues a match-participant job keyed on workspaceMemberIds so participants get linked to members.

---

## modules/calendar/blocklist-manager (full coverage)

### CalendarBlocklistListener
`file: src/modules/calendar/blocklist-manager/listeners/calendar-blocklist.listener.ts:26`

Database-event listener on `blocklist`. CREATED → enqueues `BlocklistItemDeleteCalendarEventsJob`; DELETED → enqueues `BlocklistReimportCalendarEventsJob`; UPDATED → enqueues both (delete newly-blocked events, re-import unblocked ones).

### BlocklistItemDeleteCalendarEventsJob
`file: src/modules/calendar/blocklist-manager/jobs/blocklist-item-delete-calendar-events.job.ts:28`

**Process: `handle(data) → Promise<void>`**

Loads the created/updated blocklist items, groups handles by workspaceMember, and for each member's calendar channels computes handle match conditions (exact handle, or domain match `%@domain` excluding the user's own handles/aliases when the blocklist entry is a domain like `@acme.com`). Deletes the matching channel-event associations, then runs `cleanWorkspaceCalendarEvents` to remove now-orphaned events.

### BlocklistReimportCalendarEventsJob
`file: src/modules/calendar/blocklist-manager/jobs/blocklist-reimport-calendar-events.job.ts:28`

**Process: `handle(data) → Promise<void>`**

For each deleted blocklist item, resolves the owning workspace member → userWorkspace → its calendar channels (excluding those already pending a list-fetch), and calls `resetAndMarkAsCalendarEventListFetchPending` to force a full re-import that may re-add previously blocked events.

---

## modules/calendar/calendar-event-import-manager/utils (full coverage)

### filterOutBlocklistedEvents
`file: src/modules/calendar/calendar-event-import-manager/utils/filter-out-blocklisted-events.util.ts:4`

**Function: `(calendarChannelHandles, events, blocklist) → FetchedCalendarEvent[]`**

Keeps an event only if none of its participants' handles are blocklisted (via `isEmailBlocklisted`, which respects the user's own handles/aliases). Events with no participants pass through.

### isSyncStale
`file: src/modules/calendar/calendar-event-import-manager/utils/is-sync-stale.util.ts:5`

**Function: `(syncStageStartedAt?: string | null) → boolean`**

True when no start timestamp exists, or when the elapsed time since the start exceeds `CALENDAR_IMPORT_ONGOING_SYNC_TIMEOUT`. Throws on an unparseable date. Used to detect stuck ONGOING syncs.

### mapCalendarEventsByICalUID
`file: src/modules/calendar/calendar-event-import-manager/utils/calendar-event-mapper.util.ts:3`

**Function: `(existingCalendarEvents) → Map<string, string>`**

Builds an iCalUID → calendarEventId lookup so importers can dedupe events that share the same iCal UID across calendars.

### valuesStringForBatchRawQuery
`file: src/modules/calendar/calendar-event-import-manager/utils/get-flattened-values-and-values-string-for-batch-raw-query.util.ts:1`

**Function: `(values: object[], typesArray: string[] = []) → string`**

Generates a parameterized multi-row VALUES clause (e.g. `($1::uuid, $2::text), ($3::uuid, $4::text)`) with per-column type casts, for batched raw-SQL inserts of calendar events.

---

## modules/calendar/calendar-event-import-manager/drivers/caldav/utils (full coverage — iCal helpers)

These pure helpers back the CalDAV driver:

### parseICalEvent
`file: .../drivers/caldav/utils/parse-ical-event.util.ts`
Parses a raw iCal VEVENT into a `FetchedCalendarEvent` (title, times, attendees, organizer, recurrence, status).

### extractICalData
`file: .../drivers/caldav/utils/extract-ical-data.util.ts`
Extracts the VEVENT block / component data from a CalDAV calendar-data payload.

### extractAttendeesFromEvent / extractOrganizerFromEvent
`file: .../drivers/caldav/utils/extract-attendees-from-event.util.ts`, `extract-organizer-from-event.util.ts`
Map iCal ATTENDEE/ORGANIZER properties to participant objects (handle, display name, response status).

### mapPartstatToResponseStatus
`file: .../drivers/caldav/utils/map-partstat-to-response-status.util.ts`
Maps iCal PARTSTAT (ACCEPTED/DECLINED/TENTATIVE/NEEDS-ACTION) to the internal response-status enum.

### buildCancelledEvent
`file: .../drivers/caldav/utils/build-cancelled-event.util.ts`
Produces a minimal cancelled-event shape (id + isCanceled) for events removed since the last sync.

### isValidCalDavHref
`file: .../drivers/caldav/utils/is-valid-caldav-href.util.ts`
Validates a CalDAV resource href before fetching.

### isEventInTimeRange
`file: .../drivers/caldav/utils/is-event-in-time-range.util.ts`
True when an event's start/end overlaps the configured import window (5 years past, 1 year future).

### parseCalDavError / isInvalidSyncTokenResponse
`file: .../drivers/caldav/utils/parse-caldav-error.util.ts`, `is-invalid-sync-token-response.util.ts`
Classify CalDAV server errors and detect invalid/expired sync-token responses so the importer can reset its cursor.

---

## modules/dashboard/chart-data/utils (full coverage — query building, processing, formatting, sorting, gap filling)

### Query building

#### buildGroupByFieldObject
`file: src/modules/dashboard/chart-data/utils/build-group-by-field-object.util.ts:84`
Builds the nested `groupBy` object passed to the group-by query runner. For date-kind fields it injects granularity + timezone + first-day-of-week; for composite/relation fields it nests the subfield; otherwise emits `{ fieldName: true }`.

#### buildAggregateFieldKey
`file: src/modules/dashboard/chart-data/utils/build-aggregate-field-key.util.ts:11`
Computes the result-key string for an aggregate (e.g. `amountSum`) combining field name and operation.

#### convertChartFilterToGqlOperationFilter
`file: src/modules/dashboard/chart-data/utils/convert-chart-filter-to-gql-operation-filter.util.ts:28`
Converts a dashboard `ChartFilter` (filters + groups + logical operators) into a GraphQL `ObjectRecordFilter` via `computeRecordGqlOperationFilter`, resolving field ids against flat field maps and applying the user timezone / current member.

#### getGroupByOrderBy / getFieldOrderBy / getRelationFieldOrderBy / mapOrderByToDirection
`file: .../get-group-by-order-by.util.ts:18`, `get-field-order-by.util.ts:17`, `get-relation-field-order-by.util.ts:12`, `map-order-by-to-direction.util.ts:6`
Build the ORDER BY clause for group-by queries — choosing field vs aggregate ordering, composite/relation/date variants, and mapping the GraphOrderBy enum to ASC/DESC.

#### getFieldMetadata / getSelectOptions / isRelationNestedFieldDateKind / isCyclicalDateGranularity
`file: .../get-field-metadata.util.ts:12`, `get-select-options.util.ts:6`, `is-relation-nested-field-date-kind.util.ts:9`, `is-cyclical-date-granularity.util.ts:4`
Lookups/predicates: resolve a field's metadata, get a SELECT field's option list, detect a date-kind nested relation field, and detect cyclical granularities (e.g. day-of-week, month-of-year) that wrap.

### Result processing

#### processOneDimensionalResults
`file: src/modules/dashboard/chart-data/utils/process-one-dimensional-results.util.ts:32`
Maps raw group-by rows to `{ formattedValue, rawValue, aggregateValue }` points and a formatted→raw lookup, applying dimension formatting (date granularity, timezone, first-day-of-week).

#### processTwoDimensionalResults
`file: src/modules/dashboard/chart-data/utils/process-two-dimensional-results.util.ts:38`
Same for 2D: produces points with x/y formatted+raw values plus primary and secondary formatted→raw lookups.

#### formatDimensionValue / formatDateByGranularity / compareDimensionValues
`file: .../format-dimension-value.util.ts:49`, `format-date-by-granularity.ts:8`, `compare-dimension-values.util.ts:38`
Format a dimension value for display (dates by granularity, selects by label, relations by subfield) and compare two dimension values for sorting/gap detection.

#### transformAggregateValue
`file: src/modules/dashboard/chart-data/utils/transform-aggregate-value.util.ts:24`
Coerces a raw aggregate to a number: null → 0, percentage operations scaled appropriately, count operations as integers, otherwise numeric parse.

#### getAggregateOperationLabel
`file: .../get-aggregate-operation-label.util.ts:3`
Human-readable label for an aggregate operation (Sum, Count, etc.).

### Gap filling & date ranges

#### generateDateGroupsInRange
`file: src/modules/dashboard/chart-data/utils/generate-date-groups-in-range.util.ts:22`
Enumerates the expected date buckets across the data's min/max range at a given granularity (so missing buckets can be filled).

#### fillDateGaps / fillDateGapsTwoDimensional
`file: src/modules/dashboard/chart-data/utils/fill-date-gaps.util.ts:21,97`
Insert zero-value points for missing date buckets in 1D and 2D series.

#### fillSelectGaps / fillSelectGapsTwoDimensional
`file: src/modules/dashboard/chart-data/utils/fill-select-gaps.util.ts:11,54`
Insert zero-value points for SELECT options that have no data.

#### applyGapFilling
`file: src/modules/dashboard/chart-data/utils/apply-gap-filling.util.ts:35`
Dispatcher that picks date vs select gap-filling (1D/2D) based on the primary axis field kind.

### Sorting & misc

#### sortChartDataIfNeeded
`file: src/modules/dashboard/chart-data/utils/sort-chart-data-if-needed.util.ts:31`
Generic sorter that respects the configured order (manual order, select-option position, or value/label) when ordering is required.

#### sortByManualOrder / sortBySelectOptionPosition / sortSecondaryAxisData
`file: .../sort-by-manual-order.util.ts:9`, `sort-by-select-option-position.util.ts:18`, `sort-secondary-axis-data.util.ts:27`
Specific generic sorters used by `sortChartDataIfNeeded` and 2D processing.

#### buildLineChartSeriesIdPrefix
`file: src/modules/dashboard/chart-data/utils/build-line-chart-series-id-prefix.util.ts:5`
Builds a stable series-id prefix for multi-series line charts.

#### chartDataGraphqlApiExceptionHandler
`file: src/modules/dashboard/chart-data/utils/chart-data-graphql-api-exception-handler.util.ts:13`
Maps chart-data service errors to GraphQL API exceptions for the chart resolvers.

---

## modules/dashboard/query-hooks (full coverage)

### DashboardCreateOnePreQueryHook
`file: src/modules/dashboard/query-hooks/dashboard-create-one.pre-query.hook.ts:16`
PRE_HOOK on dashboard create-one: if no `pageLayoutId` supplied, creates a new dashboard page layout (+ default tab) via `DashboardToPageLayoutSyncService` and injects its id into the payload.

### DashboardCreateManyPreQueryHook
`file: src/modules/dashboard/query-hooks/dashboard-create-many.pre-query.hook.ts:16`
Same logic applied per item for create-many.

### DashboardDestroyOnePreQueryHook
`file: src/modules/dashboard/query-hooks/dashboard-destroy-one.pre-query.hook.ts:15`
PRE_HOOK on destroy-one: destroys the page layouts linked to the dashboard being destroyed.

### DashboardDestroyManyPreQueryHook
`file: src/modules/dashboard/query-hooks/dashboard-destroy-many.pre-query.hook.ts:15`
Same for destroy-many across all targeted dashboard ids.

---

## modules/dashboard/tools (AI agent tool factories — full coverage)

Each factory takes `(deps: DashboardToolDependencies, context: DashboardToolContext)` and returns a tool definition `{ name, description, parameters, execute }` used by `DashboardToolWorkspaceService.generateDashboardTools`.

### createCreateCompleteDashboardTool
`file: src/modules/dashboard/tools/create-complete-dashboard.tool.ts:47`
`create_complete_dashboard` — creates a dashboard with layout, a tab, and widgets in one call. Its description encodes the full widget contract (12-col grid; GRAPH AGGREGATE_CHART/BAR/LINE/PIE with required configuration fields and relation/composite subfield rules; IFRAME; STANDALONE_RICH_TEXT; RECORD_TABLE requiring a dedicated view).

### createAddDashboardTabTool
`file: src/modules/dashboard/tools/add-dashboard-tab.tool.ts:26`
`add_dashboard_tab` — adds a new tab to an existing dashboard's page layout.

### createAddDashboardWidgetTool
`file: src/modules/dashboard/tools/add-dashboard-widget.tool.ts:31`
`add_dashboard_widget` — adds a single widget (with grid position + configuration) to a tab.

### createUpdateDashboardWidgetTool
`file: src/modules/dashboard/tools/update-dashboard-widget.tool.ts:31`
`update_dashboard_widget` — updates an existing widget's configuration/position.

### createDeleteDashboardWidgetTool
`file: src/modules/dashboard/tools/delete-dashboard-widget.tool.ts:12`
`delete_dashboard_widget` — removes a widget by id.

### createListDashboardsTool / createGetDashboardTool
`file: src/modules/dashboard/tools/list-dashboards.tool.ts:19`, `get-dashboard.tool.ts:20`
`list_dashboards` returns the workspace's dashboards; `get_dashboard` returns a single dashboard with its layout/tabs/widgets.

---

## modules/timeline/utils (full coverage)

### extractObjectSingularNameFromTargetColumnName
`file: src/modules/timeline/utils/extract-object-singular-name-from-target-column-name.util.ts:4`
**Function: `(targetColumnName: string) → string`**
Strips a trailing `Id` and a leading `target` prefix (lower-casing the next char) to turn e.g. `targetCompanyId` → `company`. Inverse of the morph-field name builder below.

### buildTimelineActivityRelatedMorphFieldMetadataName
`file: src/modules/timeline/utils/timeline-activity-related-morph-field-metadata-name-builder.util.ts:3`
**Function: `(name: string) → string`**
Returns `target${Capitalize(name)}` (e.g. `company` → `targetCompany`) — the morph relation field name on the timelineActivity object.

---

## NOT YET COVERED

Only trivial leftovers remain:
- `*.constants.ts`, `*.type.ts`, `*.dto.ts`, `*.entity.ts` and module wiring files (`*.module.ts`) — declarations/config only.
- Microsoft/Google driver `utils/*` formatting helpers (small per-provider event/error mappers analogous to the documented CalDAV helpers).
- `*.spec.ts` test files and test fixtures.

