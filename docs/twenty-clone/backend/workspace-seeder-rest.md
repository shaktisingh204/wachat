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

---

## NOT YET COVERED

Large volumes of seed data constant files (150+ files in dev-seeder/data/constants) defining record seeds for companies, persons, opportunities, tasks, notes, messages, attachments, calendar events, etc. — these are data-only exports without function logic, documented in patterns above.

Page layout, navigation menu, and other UI seeding utility files in dev-seeder/core/utils (20+ files) — seed UI configuration via similar queryRunner patterns.

Billing seed utilities and associated constants in dev-seeder/core/billing.

Cron pattern, job scheduling, and exception handling files (4-5 files) in workspace-cleaner for scheduler integration.

All test/spec files excluded per scope.

