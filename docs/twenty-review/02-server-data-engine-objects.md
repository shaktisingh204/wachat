# Twenty Server — Record Data Engine & Standard CRM Objects

Original structured catalog of the record data engine (`engine/core-modules/{record-crud,record-position,record-transformer,search,graphql,open-api,sdk-client}`) and the standard CRM workspace objects (`src/modules/*`). Descriptions are paraphrased from the source; field tables reflect entity shapes.

> Architectural note: the data engine is **schema-driven**. There are no hand-written entity tables per object. Each workspace gets its own dynamically-generated Postgres schema, and "objects" are described by metadata (`FlatObjectMetadata` + `FlatFieldMetadata`) loaded from a per-workspace cache. The runner layer (`engine/api/common/common-query-runners/*`) turns metadata + filters into TypeORM queries against a `WorkspaceRepository`. The modules below sit *on top of* that runner layer.

---

## record-crud (core-modules/record-crud)

The high-level, metadata-aware CRUD facade. It does **not** talk to TypeORM directly; every service builds an execution context then delegates to a `Common*QueryRunnerService`. Primary consumers are workflow automation and AI tools (each service returns a `ToolOutput` envelope, not a raw record).

| Service | Verb | Delegates to | Notes |
|---|---|---|---|
| `CreateRecordService` | create one | `CommonCreateOneQueryRunnerService` | Injects `createdBy` actor (defaults to `{source: WORKFLOW, name: 'Workflow'}`); strips `undefined` from composite inputs; blocks objects where `canObjectBeManagedByAutomation` is false. |
| `CreateManyRecordsService` | create N | `CommonCreateManyQueryRunnerService` | Batch create. |
| `UpdateRecordService` | update one | common update-one runner | Same actor/undefined cleaning. |
| `UpdateManyRecordsService` | update N | common update-many runner | Filter-targeted bulk update. |
| `UpsertRecordService` | upsert | create/update runners | Insert-or-update by conflict key. |
| `DeleteRecordService` | soft delete | common delete runner | Soft delete (`deletedAt`). |
| `FindRecordsService` | read N | `CommonFindManyQueryRunnerService` | Appends `{id: AscNullsFirst}` to orderBy for stable cursor pagination; clamps `first` to `QUERY_MAX_RECORDS`; returns `{records, count}` + `recordReferences` (id + display name). |
| `GroupByRecordsService` | aggregate | `CommonGroupByQueryRunnerService` | Group + aggregate (default `COUNT`); validates the requested aggregation against available ops per field. |

Shared plumbing:
- `CommonApiContextBuilderService.build({authContext, objectName})` → resolves `queryRunnerContext`, `selectedFields`, `flatObjectMetadata`, `flatFieldMetadataMaps`, `objectsPermissions`. This is the single entry that loads metadata + permission config for an object.
- Display/identity utils: `getRecordDisplayName`, `get-record-image-identifier`, `resolve-aggregate-field-key`, `remove-undefined-from-record`.
- Zod schemas + `generate-*-input-schema` utils produce **per-object tool schemas** (find / find-one / create / create-many / update / update-many / delete / bulk-delete / group-by) so an LLM can call CRUD with validated args. `record-filter`, `field-filters`, `order-by` zod schemas mirror the GraphQL filter grammar.
- All errors wrapped as `RecordCrudException` with codes (`INVALID_REQUEST`, etc.).

## record-position (core-modules/record-position)

Manages the numeric `position` column that drives **Kanban / manual ordering**. Positions are plain floating-point numbers; new records slot before/after neighbours by computing min/max.

`RecordPositionService`:
- `buildRecordPosition({value, objectMetadata, workspaceId, index})` — `value` is `number | 'first' | 'last'`. `'first'` → `min - index - 1`; `'last'` → `max + index + 1`; empty table → `1`.
- `overridePositionOnRecords(...)` — bulk variant for create/update batches; buckets inputs into needs-first / needs-last / explicit-number / leave-alone, optionally backfilling `undefined` to first. No-ops if the object has no `position` field.
- `findByPosition`, `updatePosition`, private `findMinPosition`/`findMaxPosition` (use repo `.minimum()`/`.maximum()`).
- Runs under `GlobalWorkspaceOrmManager.executeInWorkspaceContext` with a **system auth context** and `shouldBypassPermissionChecks: true`.

> No fractional-indexing / rebalancing library — gaps are just `±1` integer-ish offsets that can collide if many inserts land at the same edge.

## record-transformer (core-modules/record-transformer)

Normalizes raw user/API input into the canonical composite-field shape **before** persistence.

`RecordInputTransformerService.process({recordInput, flatObjectMetadata, flatFieldMetadataMaps})` iterates each input key, looks up its `FieldMetadataType`, then for composite types serializes sub-fields, runs a type-specific transform, and re-parses. Pass-through for unknown keys.

| Util | Field type | Behavior |
|---|---|---|
| `transformEmailsValue` | EMAILS | Normalizes `primaryEmail` + `additionalEmails`. |
| `transformPhonesValue` | PHONES | Normalizes calling code / number / country. |
| `transformLinksValue` | LINKS | Normalizes `primaryLinkUrl/Label` + `secondaryLinks`. |
| `remove-empty-links` | LINKS | Drops empty link entries. |
| `transformRichTextValue` | RICH_TEXT_V2 | Normalizes blocknote/markdown payload. |
| `record-transformer-graphql-api-exception-handler` | — | Maps transform errors to GraphQL errors. |

## search (core-modules/search)

Global cross-object full-text search backed by a Postgres `tsvector` column (`searchVector` / `SEARCH_VECTOR_FIELD`) with a GIN index.

`SearchService` flow:
1. `filterObjectMetadataItems` — keeps `isActive && isSearchable` objects (or an explicit include list), drops channel-visibility-constrained objects.
2. For each object (chunked, 5 at a time) build a query with `GraphqlQueryParser` (applies caller filters + soft-delete) and run **`ts_rank_cd` / `ts_rank`** ranking against `to_tsquery('simple', unaccent_immutable(...))`. AND-terms and OR-terms are both matched (`formatSearchTerms('and'|'or')`).
3. **ILIKE fallback**: if tsvector returns 0 rows on the first page for an object (tokenization failures, e.g. CJK), re-query with `ILIKE` on `searchVector::text` inside a transaction with a `statement_timeout` (`SEARCH_ILIKE_FALLBACK_TIMEOUT_MS`); fallback rows get rank 0.
4. Selects `id`, label-identifier column(s) (FULL_NAME expands to `*FirstName`/`*LastName`), and an image-identifier column (special-cased: company→`domainNamePrimaryLinkUrl`/logo, person→`avatarFile`, workspaceMember→`avatarUrl`).
5. `computeSearchObjectResults` builds `SearchRecordDTO`s (label, signed image URL via `FileUrlService`, ranks), sorts by `tsRankCD → tsRank → STANDARD_OBJECTS_BY_PRIORITY_RANK`, slices to `limit`.

**Cursor pagination** (`computeCursorWhereCondition` / `computeEdges`): keyset cursor encodes `{lastRanks:{tsRankCD,tsRank}, lastRecordIdsPerObject}`; the WHERE replays the `(tsRankCD, tsRank, id)` tuple comparison so paging is stable across objects. Exposed via `SearchResolver.search` (GraphQL `@Query` → `SearchResultConnectionDTO` with edges/pageInfo).

## graphql (core-modules/graphql)

Cross-cutting GraphQL runtime hardening for the dynamically generated workspace schema (the schema itself is built elsewhere in `engine/api/graphql`).

- `use-validate-graphql-query-complexity.hook` — rejects over-complex queries (depth/cost guard).
- `use-disable-introspection-and-suggestions-for-unauthenticated-users.hook` + `remove-suggestion-in-errors.rule` — hides introspection/"did you mean" leakage for anon users.
- `use-graphql-error-handler.hook`, `generate-graphql-error-from-error.util`, `graphql-errors.util` — normalize thrown errors into GraphQL error shapes.
- `resolver-validation.pipe`, `prevent-nest-to-auto-log-graphql-errors.filter` — validation + log-noise suppression.

## open-api (core-modules/open-api)

Generates an **OpenAPI 3.1 document at runtime** from workspace metadata, exposing two endpoints (`OpenApiController`): `open-api/core` (data objects) and `open-api/metadata` (metadata objects). Powers the auto-generated REST API + Swagger UI.

`OpenApiService` reads the workspace from the request (token), pulls `FlatObjectMetadata` via the flat-entity cache, and composes the doc from util builders:
- Paths per object: `computeSingleResultPath`, `computeManyResultPath`, `computeBatchPath`, `computeDuplicatesResultPath`, `computeGroupByResultPath`, `computeMergeManyResultPath`, `computeRestore{One,Many}ResultPath`.
- `computeSchemaComponents` / `computeMetadataSchemaComponents` / `computeParameterComponents` — component schemas from field metadata; `computeSchemaTags` groups by object.
- `getRequestBody` / `getUpdateRequestBody`, `responses.utils` (201/200 create/find/update/delete), `get400/401ErrorResponses`, `computeWebhooks`, `generate-random-field-value` (examples).

> The REST surface is derived 1:1 from the same metadata that drives GraphQL — they are two facades over one runner layer.

## sdk-client (core-modules/sdk-client)

Generates and packages a **typed TypeScript client SDK** per workspace.

- `SdkClientGenerationService` — prints the workspace GraphQL schema (`WorkspaceSchemaFactory` + `printSchema`), runs `twenty-client-sdk/generate` `replaceCoreClient`, writes into a temp dir, zips it (`createZipFile` → `twenty-client-sdk.zip`), and stores it via `FileStorageService`. Retries up to 3×.
- `SdkClientArchiveService` — retrieval/serving of the archive. `SdkClientController` exposes download.
- Runs as a queued job (`GENERATE_SDK_CLIENT_JOB_NAME` on the workspace queue) gated by `ALLOWED_SDK_MODULES`.

---

# Standard CRM Objects (src/modules)

All entities extend a `BaseWorkspaceEntity` providing implicit `id`, `createdAt`, `updatedAt`, `deletedAt`. Composite types: `LinksMetadata`, `CurrencyMetadata`, `AddressMetadata`, `FullNameMetadata`, `EmailsMetadata`, `PhonesMetadata`, `ActorMetadata`, `FileOutput[]`. `searchVector` is the indexed tsvector. `*Id` scalar columns are the FK companions of relations.

## company

Label identifier: `name`. Image identifier: `domainName` primary link / logo.

| Field | Type |
|---|---|
| name | TEXT |
| domainName | LINKS (composite) |
| employees | NUMBER |
| linkedinLink | LINKS |
| xLink | LINKS |
| annualRecurringRevenue | CURRENCY (composite) |
| address | ADDRESS (composite) |
| idealCustomerProfile | BOOLEAN |
| position | POSITION (number) |
| createdBy / updatedBy | ACTOR (composite) |
| addressOld | TEXT (legacy) |
| searchVector | TS_VECTOR |

Relations: `people` (1-N Person), `accountOwner` (N-1 WorkspaceMember), `opportunities` (1-N), `taskTargets`, `noteTargets`, `attachments`, `timelineActivities`.

## person

Label identifier: `name` (FULL_NAME). Image identifier: `avatarFile`.

| Field | Type |
|---|---|
| name | FULL_NAME (composite first/last) |
| emails | EMAILS (composite) |
| linkedinLink / xLink | LINKS |
| jobTitle | TEXT |
| phone | TEXT (legacy) |
| phones | PHONES (composite) |
| city | TEXT |
| avatarUrl | TEXT |
| avatarFile | FILE (FileOutput[]) |
| position | POSITION |
| createdBy / updatedBy | ACTOR |
| searchVector | TS_VECTOR |

Relations: `company` (N-1), `pointOfContactForOpportunities` (1-N Opportunity), `taskTargets`, `noteTargets`, `attachments`, `messageParticipants`, `calendarEventParticipants`, `timelineActivities`.

## opportunity

Label identifier: `name`.

| Field | Type |
|---|---|
| name | TEXT |
| amount | CURRENCY (composite) |
| closeDate | DATE_TIME |
| stage | SELECT (pipeline stages: NEW…WON/LOST) |
| probability | SELECT/TEXT |
| position | POSITION |
| createdBy / updatedBy | ACTOR |
| searchVector | TS_VECTOR |

Relations: `pointOfContact` (N-1 Person), `company` (N-1), `owner` (N-1 WorkspaceMember), `taskTargets`, `noteTargets`, `attachments`, `timelineActivities`. `stage` + `position` are what the Kanban board sorts on.

## task

Label identifier: `title`.

| Field | Type |
|---|---|
| title | TEXT |
| bodyV2 | RICH_TEXT_V2 (composite) |
| dueAt | DATE_TIME |
| status | SELECT (TODO/IN_PROGRESS/DONE) |
| position | POSITION |
| createdBy / updatedBy | ACTOR |
| searchVector | TS_VECTOR |

Relations: `taskTargets` (1-N, the polymorphic link), `attachments`, `assignee` (N-1 WorkspaceMember), `timelineActivities`.

**task-target** (junction): polymorphic link from a task to one target. Columns: `task`/`taskId`, `targetPerson`/`Id`, `targetCompany`/`Id`, `targetOpportunity`/`Id`, plus `custom` (catch-all for custom objects). Exactly one target set per row.

Object-specific behavior — `TaskPostQueryHookService` (post-query hooks `task.deleteOne/deleteMany/restoreOne/restoreMany`): when a task is soft-deleted, **cascades soft-delete to its `taskTarget` rows**; restore re-activates them. Keeps junction rows in sync with parent lifecycle.

## note

Label identifier: `title`.

| Field | Type |
|---|---|
| title | TEXT |
| bodyV2 | RICH_TEXT_V2 (composite) |
| position | POSITION |
| createdBy / updatedBy | ACTOR |
| searchVector | TS_VECTOR |

Relations: `noteTargets` (1-N), `attachments`, `timelineActivities`.

**note-target** (junction): mirror of task-target — `note`/`noteId`, `targetPerson/Company/Opportunity` (+Ids), `custom`. `NotePostQueryHookService` cascades soft-delete/restore from note → `noteTarget`, identical pattern to task.

## attachment

Label identifier: `name`. The most-polymorphic standard object — attachable to almost any record.

| Field | Type |
|---|---|
| name | TEXT |
| file | FILE (FileOutput[]) |
| fullPath | TEXT |
| type | TEXT (mime) |
| fileCategory | SELECT |
| createdBy / updatedBy | ACTOR |

Relations: `author` (N-1 WorkspaceMember) + direct target FKs: `targetTask`, `targetNote`, `targetPerson`, `targetCompany`, `targetOpportunity`, `targetDashboard`, `targetWorkflow` (each with `*Id`), plus `custom`. Unlike task/note targets there is **no junction table** — the FK columns live on the attachment row itself.

## timeline-activity

System object; the per-record activity/audit feed. Label identifier: `name`.

| Field | Type |
|---|---|
| happensAt | DATE_TIME |
| name | TEXT (event name, e.g. `note.created`) |
| properties | RAW_JSON (event diff/payload) |
| linkedRecordCachedName | TEXT |
| linkedRecordId | UUID |
| linkedObjectMetadataId | UUID |

Relations: `workspaceMember` (actor) + a wide set of polymorphic targets (`targetPerson/Company/Opportunity/Note/Task/Workflow/WorkflowVersion/WorkflowRun/Dashboard`, each `+Id`) plus `custom` and `targetCustom`.

Object-specific services:
- `TimelineActivityService.upsertEvents(WorkspaceEventBatch)` — listens to DB events, transforms each into a `TimelineActivityPayload` and upserts a timeline row. `transformEventsToTimelineActivityPayloads` resolves actor (workspaceMember), the linked record + cached name, and target column. `extract-object-singular-name-from-target-column-name` + `timeline-activity-related-morph-field-metadata-name-builder` map target columns ↔ object names.
- `upsert-timeline-activity-from-internal-event.job` — async job driving the above off the event emitter.
- `SYSTEM_OBJECTS_WITH_TIMELINE_ACTIVITIES = ['noteTarget','taskTarget']` — these system junctions also emit timeline entries (so adding a target to a person shows on the person's timeline).

## blocklist

Per-member blocked email/domain list (used by messaging sync to skip contacts). Label identifier: `handle`.

| Field | Type |
|---|---|
| handle | TEXT (email or domain) |
| workspaceMember / workspaceMemberId | N-1 WorkspaceMember (owner) |

Object-specific behavior — `BlocklistValidationService` + **pre-query hooks** (`blocklist.createOne/createMany/updateOne/updateMany`): validate each `handle` is a valid email or domain (`isDomain`) and scoped to the right member before write; reject invalid via `CommonQueryRunnerException`. `is-email-blocklisted.util` is the read-side check used by sync.

## workspace-member

Represents a user inside a workspace (profile + preferences). Label identifier: `name`. Image identifier: `avatarUrl`.

| Field | Type |
|---|---|
| name | FULL_NAME (composite) |
| colorScheme | TEXT (Light/Dark/System) |
| locale | SELECT (`APP_LOCALES`) |
| avatarUrl | TEXT |
| userEmail | TEXT |
| calendarStartDay | NUMBER |
| userId | UUID (→ core User) |
| timeZone | TEXT |
| dateFormat | SELECT (DateFormatEnum) |
| timeFormat | SELECT (TimeFormatEnum) |
| numberFormat | SELECT (NumberFormatEnum) |
| position | POSITION |
| searchVector | TS_VECTOR |

Relations: `assignedTasks`, `accountOwnerForCompanies`, `authoredAttachments`, `messageParticipants`, `blocklist`, `calendarEventParticipants`, `timelineActivities`, `ownedOpportunities`.

Object-specific behavior — large set of pre/post query hooks (`workspace-member-create/delete/destroy/restore/update-*`) for lifecycle invariants, plus `workspace-member-avatar-file-deletion.listener` that deletes the avatar file from storage when the member's avatar changes/removes.

## dashboard (+ chart-data, dashboard-sync)

Standard object `dashboard` (analytics canvas). Label identifier: `title`.

| Field | Type |
|---|---|
| title | TEXT |
| pageLayoutId | UUID (→ page layout) |
| position | POSITION |
| createdBy / updatedBy | ACTOR |
| searchVector | TS_VECTOR |

Relations: `timelineActivities`, `attachments`.

Object-specific subsystems (large, RUNTIME-HEAVY):
- **chart-data** — GraphQL `@Query` resolvers `barChartData` / `lineChartData` / `pieChartData`. Each service runs metadata-aware group-by aggregations through `chart-data-query.service`, then post-processes: gap-filling for date series (`apply-gap-filling`, `fill-date-gaps`, granularity helpers), dimension formatting, ordering (manual / select-option position / aggregate value), and limits (max bars/groups/slices/series). Converts chart filters → GQL operation filters; resolves aggregate field keys and group-by field objects.
- **dashboard tools** — LLM tools (`create-complete-dashboard`, `add-dashboard-tab`, `add/update/delete-dashboard-widget`, `get-dashboard`, `list-dashboards`) for AI-driven dashboard authoring, with `widget.schema` zod validation.
- **dashboard-sync** (`DashboardSyncService`) — keeps dashboard ↔ page-layout in sync: e.g. `updateLinkedDashboardsUpdatedAtByPageLayoutId` bumps dashboards when their `PageLayoutType.DASHBOARD` layout changes.
- `DashboardDuplicationService` (`@Mutation duplicateDashboard`), REST controller + pre-query hooks for create/destroy.

## match-participant (cross-cutting service)

Not a standard object — a service that links messaging/calendar participants back to `person` / `workspaceMember` rows by email. `MatchParticipantService.matchParticipants({participants, objectMetadataName, matchWith, workspaceId})` handles `messageParticipant` and `calendarEventParticipant`, matching by `workspaceMemberOnly | personOnly | workspaceMemberAndPerson`. `findPersonByPrimaryOrAdditionalEmail` + `addPersonEmailFiltersToQueryBuilder` resolve people by primary or additional emails; emits events and chunks bulk updates. System auth context, bypasses permissions.

---

## Parity notes

Build-stack assumption: **Mongo (documents) + Rust (heavy/query workers) + Next.js (UI/API)**. Twenty leans on Postgres-specific features (tsvector, ts_rank, per-workspace dynamic SQL schemas) that do not map 1:1 to Mongo.

| Item | Tag | 1-line build note (Mongo + Rust + Next) |
|---|---|---|
| record-crud facade | MEDIUM | Thin service layer over our repo; doable in Next/Node, but the metadata-driven runner + ToolOutput envelope is real work — start with a fixed-schema repo per object. |
| record-position (Kanban) | SIMPLE | Numeric `position` field + min/max lookups → trivial in Mongo; consider fractional indexing to avoid rebalances. |
| record-transformer | SIMPLE | Pure functions normalizing composite fields (emails/phones/links/richtext); port as Node utils, no DB. |
| search (tsvector + ts_rank + ILIKE fallback) | RUNTIME-HEAVY | No Mongo equivalent for `ts_rank_cd`; use Mongo Atlas Search / a Rust full-text worker (tantivy) for ranking + keyset cursors. Biggest re-architecture. |
| graphql hardening | MEDIUM | Complexity limit + introspection guard + error normalization; reimplement as middleware if we expose GraphQL, otherwise skip. |
| open-api generation | RUNTIME-HEAVY | Runtime OpenAPI-from-metadata only pays off with dynamic schemas; for fixed Mongo collections, hand-write/generate REST from a static schema instead. |
| sdk-client generation | RUNTIME-HEAVY | Per-workspace typed SDK zips; low priority — generate one static client from our fixed schema. |
| group-by / aggregation | MEDIUM | Maps to Mongo aggregation pipeline; aggregation-op validation per field is the fiddly part. Push heavy rollups to a Rust worker. |
| timeline-activity events | RUNTIME-HEAVY | Event-driven upsert off a change stream; needs an event bus + worker (Rust/queue) to transform DB events into feed rows. |
| task/note target cascades | MEDIUM | Soft-delete cascade via post-query hooks → replicate as service-level cascades or Mongo change-stream triggers. |
| blocklist validation | SIMPLE | Email/domain validation on write; pre-save hook in Node. |
| dashboard chart-data | RUNTIME-HEAVY | Group-by + gap-filling + ordering/limits per chart type; substantial. Use Mongo aggregation + Rust for date-bucketing/gap-fill. |
| dashboard-sync / duplication | SIMPLE | CRUD + reference bumping; straightforward Node services. |
| match-participant | MEDIUM | Email-matching against people/members; Mongo queries + bulk writes, manageable. |

**Standard-object fields — already modeled vs missing** (per our existing CRM rebuild status):
- **Already modeled (core CRM):** `company`, `person`, `opportunity`, `task`, `note`, `attachment` and their primary scalar/relation fields are within our shipped CRM scope. Kanban `position`, `createdBy/updatedBy` actor stamps, and the basic relation graph (company↔person↔opportunity, task/note→targets, attachments→targets) are the load-bearing pieces and should already be representable.
- **Likely partial / needs verification:** composite fields (`LINKS`, `EMAILS`, `PHONES`, `CURRENCY`, `ADDRESS`, `FULL_NAME`, `RICH_TEXT_V2`) — Twenty stores these as structured sub-columns; confirm our Mongo docs keep the same sub-field shape (e.g. `domainName.primaryLinkUrl`, `name.firstName/lastName`) rather than flattening.
- **Missing / not yet modeled:**
  - `searchVector` (TS_VECTOR) on every object — no Mongo counterpart; replace with an external search index, not a stored field.
  - `timeline-activity` object + its wide polymorphic target set and event-driven population — needs an event/worker pipeline we don't have yet.
  - `blocklist` (per-member email/domain blocking) — messaging-sync concern, not in core CRM.
  - `workspace-member` preference fields (`dateFormat`, `timeFormat`, `numberFormat`, `locale`, `timeZone`, `calendarStartDay`, `colorScheme`) — partly overlaps SabNode's own user/profile model; map onto existing user settings rather than re-modeling.
  - `dashboard` + chart-data analytics object and its tools — separate analytics surface, likely out of the initial CRM port.
  - `task-target` / `note-target` junction tables — if we model targets as embedded arrays in Mongo we avoid these, but lose the per-junction timeline-activity behavior.
  - Polymorphic `custom` relations (custom-object support) — depends on whether we port Twenty's custom-object metadata system at all.
