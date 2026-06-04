# Database TypeORM Module

Core database configuration, datasources, and TypeORM migration system for the Twenty CRM backend.

## Core Services & Configuration

### DatabaseGaugeService
file: database/typeorm/database-gauge.service.ts:9

Service implementing OnModuleInit that provides observable Prometheus metrics for database health. Exposes a gauge metric `twenty_database_up` (1=up, 0=down) that periodically checks database connectivity via simple SELECT 1 query.

**Methods:**
- `onModuleInit()` (line 18): Registers the observable gauge with the metrics service on initialization.
- `isDatabaseUp()` (line 31): Executes SELECT 1 query and returns 1 if successful, 0 if database is unreachable.

### TypeORMModule
file: database/typeorm/typeorm.module.ts:11

NestJS module that configures TypeORM with the core datasource. Initializes the DataSource, installs upgrade-aware repository proxy for custom repository handling, and provides database gauges for monitoring.

**Methods:**
- Module factory imports TypeOrmModule.forRootAsync() with dataSourceFactory that creates and initializes DataSource with upgrade-aware proxy.

### Core Datasource Configuration
file: database/typeorm/core/core.datasource.ts:40

Exports typeORMCoreModuleOptions (TypeOrmModuleOptions) that configures PostgreSQL connection to core schema. Configuration includes:
- Connection string from PG_DATABASE_URL env var
- Schema set to "core" 
- Conditional entity loading (excludes billing-related entities when IS_BILLING_ENABLED is false)
- Migration loading from common and optional billing directories
- Query logging based on ORM_QUERY_LOGGING environment setting
- Connection pooling parameters (idle timeout, exit on idle)
- Optional SSL self-signed certificate support

**Functions:**
- `isRunningCommand()` (line 10): Checks if script is executing as an instance command via process.argv analysis.
- `getLoggingConfig()` (line 16): Returns TypeORM logging levels array based on NODE_ENV and ORM_QUERY_LOGGING env var. Returns no logging for tests, conditional logging for commands/server based on configuration.

**Exports:**
- `typeORMCoreModuleOptions`: TypeOrmModuleOptions object for core datasource
- `connectionSource`: DataSource instance for migrations

### Raw Datasource Configuration
file: database/typeorm/raw/raw.datasource.ts:8

Exports rawDataSource (DataSource) for direct database queries without TypeORM ORM layer. Minimal configuration with just URL, type, error logging, and optional SSL support. Used for raw SQL operations that bypass entity mappings.

## Migration Utilities

Helper functions for common migration patterns. All utilities take QueryRunner and return Promise<void>.

### Universal Identifier & Application ID Migrations

#### addWorkspaceForeignKeysQueries
file: database/typeorm/core/migrations/utils/1767002571103-addWorkspaceForeignKeys.util.ts:3

Adds/updates workspace foreign key constraints on 14 core tables (indexMetadata, roleTarget, role, fieldMetadata, objectMetadata, cronTrigger, databaseEventTrigger, routeTrigger, serverlessFunction, dataSource, objectPermission, permissionFlag, serverlessFunctionLayer, workspaceMigration) with CASCADE ON DELETE.

#### makeFieldMetadataUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1767277454048-makeFieldMetadataUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on fieldMetadata table. Drops old partial index, creates new unique index on (workspaceId, universalIdentifier), updates applicationId foreign key constraint.

#### makeObjectMetadataUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768212224801-makeObjectMetadataUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on objectMetadata table. Recreates unique index on (workspaceId, universalIdentifier) and updates foreign key constraint.

#### makeViewUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768213174271-makeViewUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on view table. Recreates unique constraint and foreign key.

#### makeViewFieldUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768213174272-makeViewFieldUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on viewField table. Recreates unique index and foreign key.

#### makeViewFilterUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768213174273-makeViewFilterUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on viewFilter table. Recreates constraints.

#### makeAgentUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768213174274-makeAgentUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on agent table. Recreates unique index on (workspaceId, universalIdentifier).

#### makeViewGroupUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768213174274-makeViewGroupUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on viewGroup table. Updates indexes and constraints.

#### makeRoleUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768213174275-makeRoleUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on role table. Recreates unique index and foreign key.

#### makeIndexMetadataUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768830235328-makeIndexMetadataUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Sets universalIdentifier and applicationId columns NOT NULL on indexMetadata table. Updates indexes and foreign key constraints.

#### makeRemainingEntitiesUniversalIdentifierAndApplicationIdNotNullableQueries
file: database/typeorm/core/migrations/utils/1768916632478-makeRemainingEntitiesUniversalIdentifierAndApplicationIdNotNullable.util.ts:3

Batch operation setting universalIdentifier and applicationId NOT NULL across 11 tables: roleTarget, rowLevelPermissionPredicate, rowLevelPermissionPredicateGroup, viewFilterGroup, viewSort, cronTrigger, databaseEventTrigger, routeTrigger, serverlessFunction, skill, pageLayoutWidget, pageLayout, pageLayoutTab. Drops old indexes, creates new ones, updates all foreign key constraints.

#### updateFileTableQueries
file: database/typeorm/core/migrations/utils/1768572831179-updateFileTable.util.ts:3

Refactors file table by dropping name, fullPath, type columns and adding applicationId (uuid), path (varchar), updatedAt (timestamp), deletedAt (timestamp), isStaticAsset (boolean, default false). Adds foreign key constraint to application table.

#### makeWebhookUniversalIdentifierAndApplicationIdNotNullQueries
file: database/typeorm/core/migrations/utils/1769525557511-makeWebhookUniversalIdentifierAndApplicationIdNotNull.util.ts:3

Sets universalIdentifier and applicationId NOT NULL on webhook table. Updates unique index and foreign key constraint.

#### makePermissionFlagUniversalIdentifierAndApplicationIdNotNullQueries
file: database/typeorm/core/migrations/utils/1773232418467-make-permission-flag-universal-identifier-and-application-id-not-null.util.ts:3

Sets universalIdentifier and applicationId NOT NULL on permissionFlag table. Creates unique index on (workspaceId, universalIdentifier) and adds foreign key to application.

#### makeObjectPermissionUniversalIdentifierAndApplicationIdNotNullQueries
file: database/typeorm/core/migrations/utils/1773317160558-make-object-permission-universal-identifier-and-application-id-not-null.util.ts:3

Sets universalIdentifier and applicationId NOT NULL on objectPermission table. Creates unique index and foreign key constraint.

#### makeFieldPermissionUniversalIdentifierAndApplicationIdNotNullQueries
file: database/typeorm/core/migrations/utils/1773400000000-make-field-permission-universal-identifier-and-application-id-not-null.util.ts:3

Sets universalIdentifier and applicationId NOT NULL on fieldPermission table. Creates unique index and foreign key constraint.

### Constraint Validation Utilities

#### makeNavigationMenuItemTypeNotNullQueries
file: database/typeorm/core/migrations/utils/1773681736596-makeNavigationMenuItemTypeNotNull.util.ts:3

Sets navigationMenuItem.type column NOT NULL and adds check constraint ensuring type-specific field coherence: FOLDER (no additional fields), OBJECT (requires targetObjectMetadataId), VIEW (requires viewId), RECORD (requires targetRecordId and targetObjectMetadataId), LINK (requires link field).

#### addPayloadCheckConstraintToCommandMenuItem
file: database/typeorm/core/migrations/utils/1775129635528-add-payload-to-command-menu-item.util.ts:3

Adds complex check constraint to commandMenuItem ensuring engineComponentKey-specific field coherence:
- TRIGGER_WORKFLOW_VERSION: requires workflowVersionId, forbids frontComponentId/payload
- FRONT_COMPONENT_RENDERER: requires frontComponentId, forbids workflowVersionId/payload
- NAVIGATION: requires payload, forbids workflowVersionId/frontComponentId
- Other keys: all three fields NULL

### Index/Unique Constraint Utilities

#### addGlobalKeyValuePairUniqueIndexQueries
file: database/typeorm/core/migrations/utils/1774700000000-add-global-key-value-pair-unique-index.util.ts:3

Drops and recreates unique index on keyValuePair table for global (system-level) key-value pairs. Index enforces single entry per key where userId and workspaceId are both NULL.

## Migration Files

### Core Metadata Initialization

#### SetupMetadataTables1700140427984 (up/down)
file: database/typeorm/core/migrations/common/1700140427984-setupMetadataTables.ts

Creates 50+ core metadata tables including: apiKey, keyValuePair, twoFactorAuthenticationMethod, userWorkspace, user, appToken, approvedAccessDomain, featureFlag, postgresCredentials, workspaceSSOIdentityProvider, dataSource, objectPermission, objectField, fieldPermission, permissionFlag, fieldMetadata, objectMetadata, relationMetadata, view, viewField, viewFilter, viewGroup, viewSort, and more. Sets up enums for types and statuses. Adds indexes for performance and uniqueness constraints.

### Application & Entity Management

#### AddApplicationEntityAndRelationships1757491357122 (up/down)
file: database/typeorm/core/migrations/common/1757491357122-addApplicationEntityAndRelationships.ts

Creates application table (id, standardId, label, description, version, sourceType, sourcePath, workspaceId, timestamps). Adds indexes and unique constraint on (standardId, workspaceId). Adds applicationId FK to agent table. Establishes parent-child relationship between applications and application-scoped entities.

#### RemoveContentFromAgentChatMessage1757991657472 (up/down)
file: database/typeorm/core/migrations/common/1757991657472-RemoveContentFromAgentChatMessage.ts

Removes rawContent column from agentChatMessage table after data migration to agentChatMessagePart table.

#### CreateAgentChatMessagePartTableAndRemoveRawContent1758767315179 (up/down)
file: database/typeorm/core/migrations/common/1758767315179-createAgentChatMessagePartTableAndRemoveRawContent.ts

Creates agentChatMessagePart table for structured message content storage. Splits message content from agentChatMessage into separate table with type and content fields.

#### RenameApplicationStandardIdToUniversalIdentifier1759341941773 (up/down)
file: database/typeorm/core/migrations/common/1759341941773-renameApplicationStandardIdToUniversalIdentifier.ts

Renames application.standardId column to universalIdentifier to align with naming convention across metadata entities.

#### RenameApplicationColumn1759433496458 (up/down)
file: database/typeorm/core/migrations/common/1759433496458-renameApplicationColumn.ts

Renames application columns for clarity and consistency (likely type/source-related columns).

#### AddPublicDomainEntity1757013851879 (up/down)
file: database/typeorm/core/migrations/common/1757013851879-addPublicDomainEntity.ts

Creates publicDomain table for managing public domain configurations and permissions in workspaces.

#### CreateEmailingDomainEntity1758388517321 (up/down)
file: database/typeorm/core/migrations/common/1758388517321-createEmailingDomainEntity.ts

Creates emailingDomain table for managing email domain configurations used in workspace email operations.

### Metadata & Search Enhancements

#### AddSearchFieldMetadataEntity1757806282417 (up/down)
file: database/typeorm/core/migrations/common/1757806282417-addSearchFieldMetadataEntity.ts

Creates searchFieldMetadata table for storing search configuration on field level with indexes for workspace and object/field metadata lookups.

#### AddWorkspaceForeignKeyToSearchFieldMetadata1757809958470 (up/down)
file: database/typeorm/core/migrations/common/1757809958470-addWorkspaceForeignKeyToSearchFieldMetadata.ts

Adds workspaceId foreign key constraint to searchFieldMetadata table with CASCADE delete.

#### UniqueFieldMetadataNameForWorkspaceObjectMetadata1756976545860 (up/down)
file: database/typeorm/core/migrations/common/1756976545860-unique-field-metadata-name-for-workspace-object-metadata.ts

Adds unique constraint on (workspaceId, objectMetadataId, name) for fieldMetadata to prevent duplicate field names per object per workspace.

#### AddUniversalIdentifierToIndexMetadata1758038863448 (up/down)
file: database/typeorm/core/migrations/common/1758038863448-add-universal-identifier-to-index-metadata.ts

Adds universalIdentifier column to indexMetadata for standardized entity identification across applications.

#### AddUniversalIdentifierToServerlessFunction1758793689363 (up/down)
file: database/typeorm/core/migrations/common/1758793689363-addUniversalIdentifierToServerlessFunction.ts

Adds universalIdentifier column to serverlessFunction table.

#### AddApplicationIdToObjectMetadata1758720905726 (up/down)
file: database/typeorm/core/migrations/common/1758720905726-addApplicationIdToObjectMetadata.ts

Adds applicationId FK to objectMetadata to establish relationship with application entity.

#### AddApplicationIdToSyncableEntities1760700501795 (up/down)
file: database/typeorm/core/migrations/common/1760700501795-addApplicationIdToSyncableEntities.ts

Adds applicationId to multiple syncable entities for application-level scoping.

### View & Layout Enhancements

#### AddCalendarTypeToViewTable1757858496548 (up/down)
file: database/typeorm/core/migrations/common/1757858496548-addCalendarTypeToViewTable.ts

Adds calendar-related type/configuration columns to view table.

#### AddCalendarFieldMetadataIdToViewTable1757864696439 (up/down)
file: database/typeorm/core/migrations/common/1757864696439-addCalendarFieldMetadataIdToViewTable.ts

Adds calendarFieldMetadataId FK to view table linking to calendar field configuration.

#### KanbanFieldMetadataIdentifierView1760965667836 (up/down)
file: database/typeorm/core/migrations/common/1760965667836-kanbanFieldMetadataIdentifierView.ts

Establishes field metadata identifier view for kanban layout rendering.

#### AddNewWidgetTypes1760628085765 (up/down)
file: database/typeorm/core/migrations/common/1760628085765-addNewWidgetTypes.ts

Adds new widget type enum values to pageLayoutWidget or related type definitions.

#### UpdatePageLayoutForRecordPageLayout1769679579382 (up/down)
file: database/typeorm/core/migrations/common/1769679579382-updatePageLayoutForRecordPageLayout.ts

Extends pageLayout table to support record-specific page layout configurations.

#### AddPageLayoutWidgetPositionColumn1770046227329 (up/down)
file: database/typeorm/core/migrations/common/1770046227329-add-page-layout-widget-position-column.ts

Adds position/order column to pageLayoutWidget for UI layout sequencing.

#### AddViewFieldGroup1770818941843 (up/down)
file: database/typeorm/core/migrations/common/1770818941843-add-view-field-group.ts

Creates viewFieldGroup table for grouping view fields in UI organization.

### Agent & AI Features

#### AddEvaluationInputsToAgent1764220000000 (up/down)
file: database/typeorm/core/migrations/common/1764220000000-add-evaluation-inputs-to-agent.ts

Adds evaluationInputs JSONB column to agent table for AI/ML evaluation configuration.

#### AddAgentTurnEvaluation1764200000000 (up/down)
file: database/typeorm/core/migrations/common/1764200000000-add-agent-turn-evaluation.ts

Creates agentTurnEvaluation table for tracking per-turn evaluation metrics in agent conversations.

#### RefactorAgentChatEntities1764100000000 (up/down)
file: database/typeorm/core/migrations/common/1764100000000-refactor-agent-chat-entities.ts

Refactors agentChat and related tables structure, likely consolidating/reorganizing chat storage.

#### AddModelCapabilitiesToAgent1759200603485 (up/down)
file: database/typeorm/core/migrations/common/1759200603485-addModelCapabilitiesToAgent.ts

Adds modelCapabilities JSONB column to agent for storing AI model configuration and feature support.

### Serverless & Workflow Functions

#### AddChecksumToServerlessFunction1758802648930 (up/down)
file: database/typeorm/core/migrations/common/1758802648930-addChecksumToServerlessFunction.ts

Adds checksum column to serverlessFunction for integrity verification of function code.

#### UpdateServerlessFunctionLayerEntity1759236947406 (up/down)
file: database/typeorm/core/migrations/common/1759236947406-updateServerlessFunctionLayerEntity.ts

Updates serverlessFunctionLayer table structure for improved layer management.

#### SetServerlessFunctionLayerNotNullable1759931071049 (up/down)
file: database/typeorm/core/migrations/common/1759931071049-setServerlessFunctionLayerNotNullable.ts

Makes serverlessFunctionLayer required field NOT NULL on serverlessFunction.

#### SetServerlessFunctionIdInTriggersNonNullable1759417994272 (up/down)
file: database/typeorm/core/migrations/common/1759417994272-setServerlessFunctionIdInTriggersNonNullable.ts

Sets serverlessFunctionId NOT NULL on trigger tables (cronTrigger, databaseEventTrigger, etc.).

### Trigger & Route Management

#### RenameRouteToRouteTrigger1759418198310 (up/down)
file: database/typeorm/core/migrations/common/1759418198310-renameRouteToRouteTrigger.ts

Renames route table/entity to routeTrigger for clarity and consistency with trigger naming.

#### AddRouterModelToWorkspace1760985484643 (up/down)
file: database/typeorm/core/migrations/common/1760985484643-AddRouterModelToWorkspace.ts

Creates router table for managing workspace routing configuration.

### Application Versioning

#### ConvertEngineComponentKeyToVarchar1774363913813 (up/down)
file: database/typeorm/core/migrations/common/1774363913813-convert-engine-component-key-to-varchar.ts

Converts engineComponentKey column from enum to varchar for flexibility in component key values.

#### AddRecordTableWidgetType1774072000000 (up/down)
file: database/typeorm/core/migrations/common/1774072000000-addRecordTableWidgetType.ts

Adds RECORD_TABLE widget type to pageLayoutWidget type enum.

#### AddApplicationPackageFields1770050100000 (up/down)
file: database/typeorm/core/migrations/common/1770050100000-addApplicationPackageFields.ts

Adds package-related metadata fields to application table.

#### AddApplicationIdAndUniversalIdentifierToPageLayouts1765200057592 (up/down)
file: database/typeorm/core/migrations/common/1765200057592-addApplicationIdAndUniversalIdentifierToPageLayouts.ts

Adds applicationId FK and universalIdentifier columns to pageLayout and related tables.

### Configuration & Management

#### AddWorkspaceEventLogRetention1770051000000 (up/down)
file: database/typeorm/core/migrations/common/1770051000000-add-workspace-event-log-retention.ts

Adds workspaceEventLogRetention configuration table for managing event log lifecycle.

#### AddWorkspaceTrashRetention1760356369619 (up/down)
file: database/typeorm/core/migrations/common/1760356369619-add-workspace-trash-retention.ts

Adds trash retention policy configuration to workspace table.

#### AddWorkspaceIdToApplicationRegistration1772267875869 (up/down)
file: database/typeorm/core/migrations/common/1772267875869-add-workspace-id-to-application-registration.ts

Adds workspaceId FK to applicationRegistration table for workspace-scoped app registration.

#### ActivateUnaccentExtension1758117800000 (up/down)
file: database/typeorm/core/migrations/common/1758117800000-activate-unaccent-extension.ts

Activates PostgreSQL unaccent extension for accent-insensitive string searching.

### Permission & Security

#### AddUniversalIdentifierAndApplicationIdToPermission1773232418467 (up/down)
file: database/typeorm/core/migrations/common/1773232418467-make-permission-flag-universal-identifier-and-application-id-not-null.ts

Updates permissionFlag table to add/enforce universalIdentifier and applicationId.

#### AddUniversalIdentifierAndApplicationIdToObjectPermission1773317160558 (up/down)
file: database/typeorm/core/migrations/common/1773317160558-add-universal-identifier-and-application-id-to-object-permission.ts

Updates objectPermission table with universalIdentifier and applicationId columns.

#### AddUniversalIdentifierAndApplicationIdToFieldPermission1773400000001 (up/down)
file: database/typeorm/core/migrations/common/1773400000001-make-field-permission-universal-identifier-and-application-id-not-null.ts

Updates fieldPermission table with universalIdentifier and applicationId.

#### SyncableRoleTarget1763896975223 (up/down)
file: database/typeorm/core/migrations/common/1763896975223-syncable-role-target.ts

Marks roleTarget as syncable with applicationId and universalIdentifier support.

### Navigation & UI

#### AddNavigationMenuItemViewForeignKey1769196250679 (up/down)
file: database/typeorm/core/migrations/common/1769196250679-addNavigationMenuItemViewForeignKey.ts

Adds viewId FK to navigationMenuItem table for linking menu items to views.

#### AddColorToObjectMetadata1773655278357 (up/down)
file: database/typeorm/core/migrations/common/1773655278357-add-color-to-object-metadata.ts

Adds color field to objectMetadata for UI customization of object display.

#### AddFallbackToCommandMenuItemAvailabilityType1772832588833 (up/down)
file: database/typeorm/core/migrations/common/1772832588833-add-fallback-to-command-menu-item-availability-type.ts

Adds FALLBACK availability type to commandMenuItem for default behavior specification.

### Billing Features

#### AddBillingCoreTables1708535112230 (up/down)
file: database/typeorm/core/migrations/billing/1708535112230-addBillingCoreTables.ts

Creates core billing infrastructure tables: billingSubscription, billingPrice, billingProductFamily, billingInvoice, billingFeature, billingUsage, etc. Establishes relationships and constraints for subscription/invoice management.

#### AddPhasesToBillingSubscription1756912860000 (up/down)
file: database/typeorm/core/migrations/billing/1756912860000-addPhasesToBillingSubscription.ts

Adds subscriptionPhase relationship to billingSubscription for managing multi-phase billing cycles.

#### RemoveTiersModeFromBillingPrice1757056320000 (up/down)
file: database/typeorm/core/migrations/billing/1757056320000-removeTiersModeFromBillingPrice.ts

Removes tierMode column from billingPrice table, simplifying pricing structure.

## Remaining Common Migrations (exhaustive, chronological)

All paths below are under `database/typeorm/core/migrations/common/`. Each migration class implements `MigrationInterface` with `up`/`down`. Effects below are derived from the migration class names + SQL; the class name equals the filename's PascalCase + timestamp.

### Application & SDK / Front-Component / Registration

#### AddApplicationVariableCoreEntity1760640844181
file: 1760640844181-addApplicationVariableCoreEntity.ts — Creates the `applicationVariable` core table for per-application config variables.

#### RenameApplicationColumn1759433496458
file: 1759433496458-renameApplicationColumn.ts — Renames an application column (type/source) for clarity.

#### AddCanBeUninstalledColumnToApplication1763731277403
file: 1763731277403-addCanBeUninstalledColumnToApplication.ts — Adds `canBeUninstalled` boolean to application.

#### RemoveCanBeAssignedToApplications1766077618558
file: 1766077618558-removeCanBeAssignedToApplications.ts — Drops the `canBeAssigned` column from applications.

#### AddApplicationRoleColumns1764923552610
file: 1764923552610-addApplicationRoleColumns.ts — Adds role-related columns to application.

#### AddWorkspaceCustomApplicationIdColumn1762343994716 / ...ForeignKey1762437814771 / ...NonNullable1763977334519
file: 1762343994716-…, 1762437814771-…, 1763977334519-… — Adds workspace.customApplicationId column, its FK, then makes it NOT NULL.

#### MakeApplicationWorkspaceFkDeferrable1762339932345
file: 1762339932345-makeApplicationWorkspaceFkDeferrable.ts — Makes the application→workspace FK DEFERRABLE.

#### AddApplicationPackageFields1770050100000
file: 1770050100000-addApplicationPackageFields.ts — Adds package metadata fields to application.

#### MakeWorkspaceAndApplicationFileFksDeferrable1770050200000
file: 1770050200000-makeWorkspaceAndApplicationFileFksDeferrable.ts — Makes file's workspace/application FKs DEFERRABLE.

#### AddIsSdkLayerStaleToApplication1773000000000
file: 1773000000000-add-is-sdk-layer-stale-to-application.ts — Adds `isSdkLayerStale` boolean to application.

#### AddSettingsCustomTabFrontComponentIdToApplication1771840510113
file: 1771840510113-add-settings-custom-tab-front-component-id-to-application.ts — Adds `settingsCustomTabFrontComponentId` FK to application.

#### AddFrontComponent1768495429374
file: 1768495429374-addFrontComponent.ts — Creates the `frontComponent` table.

#### AddFrontComponentType1768917890810
file: 1768917890810-AddFrontComponentType.ts — Adds a `type` column/enum to frontComponent.

#### AddIsHeadlessToFrontComponent1771509478665
file: 1771509478665-add-is-headless-to-front-component.ts — Adds `isHeadless` boolean to frontComponent.

#### AddFrontComponentColumns1770309316193
file: 1770309316193-add-front-component-columns.ts — Adds additional columns to frontComponent.

#### AddUsesSdkClientToFrontComponent1773100000000
file: 1773100000000-add-uses-sdk-client-to-front-component.ts — Adds `usesSdkClient` boolean to frontComponent.

#### CreateApplicationRegistration1772267875868 / AddWorkspaceIdToApplicationRegistration1772267875869
file: 1772267875868-…, 1772267875869-… — Creates `applicationRegistration` table, then adds its workspaceId FK.

#### AddAppRegistrationSourceFields1772267875870
file: 1772267875870-addAppRegistrationSourceFields.ts — Adds source fields (sourceType/sourcePath) to applicationRegistration.

#### AddIsListedToAppRegistration1772732588833
file: 1772732588833-add-is-listed-to-app-registration.ts — Adds `isListed` boolean to applicationRegistration.

#### RenameMarketplaceDisplayDataToManifest1774472400000
file: 1774472400000-rename-marketplace-display-data-to-manifest.ts — Renames `marketplaceDisplayData` column to `manifest`.

### Agent / AI Chat

#### AddModelCapabilitiesToAgent1759200603485
file: 1759200603485-addModelCapabilitesToAgent.ts — Adds `modelCapabilities` to agent.

#### RemoveDefaultAgentAndThreadAgentId1760994964826
file: 1760994964826-RemoveDefaultAgentAndThreadAgentId.ts — Drops default-agent and thread.agentId references.

#### UpdateAgentResponseFormat1763622159656
file: 1763622159656-update-agent-response-format.ts — Changes the agent responseFormat column shape.

#### ChangeAgentDescriptionToText1764672601466
file: 1764672601466-change-agent-description-to-text.ts — Changes agent.description to `text`.

#### CoreMigrationCheck1764066845539
file: 1764066845539-coreMigrationCheck.ts — Sets `agent.modelId` DEFAULT to `'default-smart-model'` (down reverts to `'auto'`); used as a baseline core-migration sentinel.

#### AddAgentIdToAgentChatMessage1764081474225
file: 1764081474225-add-agent-id-to-agent-chat-message.ts — Adds `agentId` to agentChatMessage.

#### RefactorAgentChatEntities1764100000000
file: 1764100000000-refactor-agent-chat-entities.ts — Restructures agentChat tables.

#### AddAgentTurnEvaluation1764200000000 / AddEvaluationInputsToAgent1764220000000
file: 1764200000000-…, 1764220000000-… — Creates `agentTurnEvaluation` table; adds `evaluationInputs` JSONB to agent.

#### AddSystemRoleToAgentMessage1764210000000 / AddStatusToAgentMessage1775001600000
file: 1764210000000-…, 1775001600000-… — Adds a SYSTEM role and a `status` column to agent messages.

#### AddUsageColumnsToAgentChatThread1764700000000 / AddConversationSizeToAgentChatThread1770400000000 / AddActiveStreamIdToAgentChatThread1774003611071
file: 1764700000000-…, 1770400000000-…, 1774003611071-… — Adds usage metrics, conversationSize, and activeStreamId columns to agentChatThread.

#### AddAiAdditionalInstructions1770311652940
file: 1770311652940-add-ai-additional-instructions.ts — Adds `additionalInstructions` for AI config.

#### RemoveAgentHandoffTable1763805513241
file: 1763805513241-1763805200000-RemoveAgentHandoffTable.ts — Drops the agent handoff table.

#### ReplaceFileUrlWithFileRelationInAgentMessagePart1772555830171
file: 1772555830171-replace-file-url-with-file-relation-in-agent-message-part.ts — Replaces agentChatMessagePart's file URL string with a file relation/FK.

#### AddFastAndSmartModelsToWorkspace1763997530458 / AddRouterModelToWorkspace1760985484643
file: 1763997530458-…, 1760985484643-… — Adds fastModel/smartModel and router columns to workspace.

#### MigrateModelIdsToCompositeFormat1773900000000
file: 1773900000000-migrate-model-ids-to-composite-format.ts — Data migration resetting workspace fastModel/smartModel to `'default-fast-model'`/composite placeholders resolved at runtime from admin prefs.

#### AddAiModelAvailabilityColumns1771768847449 / AddUseRecommendedModels1771840510112
file: 1771768847449-…, 1771840510112-1771768847450-… — Adds AI model availability columns and a useRecommendedModels flag.

#### SplitAiProvidersConfig1774000000000 / DropWorkspaceAiColumns1774100000000
file: 1774000000000-…, 1774100000000-… — Splits AI provider config into dedicated storage; drops legacy workspace AI columns.

#### FixAiEntityTimestampsToTimestamptz1771600000000
file: 1771600000000-fix-ai-entity-timestamps-to-timestamptz.ts — Converts AI entity timestamps to `timestamptz`.

### Serverless / Logic Functions / Triggers

#### AddUniversalIdentifierToServerlessFunction1758793689363 / AddChecksumToServerlessFunction1758802648930 / AddHandlerToServerlessFunction1761210191095 / AddBuiltHandlerPathToServerlessFunctions1769016869438 / AddToolSchemaToServerlessFunction1767364430164
file: 1758793689363-…, 1758802648930-…, 1761210191095-…, 1769016869438-…, 1767364430164-… — Add universalIdentifier, checksum, handler, builtHandlerPath, and toolSchema columns to serverlessFunction.

#### UpdateServerlessFunctionLayerEntity1759236947406 / SetServerlessFunctionLayerNotNullable1759931071049 / SetServerlessFunctionLayerIdNotNullable1761153071116 / NullableApplicationServerlessFunctionLayer1762333916255
file: 1759236947406-…, 1759931071049-…, 1761153071116-…, 1762333916255-… — Evolve serverlessFunctionLayer structure and nullability.

#### SetServerlessFunctionIdInTriggersNonNullable1759417994272
file: 1759417994272-setServerlessFunctionIdInTriggersNonNullable.ts — Makes serverlessFunctionId NOT NULL on trigger tables.

#### RenameRouteToRouteTrigger1759418198310 / AddForwardedRequestHeadersInRouteTriggers1768399525609
file: 1759418198310-…, 1768399525609-… — Renames route→routeTrigger; adds forwardedRequestHeaders to routeTrigger.

#### MigrateServerlessTriggersToServerless1769532887284 / RenameServerless1769556947746
file: 1769532887284-…, 1769556947746-… — Migrates/renames serverless trigger entities.

#### RenameHandlerPathToSourceHandlerPath1769091641000 / UpdateColumnName1769685701443
file: 1769091641000-…, 1769685701443-… — Renames handlerPath→sourceHandlerPath and another column rename.

#### UpdateLogicFunctionConstraints1769557200000 / UpdateLogicFunctionDefault1769710304101 / RemoveLogicFunctionVersion1769681396664 / AddLogicFunctionIsBuildUpToDateColumn1770725043111
file: 1769557200000-…, 1769710304101-…, 1769681396664-…, 1770725043111-… — Adjust logicFunction constraints/defaults, drop its version column, add `isBuildUpToDate`.

#### AddDependencyChecksumsToLogicFunctionLayer1770038963629 / DropLogicFunctionLayerIdFromLogicFunction1770050300000 / DropLogicFunctionLayerIdFromLogicFunction1770193825210
file: 1770038963629-…, 1770050300000-…, 1770193825210-… — Add dependency checksums to layer; drop logicFunctionLayerId from logicFunction (two passes).

#### AddSkillEntity1767003000000
file: 1767003000000-add-skill-entity.ts — Creates the `skill` table.

### View / Page Layout / Widget / Navigation / Command Menu

#### CalendarFieldMetadataRelation1761052489394
file: 1761052489394-calendarFieldMetadataRelation.ts — Establishes the calendar field metadata relation on view.

#### ViewVisibility1762351626807 / AddViewShouldHideEmptyGroups1765153412696
file: 1762351626807-…, 1765153412696-… — Adds view visibility config and `shouldHideEmptyGroups`.

#### AddMainGroupByFieldMetadataId1764680275312 / KanbanFieldMetadataIdentifierView1760965667836
file: 1764680275312-…, 1760965667836-… — Adds mainGroupByFieldMetadataId and kanban identifier view config.

#### RemoveFieldMetadataIdInViewGroup1765808791153
file: 1765808791153-remove-field-metadata-id-in-view-group.ts — Drops fieldMetadataId from viewGroup.

#### AddNewWidgetTypes1760628085765 / AddRichTextWidgetType1761215000000 / AddWorkflowWidgetTypes1761574442000 / AddFieldWidgetType1765970658815 / AddFieldsWidgetViewType1770906704231 / AddRecordTableWidgetType1774072000000
file: 1760628085765-…, 1761215000000-…, 1761574442000-…, 1765970658815-…, 1770906704231-…, 1774072000000-… — Successively extend the pageLayoutWidget type enum with new widget kinds.

#### SetPageLayoutWidgetConfigurationNotNullable1766069735219 / AddPageLayoutWidgetPositionColumn1770046227329
file: 1766069735219-…, 1770046227329-… — Makes widget configuration NOT NULL; adds a position column.

#### UpdatePageLayoutForRecordPageLayout1769679579382 / SetPageLayoutDefaultTabDeferred1769679579383
file: 1769679579382-…, 1769679579383-… — Adds record-page-layout support; makes the default-tab FK deferred.

#### AddViewFieldGroup1770818941843 / AddOverridesToViewFieldAndViewFieldGroup1773246310000
file: 1770818941843-…, 1773246310000-… — Creates viewFieldGroup; adds override columns to viewField/viewFieldGroup.

#### AddOverridesToPageLayoutTabAndWidget1772267875870
file: 1772267875870-add-overrides-to-page-layout-tab-and-widget.ts — Adds override columns to pageLayoutTab and pageLayoutWidget.

#### AddIsActiveToOverridableEntities1774966727625
file: 1774966727625-addIsActiveToOverridableEntities.ts — Adds `isActive` to overridable entities.

#### RenameRichTextToFieldRichTextAndAddStandaloneRichText1764846384501
file: 1764846384501-… — Renames RICH_TEXT widget config and adds a STANDALONE_RICH_TEXT variant.

#### AddCommandMenuItemEntity1768503887441
file: 1768503887441-addCommandMenuItemEntity.ts — Creates `commandMenuItem` table.

#### AddFrontComponentIdToCommandMenuItem1769654418252 / AddConditionalAvailabilityExpressionToCommandMenuItem1772267875870 / AddShortLabelPositionToCommandMenuItem1772643950000 / AddFallbackToCommandMenuItemAvailabilityType1772832588833 / AddEngineComponentKeyToCommandMenuItem1773311456455 / UpdateEngineComponentKeyEnum1773320963832 / AddHotkeysToCommandMenuItems1773677851495 / RemoveSaveCancelRecordPageLayoutEngineKeys1773668124779
file: 1769654418252-…, 1772267875870-add-conditional-…, 1772643950000-…, 1772832588833-…, 1773311456455-…, 1773320963832-…, 1773677851495-…, 1773668124779-… — Progressively extend commandMenuItem: frontComponentId, conditional availability expression, short-label position, FALLBACK availability type, engineComponentKey + enum updates/varchar conversion, hotkeys, and removal of save/cancel engine keys.

#### AddNavigationMenuItemEntity1768807499350 / AddNavigationMenuItemViewForeignKey1769196250679 / AddLinkAndIconToNavigationMenuItem1770699268900 / AddColorToNavigationMenuItem1771146443209 / AddIconToNavigationMenuItem1771247783542 / ChangeNavigationMenuItemPositionToDoublePrecision1771499112046 / AddTypeToNavigationMenuItem1773681736596 / MakeNavigationMenuItemTypeNotNull1773822077682
file: 1768807499350-…, 1769196250679-…, 1770699268900-…, 1771146443209-…, 1771247783542-…, 1771499112046-…, 1773681736596-…, 1773822077682-… — Create navigationMenuItem and progressively add viewId FK, link/icon/color, double-precision position, and the type column (then NOT NULL with the check constraint documented in utils above).

### File / Storage

#### RemoveMessageIdFromFileTable1759378531410 / UpdateFileTable1768572831179 / AddFileSettingsColumnOnFileTable1769434782880 / AddFileEntityUniqueConstraint1770032815802 / AddMimeTypeToFileTable1770814914548
file: 1759378531410-…, 1768572831179-…, 1769434782880-…, 1770032815802-…, 1770814914548-… — Evolve the file table: drop messageId, refactor columns (see util), add settings JSON, unique constraint, and mimeType.

### Permissions / RLS / Roles

#### AddRLS1765499361805
file: 1765499361805-addRLS.ts — Adds row-level-permission infrastructure: creates the `rowLevelPermissionPredicate_operand_enum` (IS/IS_NOT/CONTAINS/IS_RELATIVE/VECTOR_SEARCH/…) and related predicate/predicate-group tables and policies.

#### SyncableRoleTarget1763896975223 / UpdateRoleTargetsUniqueConstraint1764329720503 / RenameRoleTargets1764671363647 / UpdateRoleColumns1765206100942
file: 1763896975223-…, 1764329720503-…, 1764671363647-…, 1765206100942-… — Make roleTarget syncable, adjust its unique constraint, rename it, and update role columns.

#### AddObjectMetadataIdToRowLevelPermissionPredicateGroup1767998263185
file: 1767998263185-… — Adds objectMetadataId to rowLevelPermissionPredicateGroup.

#### Permission universalIdentifier/applicationId pairs
file: 1773232418467-add-universal-identifier-and-application-id-to-permission-flag.ts, 1773232418468-make-permission-flag-…-not-null.ts, 1773317160558-add-…-to-object-permission.ts, 1773317160559-make-object-permission-…-not-null.ts, 1773400000000-add-…-to-field-permission.ts, 1773400000001-make-field-permission-…-not-null.ts — Add then enforce NOT NULL universalIdentifier/applicationId on permissionFlag, objectPermission, fieldPermission (NOT NULL halves delegate to the documented utils).

### Object/Field Metadata & Standard IDs

#### RemoveObjectMetadataStandardId1770040351718 / DropStandardIdFromCoreEntities1770047816358
file: 1770040351718-…, 1770047816358-… — Drop the legacy `standardId` from objectMetadata and remaining core entities (superseded by universalIdentifier).

#### AddColorToObjectMetadata1773655278357
file: 1773655278357-add-color-to-object-metadata.ts — Adds `color` to objectMetadata.

#### AddApplicationIdToSyncableEntities1760700501795 / AddApplicationIdAndUniversalIdentifierToPageLayouts1764949394792 / ...1765200057592
file: 1760700501795-…, 1764949394792-…, 1765200057592-… — Add applicationId/universalIdentifier scoping to syncable entities and pageLayout (two pageLayout passes).

### Webhook

#### AddUniversalToWebhook1769517102605 / MakeWebhookUniversalIdentifierAndApplicationIdNotNull1769525557511
file: 1769517102605-…, 1769525557511-… — Add then enforce universalIdentifier/applicationId on webhook (NOT NULL half delegates to util).

### Workspace / Config / Infra

#### AddSuspendedAtColumnOnWorkspaceTable1770198374736 / AddLogoFileIdColumnOnWorkspaceTable1771323022170 / DropWorkspaceDatabaseUrlColumn1774688563000
file: 1770198374736-…, 1771323022170-…, 1774688563000-… — Add suspendedAt and logoFileId, drop legacy databaseUrl on workspace.

#### WorkspaceIdUuidNotNullable1761749599736 / FixDataSourceAndWorkspaceMigrationWorkspaceIdType1767200000000
file: 1761749599736-…, 1767200000000-… — Enforce uuid + NOT NULL on workspaceId and fix dataSource/workspaceMigration workspaceId types.

#### AddWorkspaceTrashRetention1760356369619 / AddWorkspaceEventLogRetention1770051000000
file: 1760356369619-…, 1770051000000-… — Add trash-retention and event-log-retention configuration.

#### AddSsoBypassFlag1761651107128 / EditableProfileFields1762884796640
file: 1761651107128-…, 1762884796640-… — Add SSO bypass flag and editable-profile-fields config.

#### MakeViewFilterGroupParentFkDeferrable1767100000000 / ForeignKeyIndexStandardization1768750308557
file: 1767100000000-…, 1768750308557-… — Make viewFilterGroup parent FK deferrable; standardize FK indexes across core tables.

#### RemoveRemoteTables1767812158000 / RemoveWorkspaceMigration1767876112877
file: 1767812158000-remoteRemoteTables.ts, 1767876112877-removeWorkspaceMigration.ts — Drop the remoteTable feature tables and the workspaceMigration table.

#### AddMessagingInfrastructureMetadataEntities1773945207801
file: 1773945207801-… — Creates messaging infrastructure metadata entities.

#### AddGlobalKeyValuePairUniqueIndex1774700000000
file: 1774700000000-add-global-key-value-pair-unique-index.ts — Adds the global keyValuePair unique index (delegates to util).

### Upgrade Migration tracking

#### AddUpgradeMigrationsTable1775487231605 / AddWorkspaceIdToUpgradeMigration1775553825848 / AddErrorMessageToUpgradeMigration1775649426693 / AddIsInitialToUpgradeMigration1775909335324
file: 1775487231605-…, 1775553825848-…, 1775649426693-…, 1775909335324-… — Create the `upgradeMigration` table and add workspaceId, errorMessage, and isInitial columns for tracking instance/workspace upgrade-command runs.

#### ConvertEngineComponentKeyToVarchar1774363913813 / AddPayloadToCommandMenuItem1775129635528
file: 1774363913813-…, 1775129635528-… — Convert engineComponentKey enum→varchar; add payload column + check constraint to commandMenuItem (delegates to util).

### Billing (remaining)

#### AddPhasesToBillingSubscription1756912860000 / RemoveTiersModeFromBillingPrice1757056320000
file: core/migrations/billing/1756912860000-…, 1757056320000-… — Add subscription phases; remove tierMode from billingPrice (both already summarized above; listed here for completeness).

---

## NOT YET COVERED

Only genuinely trivial leftovers remain:
- `*.spec.ts` test files and TypeORM test fixtures (none materially document runtime behavior).
- `down()` revert bodies are not individually transcribed — each migration's `down` reverses its `up` (drops the added column/table/constraint or restores the prior default), per the project's "include both up and down" rule.

