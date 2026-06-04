# Workspace Manager: Seeder, Cleaner, Version, Types & Utils

Comprehensive function documentation for workspace initialization, cleanup, versioning, and utility operations in the Twenty backend.

## dev-seeder/services/dev-seeder.service.ts

### seedDev
`file: dev-seeder/services/dev-seeder.service.ts:71`
`(workspaceId: SeededWorkspacesIds, options?: { light?: boolean }) => Promise<void>`

Orchestrates complete development workspace initialization: creates core schema with users/billing, sets up workspace database schema, synchronizes Twenty Standard Application, seeds metadata objects and relations, initializes permissions, configures page layouts, and loads test data in batches.

### seedEmptyWorkspace
`file: dev-seeder/services/dev-seeder.service.ts:191`
`(workspaceId: SeededEmptyWorkspacesIds) => Promise<void>`

Creates minimal workspace without test data: executes workspace creation, registers custom and standard applications, sets up basic permissions/roles, marks upgrade migration as initial, flushes workspace cache.

### seedCoreSchema (private)
`file: dev-seeder/services/dev-seeder.service.ts:269`
`(options: { workspaceId, appVersion, initialCursor, seedBilling? }) => Promise<void>`

Transactional core schema seeding: inserts workspace record, creates applications, seeds users/user-workspaces, injects server ID/API keys/feature flags/agents, optionally seeds billing data, marks workspace upgrade migration.

## dev-seeder/core/services/dev-seeder-permissions.service.ts

### initPermissions
`file: dev-seeder/core/services/dev-seeder-permissions.service.ts:48`
`(options: { workspaceId, twentyStandardFlatApplication, workspaceCustomFlatApplication, light? }) => Promise<void>`

Assigns users to roles based on workspace type (Apple vs YC) and mode (light vs full): designates admin/member/limited/guest roles, creates custom role with object/field restrictions in full mode, assigns API key role target.

### initMinimalPermissionsAndActivateWorkspace
`file: dev-seeder/core/services/dev-seeder-permissions.service.ts:165`
`(options: { workspaceId, workspaceCustomFlatApplication }) => Promise<RoleDTO>`

Creates member role, sets as default, activates workspace, returns created role for assignment to users.

### createLimitedRoleForSeedWorkspace (private)
`file: dev-seeder/core/services/dev-seeder-permissions.service.ts:187`
`(options: { workspaceId, ownerFlatApplication }) => Promise<RoleDTO>`

Creates custom 'Object-restricted' role with read-only Pet, no Rocket access, read-only Person city field, no Company LinkedIn field visibility.

## dev-seeder/metadata/services/dev-seeder-metadata.service.ts

### seed
`file: dev-seeder/metadata/services/dev-seeder-metadata.service.ts:196`
`(options: { workspaceId, light? }) => Promise<void>`

Seeds custom objects (Rocket, Pet, Survey Result, Employment History, Pet Care Agreement) and custom fields for Company/Person based on workspace config, skipping in light mode.

### seedRelations
`file: dev-seeder/metadata/services/dev-seeder-metadata.service.ts:272`
`(options: { workspaceId, light? }) => Promise<void>`

Creates morph relations (with inverse fields), junction fields (with relations), and junction field configurations sequentially, recomputing flat maps between stages.

### seedCustomObject (private)
`file: dev-seeder/metadata/services/dev-seeder-metadata.service.ts:229`
`(options: { workspaceId, objectMetadataSeed }) => Promise<void>`

Creates one custom object metadata.

### seedCustomFields (private)
`file: dev-seeder/metadata/services/dev-seeder-metadata.service.ts:242`
`(options: { workspaceId, objectMetadataNameSingular, fieldMetadataSeeds }) => Promise<void>`

Batch-creates field metadata for object, enriching seeds with object metadata ID.

## dev-seeder/data/services/dev-seeder-data.service.ts

### seed
`file: dev-seeder/data/services/dev-seeder-data.service.ts:278`
`(options: { schemaName, workspaceId, featureFlags?, light? }) => Promise<void>`

Batch-inserts seed records across 6 dependency-ordered batches (workspaceMember/rocket first, company/dashboard second, person/pet third, opportunity/note/task/message fourth, note/task target associations fifth, attachments last); uploads attachment files, prefills workflows/command menu items, seeds timeline activities.

## dev-seeder/data/services/timeline-activity-seeder.service.ts

### ensureSeeded
`file: dev-seeder/data/services/timeline-activity-seeder.service.ts`
`(options: { workspaceId, definitions }) => Promise<void>`

Inserts timeline activity records for multiple entity types (company, person, opportunity, note, task, calendar event, message) with activity targets and timestamps.

## dev-seeder/core/utils/seed-workspace.util.ts

### createWorkspace
`file: dev-seeder/core/utils/seed-workspace.util.ts:16`
`(args: SeedWorkspaceArgs) => Promise<void>`

Inserts workspace record with display name, subdomain, workspace ID, custom app ID.

### deleteWorkspaces
`file: dev-seeder/core/utils/seed-workspace.util.ts:36`
`(args: DeleteWorkspacesArgs) => Promise<void>`

Deletes workspace by ID.

## dev-seeder/core/utils/seed-users.util.ts

### seedUsers
`file: dev-seeder/core/utils/seed-users.util.ts:23`
`(args: SeedUsersArgs) => Promise<void>`

Inserts 4 hardcoded users (Tim, Jane, Jony, Phil) plus 1000 randomly-generated users with seeded email/name patterns and common password hash.

## dev-seeder/core/utils/seed-user-workspaces.util.ts

### seedUserWorkspaces
`file: dev-seeder/core/utils/seed-user-workspaces.util.ts:37`
`(args: SeedUserWorkspacesArgs) => Promise<void>`

Maps users to workspace (workspace-specific IDs differ between Apple/YC workspaces); includes random users only in Apple workspace.

### deleteUserWorkspaces
`file: dev-seeder/core/utils/seed-user-workspaces.util.ts:113`
`(args: DeleteUserWorkspacesArgs) => Promise<void>`

Deletes all user-workspace associations for given workspace.

## dev-seeder/core/utils/seed-server-id.util.ts

### seedServerId
`file: dev-seeder/core/utils/seed-server-id.util.ts:9`
`(args: SeedServerIdArgs) => Promise<void>`

Generates and inserts unique SERVER_ID UUID into keyValuePair table.

## dev-seeder/core/utils/seed-api-keys.util.ts

### seedApiKeys
`file: dev-seeder/core/utils/seed-api-keys.util.ts:13`
`(args: SeedApiKeysArgs) => Promise<void>`

Inserts test API key "My api key" with 100-year expiration per workspace.

## dev-seeder/core/utils/seed-feature-flags.util.ts

### seedFeatureFlags
`file: dev-seeder/core/utils/seed-feature-flags.util.ts:12`
`(args: SeedFeatureFlagsArgs) => Promise<void>`

Sets 5 feature flags: IS_UNIQUE_INDEXES_ENABLED=false, IS_PUBLIC_DOMAIN_ENABLED=true, IS_EMAIL_GROUP_ENABLED=true, IS_JUNCTION_RELATIONS_ENABLED=true, IS_MARKETPLACE_SETTING_TAB_VISIBLE=true.

### deleteFeatureFlags
`file: dev-seeder/core/utils/seed-feature-flags.util.ts:58`
`(args: DeleteFeatureFlagsArgs) => Promise<void>`

Removes all feature flags for workspace.

## dev-seeder/core/utils/seed-agents.util.ts

### seedAgents
`file: dev-seeder/core/utils/seed-agents.util.ts:388`
`(args: SeedAgentsArgs) => Promise<void>`

Creates agent chat threads, turns, messages, and message parts with realistic sample conversations (skips Apple workspace).

### seedChatThreads (private)
`file: dev-seeder/core/utils/seed-agents.util.ts:53`
`(args: SeedChatThreadsArgs) => Promise<string>`

Inserts agent chat thread per workspace, returns thread ID.

### seedChatMessages (private)
`file: dev-seeder/core/utils/seed-agents.util.ts:107`
`(args: SeedChatMessagesArgs) => Promise<void>`

Creates 2 agent turns with 4 messages (user/assistant pairs) per workspace with realistic business conversations.

## dev-seeder/core/utils/seed-metadata-entities.util.ts

### seedMetadataEntities
`file: dev-seeder/core/utils/seed-metadata-entities.util.ts:92`
`(args: SeedMetadataEntitiesArgs) => Promise<void>`

Orchestrates seeding of connected accounts, message channels, calendar channels, and message folders (Apple/YC only).

### seedConnectedAccounts (private)
`file: dev-seeder/core/utils/seed-metadata-entities.util.ts:110`
`(args: SeedMetadataEntitiesArgs) => Promise<void>`

Creates 5 connected Google accounts per workspace (one extra deletable for Jane).

### seedMessageChannels (private)
`file: dev-seeder/core/utils/seed-metadata-entities.util.ts:170`
`(args: SeedMetadataEntitiesArgs) => Promise<void>`

Creates 7 email message channels (4 user + support + sales + shared) with sync config, contact auto-creation, folder import policies.

### seedCalendarChannels (private)
`file: dev-seeder/core/utils/seed-metadata-entities.util.ts:300`
`(args: SeedMetadataEntitiesArgs) => Promise<void>`

Creates 6 calendar channels (4 user + company main + team calendar) with metadata/share visibility and sync stage.

### seedMessageFolders (private)
`file: dev-seeder/core/utils/seed-metadata-entities.util.ts:395`
`(args: SeedMetadataEntitiesArgs) => Promise<void>`

Creates 5 message folders (inbox/sent pairs for users, Jane has both) linked to channels.

## dev-seeder/core/utils/generate-random-users.util.ts

### generateRandomUsers
`file: dev-seeder/core/utils/generate-random-users.util.ts:443`
`() => { users, userWorkspaces, workspaceMembers, userIds, userWorkspaceIds, workspaceMemberIds }`

Deterministically generates 1000 random users with seeded names/emails, user-workspace mappings, and workspace member records using consistent UUID generation.

## dev-seeder/core/billing/utils/seed-billing-customers.util.ts

### seedBillingCustomers
`file: dev-seeder/core/billing/utils/seed-billing-customers.util.ts`
`(args: SeedBillingCustomersArgs) => Promise<void>`

Creates billing customer records linked to workspace.

## dev-seeder/core/billing/utils/seed-billing-subscriptions.util.ts

### seedBillingSubscriptions
`file: dev-seeder/core/billing/utils/seed-billing-subscriptions.util.ts`
`(args: SeedBillingSubscriptionsArgs) => Promise<void>`

Creates billing subscription records with pricing/metering config.

## workspace-cleaner/services/cleaner.workspace-service.ts

### computeDaysSinceSuspended
`file: workspace-cleaner/services/cleaner.workspace-service.ts:86`
`(workspace: WorkspaceEntity) => Promise<number | null>`

Calculates days elapsed since workspace suspension, returns null if never suspended.

### checkIfAtLeastOneWorkspaceMemberWarned
`file: workspace-cleaner/services/cleaner.workspace-service.ts:96`
`(workspaceMembers, workspaceId) => Promise<boolean>`

Checks if any member has deletion warning user var set.

### sendWarningEmail
`file: workspace-cleaner/services/cleaner.workspace-service.ts:115`
`(workspaceMember, workspaceDisplayName, daysSinceInactive) => Promise<void>`

Renders and sends suspension warning email with days inactive and soft-delete deadline.

### warnWorkspaceMembers
`file: workspace-cleaner/services/cleaner.workspace-service.ts:150`
`(workspace, daysSinceInactive, dryRun) => Promise<void>`

Sends warning emails to all workspace members if not previously warned, sets warning var per member.

### sendCleaningEmail
`file: workspace-cleaner/services/cleaner.workspace-service.ts:198`
`(workspaceMember, workspaceDisplayName, daysSinceInactive) => Promise<void>`

Renders and sends workspace deletion confirmation email.

### informWorkspaceMembersAndSoftDeleteWorkspace
`file: workspace-cleaner/services/cleaner.workspace-service.ts:228`
`(workspace, daysSinceInactive, dryRun) => Promise<void>`

Sends deletion emails, clears warning vars, soft-deletes workspace (sets deletedAt).

### batchCleanOnboardingWorkspaces
`file: workspace-cleaner/services/cleaner.workspace-service.ts:276`
`(workspaceIds, dryRun?) => Promise<void>`

Soft-deletes onboarding workspaces (PENDING_CREATION/ONGOING_CREATION), removes members, cancels subscriptions; hard-deletes already-soft-deleted onboarding workspaces.

### destroySoftDeletedWorkspace
`file: workspace-cleaner/services/cleaner.workspace-service.ts:348`
`(options: { workspace, ignoreGracePeriod?, dryRun? }) => Promise<WorkspaceEntity | undefined>`

Hard-deletes soft-deleted workspace if grace period passed or ignored, increments deletion metrics, returns workspace if deleted.

### batchWarnOrCleanSuspendedWorkspaces
`file: workspace-cleaner/services/cleaner.workspace-service.ts:391`
`(options: CleanSuspendedWorkspacesOptions) => Promise<void>`

Processes suspended workspaces: hard-deletes within limit, soft-deletes after threshold days, warns if approaching soft-delete; respects onlyOperation filter.

### destroyBillingDeactivatedAndSoftDeletedWorkspaces
`file: workspace-cleaner/services/cleaner.workspace-service.ts`
`(workspaceIds, dryRun) => Promise<void>`

Hard-deletes billing-deactivated and soft-deleted workspaces (no grace period).

## workspace-cleaner/commands/destroy-workspace.command.ts

### runMigrationCommand
`file: workspace-cleaner/commands/destroy-workspace.command.ts:33`
`(passedParams, options: MigrationCommandOptions) => Promise<void>`

CLI command: hard-deletes specified workspaces.

## workspace-cleaner/commands/clean-suspended-workspaces.command.ts

### fetchSuspendedWorkspaceIds
`file: workspace-cleaner/commands/clean-suspended-workspaces.command.ts:72`
`() => Promise<string[]>`

Queries suspended workspaces, filters by provided IDs if given.

### runMigrationCommand
`file: workspace-cleaner/commands/clean-suspended-workspaces.command.ts:84`
`(passedParams, options: CleanSuspendedWorkspacesCommandOptions) => Promise<void>`

CLI command: warns/soft-deletes/hard-deletes suspended workspaces with grace period/operation filtering.

## workspace-cleaner/commands/clean-onboarding-workspaces.command.ts

### runMigrationCommand
`file: workspace-cleaner/commands/clean-onboarding-workspaces.command.ts`
`(passedParams, options: MigrationCommandOptions) => Promise<void>`

CLI command: soft-deletes pending/ongoing onboarding workspaces, hard-deletes already-soft-deleted.

## workspace-cleaner/commands/clean-onboarding-workspaces.cron.command.ts

### runMigrationCommand
`file: workspace-cleaner/commands/clean-onboarding-workspaces.cron.command.ts`
`(passedParams, options: MigrationCommandOptions) => Promise<void>`

Cron variant: cleans onboarding workspaces with configurable max deletion limit.

## workspace-cleaner/commands/clean-suspended-workspaces.cron.command.ts

### runMigrationCommand
`file: workspace-cleaner/commands/clean-suspended-workspaces.cron.command.ts`
`(passedParams, options: MigrationCommandOptions) => Promise<void>`

Cron variant: cleans suspended workspaces with deletion limit config.

## workspace-cleaner/jobs/clean-workspace-deletion-warning-user-vars.job.ts

### execute
`file: workspace-cleaner/jobs/clean-workspace-deletion-warning-user-vars.job.ts`
`() => Promise<void>`

Background job: removes deletion warning user vars for all workspaces.

## workspace-version/services/workspace-version.service.ts

### hasActiveOrSuspendedWorkspaces
`file: workspace-version/services/workspace-version.service.ts:16`
`() => Promise<boolean>`

Checks if any workspace exists with ACTIVE or SUSPENDED status.

### getActiveOrSuspendedWorkspaceIds
`file: workspace-version/services/workspace-version.service.ts:27`
`(options?: { startFromWorkspaceId?, workspaceCountLimit?, queryRunner? }) => Promise<string[]>`

Fetches workspace IDs with ACTIVE/SUSPENDED status, optionally paginated by ID and limited by count.

## types/workspace-related-entity.ts

### WorkspaceRelatedEntity (abstract class)
`file: types/workspace-related-entity.ts:5`

Base class extending TypeORM entity with `workspaceId` UUID column and many-to-one relation to WorkspaceEntity, cascading delete.

## types/syncable-entity.interface.ts

### SyncableEntity (abstract class)
`file: types/syncable-entity.interface.ts:9`

Extends WorkspaceRelatedEntity: adds `universalIdentifier` and `applicationId` UUID columns, enforces unique constraint on (workspaceId, universalIdentifier), many-to-one to ApplicationEntity.

## types/overridable-entity.ts

### OverridableEntity (abstract class, generic)
`file: types/overridable-entity.ts:6`

Extends SyncableEntity: adds optional JSONB `overrides` and `isActive` boolean (default true) columns for entity-level customization.

## types/all-non-workspace-related-entity.type.ts

### AllNonWorkspaceRelatedEntity (type union)
`file: types/all-non-workspace-related-entity.type.ts:27`

Type union of 15 entities that lack direct `workspaceId` field; used for TypeScript extraction of entity relation properties.

## utils/convert-class-to-object-metadata-name.util.ts

### convertClassNameToObjectMetadataName
`file: utils/convert-class-to-object-metadata-name.util.ts:5`
`(name: string) => string`

Converts PascalCase class name to camelCase, removes 'WorkspaceEntity' suffix if present.

## utils/get-ts-vector-column-expression.util.ts

### getTsVectorColumnExpressionFromFields
`file: utils/get-ts-vector-column-expression.util.ts:20`
`(fieldsUsedForSearch: FieldTypeAndNameMetadata[]) => string`

Generates PostgreSQL tsvector expression from searchable fields: handles composite types (phones, links, emails) with special formatting, escapes identifiers, returns SQL fragment for full-text search.

### getColumnExpressionsFromField (private)
`file: utils/get-ts-vector-column-expression.util.ts:34`
`(fieldMetadataTypeAndName: FieldTypeAndNameMetadata) => string[]`

Handles composite vs scalar fields: extracts searchable subfields, applies type-specific formatting (phone international formats, email domain extraction, unaccenting).

### getColumnExpression (private)
`file: utils/get-ts-vector-column-expression.util.ts:114`
`(columnName: string, fieldType: FieldMetadataType) => string`

Generates type-specific SQL expression: EMAILS get domain split, PHONES get coalescing, UUID gets text cast, others get unaccent function.

## utils/is-searchable-subfield.util.ts

### isSearchableSubfield
`file: utils/is-searchable-subfield.util.ts:2`
`(compositeFieldMetadataType, subFieldMetadataType, subFieldName) => boolean`

Returns true if subfield is searchable: only TEXT type fields, with special rules for RICH_TEXT (only 'markdown') and PHONES (only primary phone/calling code).

## dev-seeder/data/services/timeline-activity-seeder.service.ts (class)

### TimelineActivitySeederService
`file: dev-seeder/data/services/timeline-activity-seeder.service.ts:88`

Injectable service wrapping `ensureSeeded` (above). Holds the per-entity timeline-activity definitions and the queryRunner-based insert logic.

## dev-seeder/core/utils/generate-seed-id.util.ts

### generateSeedId
`file: dev-seeder/core/utils/generate-seed-id.util.ts:3`
`(workspaceId: string, seedName: string) => string`

Deterministic UUID generator: SHA-256 hashes `${workspaceId}-${seedName}`, then formats the hex digest into a valid v4-shaped UUID (forces the version nibble to `4` and the variant bits to `8-b`). Gives stable, collision-free IDs so re-seeding is idempotent and cross-references between seed records resolve.

## dev-seeder/core/utils/seed-page-layouts.util.ts

### seedPageLayouts
`file: dev-seeder/core/utils/seed-page-layouts.util.ts:10`
`(args: { workspaceId, flatApplication, objectMetadataItems, workspaceMigrationValidateBuildAndRunService }) => Promise<void>`

Computes flat-entity seeds for page layouts, page-layout tabs, page-layout widgets, and navigation menu items (via the four `get*FlatEntitySeeds` utils), then submits them all as a single `validateBuildAndRunWorkspaceMigration` call (create-only operations keyed by metadata name: pageLayout, pageLayoutTab, pageLayoutWidget, navigationMenuItem). Drives the standard migration pipeline rather than raw inserts.

## dev-seeder/core/utils/get-page-layout-data-seeds.util.ts

### getPageLayoutFlatEntitySeeds
`file: dev-seeder/core/utils/get-page-layout-data-seeds.util.ts:7`
`(args: { workspaceId, flatApplication }) => UniversalFlatPageLayout[]`

Returns the universal flat page-layout seed records (stable IDs via `generateSeedId`, scoped to the application).

## dev-seeder/core/utils/get-page-layout-tab-data-seeds.util.ts

### getPageLayoutTabFlatEntitySeeds
`file: dev-seeder/core/utils/get-page-layout-tab-data-seeds.util.ts:9`
`(args: { workspaceId, flatApplication }) => UniversalFlatPageLayoutTab[]`

Returns the page-layout tab seeds, each referencing its parent page layout by universal identifier.

## dev-seeder/core/utils/get-page-layout-widget-data-seeds.util.ts

### getPageLayoutWidgetFlatEntitySeeds
`file: dev-seeder/core/utils/get-page-layout-widget-data-seeds.util.ts:29`
`(args: { workspaceId, flatApplication, objectMetadataItems }) => UniversalFlatPageLayoutWidget[]`

Builds widget seeds per object (uses objectMetadataItems to wire widget configuration to real object/field metadata), nested under their tabs.

### getPageLayoutWidgetDataSeeds
`file: dev-seeder/core/utils/get-page-layout-widget-data-seeds.util.ts:103`
Lower-level data table returning the raw widget seed definitions consumed by the flat-entity seed builder.

## dev-seeder/core/utils/get-page-layout-widget-data-seeds-v2.util.ts

### getPageLayoutWidgetDataSeedsV2
`file: dev-seeder/core/utils/get-page-layout-widget-data-seeds-v2.util.ts:26`
V2 widget seed definitions (newer page-layout widget schema/config shape).

## dev-seeder/core/utils/get-navigation-menu-item-data-seeds.util.ts

### getNavigationMenuItemFlatEntitySeeds
`file: dev-seeder/core/utils/get-navigation-menu-item-data-seeds.util.ts:8`
`(args: { workspaceId, flatApplication }) => UniversalFlatNavigationMenuItem[]`

Returns the navigation (sidebar) menu item seeds for the workspace, scoped to the application.

## dev-seeder/core/billing/utils/seed-billing-customers.util.ts

### seedBillingCustomers
`file: dev-seeder/core/billing/utils/seed-billing-customers.util.ts:11`
`(args: SeedBillingCustomersArgs) => Promise<void>`

Inserts one billing customer row (`workspaceId`, `stripeCustomerId: 'cus_default0'`) into the schema-qualified billing customer table via a query builder with `.orIgnore()` (idempotent).

## dev-seeder/core/billing/utils/seed-billing-subscriptions.util.ts

### seedBillingSubscriptions
`file: dev-seeder/core/billing/utils/seed-billing-subscriptions.util.ts:11`
`(args: SeedBillingSubscriptionsArgs) => Promise<void>`

Inserts one active billing subscription row (`stripeCustomerId: 'cus_default0'`, `stripeSubscriptionId: 'sub_default0'`, `status: 'active'`, `metadata: { workspaceId }`) with `.orIgnore()` for idempotency.

## workspace-cleaner/crons/clean-onboarding-workspaces.job.ts

### CleanOnboardingWorkspacesJob.handle
`file: workspace-cleaner/crons/clean-onboarding-workspaces.job.ts:27`
`() => Promise<void>`

`@Processor(MessageQueue.cronQueue)` job (decorated `@SentryCronMonitor`). Finds onboarding workspaces (`PENDING_CREATION`/`ONGOING_CREATION`) created more than 7 days ago (`withDeleted: true`), then calls `cleanerWorkspaceService.batchCleanOnboardingWorkspaces` with their IDs.

## workspace-cleaner/crons/clean-suspended-workspaces.job.ts

### CleanSuspendedWorkspacesJob.handle
`file: workspace-cleaner/crons/clean-suspended-workspaces.job.ts:27`
`() => Promise<void>`

`@Processor(MessageQueue.cronQueue)` job. Finds all `SUSPENDED` workspaces (`withDeleted: true`) and calls `cleanerWorkspaceService.batchWarnOrCleanSuspendedWorkspaces({ workspaceIds })`.

## workspace-cleaner/crons/*.cron.pattern.ts

### cleanOnboardingWorkspacesCronPattern / cleanSuspendedWorkspaceCronPattern
`file: workspace-cleaner/crons/clean-onboarding-workspaces.cron.pattern.ts:1`, `workspace-cleaner/crons/clean-suspended-workspaces.cron.pattern.ts:1`
`const = '0 * * * *'`

Both cron jobs run hourly at minute 0; the patterns are also passed to `@SentryCronMonitor` for monitoring.

## workspace-cleaner/jobs/clean-workspace-deletion-warning-user-vars.job.ts (detail)

### CleanWorkspaceDeletionWarningUserVarsJob.handle
`file: workspace-cleaner/jobs/clean-workspace-deletion-warning-user-vars.job.ts:36`
`(data: CleanWorkspaceDeletionWarningUserVarsJobData) => Promise<void>`

Request-scoped `@Processor(MessageQueue.workspaceQueue)` job. For the given workspaceId, loads the workspace and its members, then in chunks of 5 deletes each member's `USER_WORKSPACE_DELETION_WARNING_SENT_KEY` user var (so a re-suspended workspace can be warned again). Errors are caught and logged per workspace.

## workspace-cleaner/exceptions/workspace-cleaner.exception.ts

### WorkspaceCleanerException
`file: workspace-cleaner/exceptions/workspace-cleaner.exception.ts:22`

Extends `CustomException<WorkspaceCleanerExceptionCode>`. Single code `BILLING_SUBSCRIPTION_NOT_FOUND` with a lingui user-friendly message; thrown when cancelling subscriptions during cleanup finds none.

---

## NOT YET COVERED

Genuinely-trivial / data-only leftovers:
- Seed-data constant files (150+ files in `dev-seeder/data/constants` and the per-entity constants under `dev-seeder/core/constants`, `dev-seeder/metadata/custom-fields|custom-objects/constants`) — static record/field/object definitions with no function logic; the orchestrating `seed*` functions that consume them are documented above.
- `dev-seeder/data/sample-files/*` — binary/asset fixtures for attachment seeding.
- Type-only files (`*/types/*.type.ts`) — arg/shape aliases for the documented functions.
- All `*.spec.ts` test files (excluded per scope).

