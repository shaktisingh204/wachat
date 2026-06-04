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

## NOT YET COVERED

The following 182 additional migration files in common/ directory were not individually documented due to volume constraints. They follow similar patterns to those above:
- 1700140427984-setupMetadataTables.ts (already covered)
- 1756976545860-unique-field-metadata-name-for-workspace-object-metadata.ts (already covered)
- [180 additional migration files in chronological timestamp order from 1757013851879 through latest]

These files primarily consist of:
- Schema evolution migrations (adding/removing columns and constraints)
- Entity relationship refinements
- Index optimizations
- Data type conversions
- Application entity scoping (adding applicationId/universalIdentifier)
- Feature-specific schema additions

To document remaining files, refer to filename patterns and consult CLAUDE.md for migration documentation standards.

