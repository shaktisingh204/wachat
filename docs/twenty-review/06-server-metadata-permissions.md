# Twenty CRM — Server Metadata & Permissions Engine (Original Catalog)

Read-only review of `packages/twenty-server/src/engine`. This document catalogs how
Twenty models objects/fields **as data**, how its RBAC + row-level permission system
is shaped, how the dynamic GraphQL/REST API is generated from that metadata, and where
views/view-fields/filters/sorts/groups live. All descriptions are paraphrased; no
source is copied verbatim.

Source roots reviewed:
- `engine/metadata-modules/*` (object-metadata, field-metadata, index-metadata, role,
  object-permission, field-permission, permission-flag, row-level-permission-predicate,
  role-target, user-role, view + view-*)
- `engine/api/{graphql,rest,mcp}` (dynamic schema + resolver generation)
- `engine/twenty-orm/*` (workspace datasource, repositories, schema manager)
- `engine/workspace-manager/*` (migration runner, standard-application seed)
- Field-type primitives in `packages/twenty-shared/src/types` and `.../constants`

---

## 1. The Metadata Model — objects & fields stored as data

Twenty is a **metadata-driven** CRM: business objects (Company, Person, …) and their
fields are not hardcoded entities. They are rows in PostgreSQL `metadata`-schema tables
(`objectMetadata`, `fieldMetadata`, `indexMetadata`). From these rows the server
generates, at runtime, real per-workspace SQL tables, a TypeORM datasource, and a
GraphQL schema. A bump to `workspaceMetadataVersion` invalidates caches and triggers
schema regeneration.

### 1.1 `ObjectMetadataEntity` (table `objectMetadata`)

One row = one object type in a workspace. Unique on `(nameSingular, workspaceId)` and
`(namePlural, workspaceId)`. Extends `SyncableEntity` (which adds `workspaceId`,
`universalIdentifier`, `standardId`, application-link columns used for diffing standard
metadata against the live workspace).

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid PK | Object metadata id |
| `dataSourceId` | uuid (deprecated) | Legacy FK to data source; column kept for data preservation |
| `nameSingular` / `namePlural` | varchar | API/codegen names (e.g. `company` / `companies`) |
| `labelSingular` / `labelPlural` | varchar | Human-facing labels |
| `description` | text? | Optional description |
| `icon` | varchar? | Icon key |
| `color` | text? | Display color |
| `standardOverrides` | jsonb? | Per-workspace overrides of a standard object's label/description/icon/translations |
| `targetTableName` | varchar (deprecated) | Legacy physical table name |
| `isCustom` | bool | User-created vs standard (seeded) object |
| `isRemote` | bool | Backed by a remote/foreign data source |
| `isActive` | bool | Soft on/off; inactive objects are excluded from schema |
| `isSystem` | bool | Internal object not shown as a normal CRM object |
| `isUIReadOnly` | bool | UI cannot mutate records |
| `isAuditLogged` | bool (default true) | Emit audit/timeline events |
| `isSearchable` | bool | Indexed into the search (`tsVector`) subsystem |
| `duplicateCriteria` | jsonb? | Field combinations used for duplicate detection |
| `shortcut` | varchar? | Keyboard shortcut |
| `labelIdentifierFieldMetadataId` | uuid? | Which field acts as the record's display label |
| `imageIdentifierFieldMetadataId` | uuid? | Which field is the record avatar/image |
| `isLabelSyncedWithName` | bool | Keep label auto-derived from name |
| `createdAt` / `updatedAt` | timestamptz | Audit |

Relations: `fields` (OneToMany FieldMetadata, cascade), `indexMetadatas` (OneToMany,
cascade), `objectPermissions`, `fieldPermissions`, `views`.

### 1.2 `FieldMetadataEntity` (table `fieldMetadata`)

One row = one field on an object. Generic over `TFieldMetadataType` so `defaultValue`,
`options`, and `settings` are typed by the field's `type`. Unique on
`(name, objectMetadataId, workspaceId)`. A DB `CHECK` enforces that `MORPH_RELATION`
fields carry a `morphId`.

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid PK | Field metadata id |
| `objectMetadataId` | uuid FK | Owning object (CASCADE delete) |
| `object` | ManyToOne | Owning `ObjectMetadataEntity` |
| `type` | varchar (`FieldMetadataType`) | The field type (see §1.3) |
| `name` | varchar | API/column name |
| `label` | varchar | Human label |
| `defaultValue` | jsonb? | Type-shaped default (literal or function `uuid`/`now`) |
| `description` | text? | Optional |
| `icon` | varchar? | Icon key |
| `standardOverrides` | jsonb? | Per-workspace overrides of a standard field |
| `options` | jsonb? | Type-shaped options — primarily SELECT/MULTI_SELECT option lists |
| `settings` | jsonb? | Type-shaped settings (see §1.4) |
| `isCustom` | bool | Custom vs standard field |
| `isActive` | bool | On/off |
| `isSystem` | bool | Internal field |
| `isUIReadOnly` | bool | UI cannot edit value |
| `isNullable` | bool? | Whether the generated column allows null |
| `isUnique` | bool? | **Derived** at flat-cache build time from a single-field UNIQUE index — not a stored column |
| `isLabelSyncedWithName` | bool | Keep label auto-derived |
| `relationTargetFieldMetadataId` | uuid? | (RELATION/MORPH) the paired field on the other side |
| `relationTargetObjectMetadataId` | uuid? | (RELATION/MORPH) the target object |
| `morphId` | uuid? | (MORPH_RELATION only) groups the per-target sub-fields of one polymorphic relation |
| `createdAt` / `updatedAt` | timestamptz | Audit |

Relations: `relationTargetFieldMetadata` (OneToOne self), `relationTargetObjectMetadata`
(ManyToOne object), `indexFieldMetadatas`, `fieldPermissions`, plus view back-refs
(`viewFields`, `viewFilters`, `viewSorts`, and view-level group/calendar/kanban field refs).

Note on relations: Twenty does **not** keep a separate `relationMetadata` table in this
version. A relation is modeled as **two `fieldMetadata` rows** (one per side) that point
at each other via `relationTargetFieldMetadataId` and at the partner object via
`relationTargetObjectMetadataId`. The relation's *kind* and physical join column live in
the field's `settings` (see §1.4).

### 1.3 The full FieldMetadataType enum

Defined in `twenty-shared/src/types/FieldMetadataType.ts`. **23 types**:

| Type | Category | Stored as (logical) | Notes |
|---|---|---|---|
| `UUID` | Scalar | uuid | Default fn `uuid` supported |
| `TEXT` | Scalar | text | Settings: `displayedMaxRows` |
| `NUMBER` | Scalar | int/float/bigint | Settings: `dataType`, `decimals`, `number`/`percentage` variant |
| `NUMERIC` | Scalar | decimal-as-string | Arbitrary precision; default is string |
| `BOOLEAN` | Scalar | boolean | |
| `DATE` | Scalar | date | Default fn `now`; settings `displayFormat` |
| `DATE_TIME` | Scalar | timestamptz | Default fn `now`; settings `displayFormat` |
| `POSITION` | Scalar | float | Record ordering (fractional indexing) |
| `RATING` | Scalar | enum-ish string | Star rating, stored as string option |
| `SELECT` | Enum | string | `options` = list of `{ id, value, label, color, position }` |
| `MULTI_SELECT` | Enum | string[] | Same option shape, array value |
| `RAW_JSON` | Scalar | jsonb | Arbitrary JSON |
| `ARRAY` | Scalar | text[] | Settings: multi-item settings |
| `RICH_TEXT` | Composite | jsonb `{ blocknote, markdown }` | BlockNote doc + markdown mirror |
| `FULL_NAME` | Composite | `{ firstName, lastName }` | |
| `ADDRESS` | Composite | street1/2, city, postcode, state, country, lat, lng | Settings: `subFields` whitelist |
| `LINKS` | Composite | `{ primaryLinkLabel, primaryLinkUrl, secondaryLinks[] }` | Multi-item settings |
| `EMAILS` | Composite | `{ primaryEmail, additionalEmails }` | Multi-item settings |
| `PHONES` | Composite | `{ primaryPhoneNumber, primaryPhoneCountryCode, primaryPhoneCallingCode, additionalPhones }` | Multi-item settings |
| `CURRENCY` | Composite | `{ amountMicros, currencyCode }` | Amount stored as micros string |
| `ACTOR` | Composite | `{ source, workspaceMemberId?, name }` | Who created/updated (system, API, user, …) |
| `RELATION` | Relation | FK / inverse collection | Settings carry `relationType` + join column |
| `MORPH_RELATION` | Relation | polymorphic | One logical field fanned out across targets, grouped by `morphId` |
| `TS_VECTOR` | System | tsvector | Generated search column; settings `asExpression`, `generatedType` (`STORED`/`VIRTUAL`) |
| `FILES` | Composite-ish | file refs | Settings: `maxNumberOfValues` |

**Composite field types** (`COMPOSITE_FIELD_TYPES`): `ADDRESS`, `CURRENCY`, `FULL_NAME`,
`LINKS`, `EMAILS`, `PHONES`, `RICH_TEXT`, `ACTOR`. Composite fields explode into multiple
physical columns and into nested GraphQL object types; each sub-field can be independently
filtered, sorted, grouped, and search-indexed.

### 1.4 Field `settings` shapes (per type)

From `FieldMetadataSettings.ts`. `settings` is a type-discriminated jsonb blob:

- **NUMBER** — `dataType` (`float`/`int`/`bigint`), `decimals`, `type` (`number`/`percentage`)
- **TEXT** — `displayedMaxRows`
- **DATE / DATE_TIME** — `displayFormat` (`RELATIVE`/`USER_SETTINGS`/`CUSTOM`)
- **RELATION / MORPH_RELATION** — `relationType` (`MANY_TO_ONE`/`ONE_TO_MANY`), `onDelete`
  (`CASCADE`/`RESTRICT`/`SET_NULL`/`NO_ACTION`), `joinColumnName`, `junctionTargetFieldId`
- **ADDRESS** — `subFields` (allowed address sub-fields)
- **FILES** — `maxNumberOfValues` (required)
- **TS_VECTOR** — `asExpression`, `generatedType` (`STORED`/`VIRTUAL`)
- **PHONES / EMAILS / LINKS / ARRAY** — multi-item settings (e.g. max-rows for additional items)

`defaultValue` (`FieldMetadataDefaultValue.ts`) is similarly type-mapped — scalars take
literals, date types accept the `now` function token, UUID accepts the `uuid` token, and
composites take their full nested object shape.

### 1.5 Relation kinds

- `RelationType`: `MANY_TO_ONE`, `ONE_TO_MANY` (the two persisted directions; a one-to-many
  on one side pairs with a many-to-one on the other).
- `RelationOnDeleteAction`: `CASCADE`, `RESTRICT`, `SET_NULL`, `NO_ACTION`.
- `MORPH_RELATION`: a polymorphic relation that can target several object types; the
  per-target field rows share a `morphId` and a DB CHECK enforces its presence.

### 1.6 `IndexMetadataEntity` (table `indexMetadata`) + `IndexFieldMetadataEntity`

Indexes are first-class metadata so the schema manager can create real Postgres indexes.

| Column | Type | Meaning |
|---|---|---|
| `id` | uuid PK | |
| `name` | varchar | Index name (unique per object+workspace) |
| `objectMetadataId` | uuid FK | Owning object |
| `isCustom` | bool | |
| `isUnique` | bool | UNIQUE constraint (single-field unique is what drives `FieldMetadata.isUnique`) |
| `indexWhereClause` | text? | Partial-index predicate |
| `indexType` | enum | `BTREE` (default) / `GIN` / others — chosen by field type (e.g. GIN for jsonb/array/tsvector) |
| `createdAt`/`updatedAt` | timestamptz | |

`IndexFieldMetadataEntity` rows (OneToMany, ordered) list which fields participate in an
index and in what order.

---

## 2. The Permissions Model — RBAC + field + row-level

Twenty's authorization is **role-based**, resolved per `(workspaceId, role)` into a
computed `UserWorkspacePermissions` object (`{ permissionFlags, objectsPermissions }`)
that is cached and consulted by the API layer on every operation.

### 2.1 `RoleEntity` (table `role`)

Unique on `(label, workspaceId)`. A role carries **workspace-wide "all-records" toggles**
plus links to fine-grained per-object/per-field/row-level grants.

| Column | Meaning |
|---|---|
| `label` | Role name |
| `description`, `icon` | Display |
| `canUpdateAllSettings` | Master settings-admin flag |
| `canAccessAllTools` | Grants all tool permission-flags |
| `canReadAllObjectRecords` | Default-allow READ across all objects |
| `canUpdateAllObjectRecords` | Default-allow UPDATE across all objects |
| `canSoftDeleteAllObjectRecords` | Default-allow soft-delete (trash) |
| `canDestroyAllObjectRecords` | Default-allow permanent delete |
| `isEditable` | Whether the role can be edited (standard roles are locked) |
| `canBeAssignedToUsers` / `canBeAssignedToAgents` / `canBeAssignedToApiKeys` | Which target kinds may hold this role |

Relations: `roleTargets`, `objectPermissions`, `fieldPermissions`,
`rolePermissionFlags`, `rowLevelPermissionPredicates`, `rowLevelPermissionPredicateGroups`.

The four `canXAllObjectRecords` flags model the **object-level CRUD + restore +
permanently-delete** matrix at the role default level; per-object overrides refine it.

### 2.2 Object-level overrides — `ObjectPermissionEntity` (table `objectPermission`)

Per `(objectMetadataId, roleId)` override of the role's "all records" defaults. Each
verb is **nullable tri-state** — `true` (grant), `false` (deny), `null` (inherit role default):

| Column | Verb |
|---|---|
| `canReadObjectRecords` | READ |
| `canUpdateObjectRecords` | UPDATE |
| `canSoftDeleteObjectRecords` | SOFT DELETE (trash) |
| `canDestroyObjectRecords` | DESTROY (permanent delete) |

Note: there is no explicit per-object `create` flag — create authorization is derived from
update/read capability plus restore semantics (restore = un-soft-delete, gated by the
soft-delete capability rather than a separate column).

### 2.3 Field-level overrides — `FieldPermissionEntity` (table `fieldPermission`)

Per `(fieldMetadataId, roleId)` (also stores `objectMetadataId`). Two nullable tri-state verbs:

| Column | Verb |
|---|---|
| `canReadFieldValue` | Read this field's value |
| `canUpdateFieldValue` | Write this field's value — **validated to be only `false` or `null`** (you can revoke write, not grant write beyond object-level) |

This implements **field-level visibility / read-only** control layered on top of object perms.

### 2.4 Permission flags — `PermissionFlagType` + `RolePermissionFlagEntity`

`PermissionFlagType` (twenty-shared) is the set of **feature/settings/tool capabilities**
a role can hold, split into two families:

- **Settings permissions**: `API_KEYS_AND_WEBHOOKS`, `WORKSPACE`, `WORKSPACE_MEMBERS`,
  `ROLES`, `DATA_MODEL`, `SECURITY`, `WORKFLOWS`, `IMPERSONATE`, `SSO_BYPASS`,
  `APPLICATIONS`, `MARKETPLACE_APPS`, `LAYOUTS`, `BILLING`, `AI_SETTINGS`
- **Tool permissions**: `AI`, `VIEWS`, `UPLOAD_FILE`, `DOWNLOAD_FILE`, `SEND_EMAIL_TOOL`,
  `HTTP_REQUEST_TOOL`, `CODE_INTERPRETER_TOOL`, `IMPORT_CSV`, `EXPORT_CSV`,
  `CONNECTED_ACCOUNTS`, `PROFILE_INFORMATION`

`PermissionFlagEntity` is the registry of available flags; `RolePermissionFlagEntity`
joins `(roleId, permissionFlagId)` to grant a flag to a role. (The link was migrated from
an inline `flag` varchar to a FK to `permissionFlag` via upgrade commands — both columns
appear, decorated with `WasIntroducedInUpgrade`/`WasRemovedInUpgrade`.)

### 2.5 Role assignment — `RoleTargetEntity` (table `roleTarget`)

The polymorphic **user-role mapping**. A row binds a role to exactly one of three target
kinds (enforced by a DB CHECK that exactly one of the three is non-null):

- `userWorkspaceId` — a human member
- `agentId` — an AI agent
- `apiKeyId` — an API key

Unique per workspace per target. This is how Twenty supports assigning roles not just to
users but also to API keys and AI agents. (`user-role` module wraps the user-facing slice.)

### 2.6 Row-level (record-scoped) permissions — Enterprise

Two `core`-schema entities marked `@license Enterprise`:

**`RowLevelPermissionPredicateEntity`** — a single predicate evaluated per record per role:

| Field | Meaning |
|---|---|
| `roleId`, `objectMetadataId`, `fieldMetadataId` | Scope: which role, object, and field |
| `operand` | A `RowLevelPermissionPredicateOperand` (see below) |
| `value` | jsonb — string/number/bool/array, or a relation value `{ isCurrentWorkspaceMemberSelected, selectedRecordIds }` |
| `subFieldName` | For composite fields, which sub-field to test |
| `workspaceMemberFieldMetadataId` / `workspaceMemberSubFieldName` | Compare against the *acting* member's own field (e.g. "owner == me") |
| `rowLevelPermissionPredicateGroupId` + `positionInGroup` | Membership in a boolean group |
| soft-delete `deletedAt` | Supports trashing predicates |

`RowLevelPermissionPredicateOperand`: `IS`, `IS_NOT`, `IS_NOT_NULL`,
`LESS_THAN_OR_EQUAL`, `GREATER_THAN_OR_EQUAL`, `IS_BEFORE`, `IS_AFTER`, `CONTAINS`,
`DOES_NOT_CONTAIN`, `IS_EMPTY`, `IS_NOT_EMPTY`, `IS_RELATIVE`, `IS_IN_PAST`,
`IS_IN_FUTURE`, `IS_TODAY`, `VECTOR_SEARCH`.

**`RowLevelPermissionPredicateGroupEntity`** — nestable AND/OR grouping of predicates
(`logicalOperator` = `AND`/`OR`, self-referential `parentRowLevelPermissionPredicateGroupId`),
so a role can express arbitrarily nested boolean record filters (e.g.
"owner = me OR (stage = Won AND amount > 1000)").

### 2.7 Computed result

The permissions service resolves a member's roles into
`UserWorkspacePermissions = { permissionFlags: Record<PermissionFlagType, boolean>,
objectsPermissions: ObjectsPermissions }`. The API layer (resolvers, REST handlers) reads
this to gate object CRUD, restore/destroy, field read/write, and to inject row-level
predicate WHERE clauses into generated queries.

### Permissions table (summary)

| Layer | Entity | Granularity | Verbs / shape |
|---|---|---|---|
| Role defaults | `RoleEntity` | Workspace-wide per role | read / update / softDelete / destroy "all records" + settings + tools master |
| Object override | `ObjectPermissionEntity` | Per object per role | read / update / softDelete / destroy (tri-state) |
| Field override | `FieldPermissionEntity` | Per field per role | readValue / updateValue (updateValue only false/null) |
| Feature flags | `RolePermissionFlagEntity` + `PermissionFlagType` | Per role | 25 settings/tool capability flags |
| Assignment | `RoleTargetEntity` | Per (user \| agent \| apiKey) | binds role to a principal |
| Row-level | `RowLevelPermissionPredicate(+Group)Entity` | Per record per role | 16 operands, nested AND/OR, "compare to me" |

---

## 3. Dynamic GraphQL / REST API generation from metadata

The defining trait of the engine: there are no hand-written resolvers per object. The
schema and resolvers are **built at runtime from the metadata rows** and cached per
workspace (keyed by `workspaceMetadataVersion`).

### 3.1 GraphQL schema builder (`api/graphql/workspace-schema-builder`)

- `WorkspaceGraphQLSchemaGenerator.generateSchema(context)` builds a `GraphQLSchema` by
  asking `GqlTypeGenerator.buildAndStore(context)` to materialize all types into a
  `GqlTypesStorage`, then wiring the `Query` and `Mutation` root types.
- `graphql-type-generators/` produces, from each object's flat metadata:
  - **object-types** — the record output type (composite fields become nested object types;
    relations become connection/edge types)
  - **input-types** — create/update inputs (with type-specific input shaping via
    `apply-type-options-for-create-input` / `...update-input`)
  - **args-type** — `filter`, `orderBy`, pagination args
  - **enum-types** — SELECT/MULTI_SELECT option enums, plus filter enums
  - **root-types** — the per-object Query/Mutation fields
- `utils/` handles the hard cases: composite-field target/type computation
  (`compute-composite-field-type-options`, `compute-composite-property-target`), number
  scalar/filter selection, relation field-name extraction, available aggregations, and
  list wrapping.

### 3.2 Resolver builder (`api/graphql/workspace-resolver-builder`)

`workspace-resolver.factory.ts` attaches a generated resolver for every object using
factories per operation. The full operation set (`RESOLVER_METHOD_NAMES`):

`findMany`, `findOne`, `findDuplicates`, `groupBy`, `createMany`, `createOne`,
`updateMany`, `updateOne`, `deleteMany`, `deleteOne`, `restoreMany`, `restoreOne`,
`destroyMany`, `destroyOne`, `mergeMany`.

Note the **soft-delete model**: `delete*` = soft-delete (trash, sets `deletedAt`),
`restore*` = un-trash, `destroy*` = permanent delete — these map 1:1 onto the object-level
permission verbs in §2.2. `mergeMany` performs record de-duplication/merge. Each resolver
runs through `create-query-runner-context` so permission checks + row-level predicates are
applied uniformly.

### 3.3 Query execution (`api/graphql/workspace-query-runner` + `api/common`)

Generated resolvers delegate to a query-runner pipeline that translates GraphQL args into
SQL via the twenty-orm workspace repository: args processors, nested-relation processors,
select-field resolution, and result getters (`api/common/*`). This is also where
aggregations and `groupBy` are computed.

### 3.4 REST + MCP (`api/rest`, `api/mcp`)

- `api/rest/core` exposes the same generated objects over REST (controllers + handlers +
  `rest-to-common-args-handlers` that reuse the common args pipeline), and `api/rest/metadata`
  exposes the metadata CRUD surface.
- `api/mcp` exposes an MCP (Model Context Protocol) server over the same metadata so AI
  agents can call the CRM as tools, gated by the same permission flags.

### 3.5 twenty-orm — the runtime datasource (`engine/twenty-orm`)

- `global-workspace-datasource` — a per-workspace TypeORM datasource built from metadata,
  with an entity-metadatas cache so each workspace's dynamic entities are reused.
- `workspace.repository.ts` + custom query builders (`workspace-select/insert/update/
  delete/soft-delete-query-builder`) — repository layer that injects workspace scoping and
  **permission predicates** (`repository/permissions.utils.ts`) into every query.
- `workspace-schema-manager` — issues the actual DDL (create/alter table, columns, indexes,
  enums) so metadata changes become real Postgres schema.
- `base.workspace-entity.ts` / `custom.workspace-entity.ts` — base shapes for standard vs
  custom objects.

### 3.6 workspace-manager — schema lifecycle & seed (`engine/workspace-manager`)

- `workspace-migration/workspace-migration-runner` + `workspace-migration-builder` —
  diffs desired metadata vs live schema and emits ordered migration actions (per
  object/field/index/permission-flag/role/view…). `universal-flat-entity` is the flat,
  comparable representation used for diffing.
- `twenty-standard-application` — the **seed/standard objects** definition: standard
  objects, fields, indexes, roles, permission-flags, views, view-fields/filters/groups,
  page layouts, navigation, agents, skills, command-menu items. On workspace creation this
  is prefilled (`standard-objects-prefill-data`) and on upgrade it is reconciled.
- `dev-seeder` — demo data seeding for development.
- `workspace-cleaner` / `workspace-version` — teardown and version tracking.

---

## 4. Views and view-* (they live in the engine)

Views and all their sub-records are **first-class metadata entities** in
`engine/metadata-modules/view*` (in the `core` schema), each with their own
GraphQL/REST resolvers, controllers, and seed integration.

### 4.1 `ViewEntity` (table `core.view`)

Per-object saved view. Key columns: `name`, `objectMetadataId`, `type`
(`ViewType`: TABLE / KANBAN / CALENDAR / …), `key` (`ViewKey`, e.g. INDEX for the
default), `icon`, `position`, `isCompact`, `isCustom`, `openRecordIn`
(`ViewOpenRecordIn`: SIDE_PANEL / RECORD_PAGE), `visibility` (`ViewVisibility`),
plus kanban config (`kanbanAggregateOperation` + `kanbanAggregateOperationFieldMetadataId`),
calendar config (`calendarLayout` + `calendarFieldMetadataId`, with a CHECK enforcing
calendar integrity), grouping (`mainGroupByFieldMetadataId`), and
`createdByUserWorkspaceId`. Relations to the sub-records below.

### 4.2 Sub-records

| Entity | Table | Purpose | Notable columns |
|---|---|---|---|
| `ViewFieldEntity` | `core.viewField` | Column in the view | `fieldMetadataId`, `isVisible`, `size`, `position`, `aggregateOperation`, `viewFieldGroupId` |
| `ViewFieldGroupEntity` | `core.viewFieldGroup` | Grouping of fields (sections) | grouping of view fields |
| `ViewFilterEntity` | `core.viewFilter` | A saved filter | `fieldMetadataId`, `operand` (`ViewFilterOperand`), `value` (jsonb), `subFieldName`, `relationTargetFieldMetadataId`, `viewFilterGroupId`, `positionInViewFilterGroup` |
| `ViewFilterGroupEntity` | `core.viewFilterGroup` | AND/OR grouping of filters | logical operator + nesting |
| `ViewSortEntity` | `core.viewSort` | A sort | `fieldMetadataId`, `direction` (`ViewSortDirection` ASC/DESC), `subFieldName` |
| `ViewGroupEntity` | `core.viewGroup` | Kanban/group lane | `fieldValue`, `isVisible`, `position` |

All sub-records carry `viewId`, soft-delete `deletedAt`, and CASCADE delete from the view.
`view-permissions/` adds guards so view CRUD respects the `VIEWS` permission flag and role
visibility.

---

## 5. Parity notes — Twenty engine vs our SabNode Mongo CRM

Our side (for reference):
- Objects/fields stored as data in Mongo — `src/lib/sabcrm/schema.ts` defines
  `STANDARD_OBJECTS: ObjectMetadata[]` with fields `{ name, type, settings, relation… }`;
  shapes in `src/lib/sabcrm/types.ts`. We have **basic field types** (TEXT, NUMBER, SELECT,
  RELATION, etc.) and **composite types** mirroring Twenty's intent.
- Records live in Mongo collections; querying is via `records.server.ts` /
  `records-filter.ts` (not a generated SQL schema).
- RBAC via SabNode roles + the `sabcrm-roles` Rust crate (`rust/crates/sabcrm-roles`):
  role docs are `{ projectId, name, permissions: string[], memberIds, isDefault }` with
  **free-form string permission keys** (canonical set: `records:read`, `records:write`,
  `records:delete`, `settings:manage`, `members:manage`).

### Gaps vs Twenty (tagged by effort)

**SIMPLE** (data-model / config additions, no new runtime):
- **Field-type coverage** — add the missing scalar/composite types we don't model yet
  (e.g. `RATING`, `ACTOR`, `RAW_JSON`, `POSITION`, `NUMERIC`, `PHONES`, `EMAILS`, `LINKS`,
  `CURRENCY` with micros, `RICH_TEXT` blocknote+markdown). Pure schema/validation work.
- **Per-type `settings` blob** — adopt Twenty's discriminated `settings` (number dataType/
  decimals, date displayFormat, address subFields, files maxNumberOfValues) instead of ad-hoc.
- **Object metadata flags** — add `isSystem`, `isUIReadOnly`, `isSearchable`,
  `isAuditLogged`, `labelIdentifierField`, `imageIdentifierField`, `duplicateCriteria`,
  `standardOverrides`. Mostly extra fields on our `ObjectMetadata`.
- **Permission-flag taxonomy** — replace free-form permission strings with a structured
  enum like `PermissionFlagType` (settings + tool families). Mapping/migration only.
- **Object-level tri-state CRUD matrix** — model read/update/softDelete/destroy as an
  explicit per-object-per-role override (we currently collapse to records:read/write/delete).

**MEDIUM** (new persisted structures + service logic, still Mongo-friendly):
- **Field-level permissions** — per-field read/update grants (`FieldPermissionEntity`
  analog). Needs a join collection + enforcement in our record read/write path.
- **Role assignment to non-users** — `RoleTarget`-style polymorphic binding to agents /
  API keys, not just member ids.
- **Indexes as metadata** — explicit `indexMetadata` (unique, partial, GIN/BTREE) driving
  Mongo index creation; today indexing is implicit/manual.
- **Views as first-class records** — we have board/groupBy hints inline on objects, but not
  full `View` + `ViewField/Filter/Sort/Group(+Group)` entities with AND/OR filter groups,
  per-view visibility, kanban/calendar config, and view-level RBAC. Medium because it's a
  set of new collections + CRUD + UI wiring.
- **Composite sub-field filtering/sorting/grouping** — treat composite sub-fields
  (address.city, phones.primary) as independently queryable, matching Twenty's `subFieldName`.

**RUNTIME-HEAVY** (significant engine work):
- **Dynamic API generation** — Twenty generates a full GraphQL (and REST/MCP) schema +
  resolvers per workspace from metadata, regenerated on a metadata-version bump. We use
  fixed server actions over Mongo. Achieving generated, per-tenant typed APIs (incl.
  connections, aggregations, `groupBy`, `findDuplicates`, `mergeMany`) is a large build.
- **Schema migration runner** — Twenty diffs flat metadata vs live SQL schema and emits
  ordered DDL migrations + per-workspace upgrade/instance commands. Mongo is schemaless so
  we sidestep DDL, but we'd still want a comparable **metadata-diff + reconcile + version**
  pipeline (and standard-app reseed/upgrade) to safely evolve standard objects.
- **Row-level permission predicates** — nested AND/OR record predicates per role with 16
  operands and "compare to acting member" semantics, injected into every query's WHERE.
  This is the heaviest gap: needs a predicate model, a group tree, and an evaluator/compiler
  that rewrites our Mongo queries — currently absent on our side.
- **Soft-delete + restore + permanent-destroy lifecycle** — Twenty's delete/restore/destroy
  split (with matching permission verbs and trash cleanup crons) would need to be threaded
  through our record layer, not just a hard delete.
- **MORPH_RELATION (polymorphic relations)** — modeling one logical relation across multiple
  target objects (grouped by `morphId`) plus generated polymorphic query/resolve paths.

---

### Summary of where things live (quick index)

- Object/field/index metadata entities: `engine/metadata-modules/{object-metadata,field-metadata,index-metadata}`
- Field-type primitives: `twenty-shared/src/types/{FieldMetadataType,FieldMetadataSettings,FieldMetadataDefaultValue}.ts`
- RBAC: `engine/metadata-modules/{role,object-permission(+field-permission),permission-flag,role-permission-flag,role-target,user-role}`
- Row-level perms (Enterprise): `engine/metadata-modules/row-level-permission-predicate`
- Computed perms: `engine/metadata-modules/permissions`
- Dynamic API: `engine/api/{graphql/workspace-schema-builder,graphql/workspace-resolver-builder,graphql/workspace-query-runner,rest,mcp}`
- Runtime ORM: `engine/twenty-orm` (datasource, repositories, schema-manager)
- Schema lifecycle + seed: `engine/workspace-manager` (workspace-migration, twenty-standard-application)
- Views: `engine/metadata-modules/view` + `view-field`/`view-field-group`/`view-filter`/`view-filter-group`/`view-sort`/`view-group`/`view-permissions`
