# Workspace Migration Backend Documentation

Comprehensive reference documenting all exported functions, NestJS services, GraphQL resolvers, commands, guards, and notable utility class methods in the workspace-migration module. Organized by file or sub-module.

## Services

### services/workspace-migration-build-orchestrator.service.ts
file: `/engine/workspace-manager/workspace-migration/services/workspace-migration-build-orchestrator.service.ts`

**WorkspaceMigrationBuildOrchestratorService** - Injectable service that orchestrates the building of workspace migrations.

- `buildWorkspaceMigration(args: WorkspaceMigrationOrchestratorBuildArgs): Promise<WorkspaceMigrationOrchestratorFailedResult | WorkspaceMigrationOrchestratorSuccessfulResult>` - Main method that validates and builds metadata migration actions for all entity types (objects, fields, views, roles, permissions, etc.). Iterates through all provided from-to flat entity maps, delegates validation to specialized builder services, performs cross-entity validation, aggregates actions into execution order, and returns either failure report with errors or successful migration with ordered actions.

- `setupOptimisticCache(args): AllUniversalFlatEntityMaps` - Private method that initializes an optimistic cache of flat entity maps from either dependency maps or by extracting the 'from' state of all from-to maps. Used to prevent unnecessary lookups during validation.

### services/workspace-migration-validate-build-and-run-service.ts
file: `/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service.ts`

**WorkspaceMigrationValidateBuildAndRunService** - Injectable service that computes flat entity maps, triggers builds, and runs migrations end-to-end.

- `validateBuildAndRunWorkspaceMigration(args: ValidateBuildAndRunWorkspaceMigrationFromMatriceArgs): Promise<WorkspaceMigrationOrchestratorFailedResult | WorkspaceMigrationOrchestratorSuccessfulResult>` - High-level entry point that accepts flat entity operations by metadata name, computes related flat entity maps and dependencies, builds the migration, and runs it. Returns status and either errors or successful migration result.

- `validateBuildAndRunWorkspaceMigrationFromTo(args: WorkspaceMigrationOrchestratorBuildArgs & {...}): Promise<...>` - Lower-level method that directly accepts pre-computed from-to flat entity maps and build options, builds and runs the migration, optionally enriches create actions with pre-generated IDs, and emits metadata events.

- `computeFromToAllFlatEntityMapsAndBuildOptions(args)` - Private method that loads all related flat entity maps from cache, computes involved application IDs (including transitive dependencies), filters maps by application IDs, computes from-to maps through mutations, and returns build options with ID mappings.

- `computeAllRelatedFlatEntityMaps(args)` - Private method that determines all metadata names and their dependencies needed for validation, loads caches for those metadata types and related metadata, and filters by application scope.

- `computeAllInvolvedApplicationIds(args)` - Private method that collects all application IDs involved in the migration by scanning flat entities and their foreign key relations, ensuring dependency applications (like twenty-standard) are included.

### services/utils/enrich-create-workspace-migration-action-with-ids.util.ts
file: `/engine/workspace-manager/workspace-migration/services/utils/enrich-create-workspace-migration-action-with-ids.util.ts`

**enrichCreateWorkspaceMigrationActionsWithIds** - Exported function that enriches create actions with pre-generated IDs.

- `enrichCreateWorkspaceMigrationActionsWithIds(args: { workspaceMigration; idByUniversalIdentifierByMetadataName }): WorkspaceMigration` - Maps over migration actions, for each create action matches its universal identifier against provided IDs by metadata name, and injects the ID into the action. Handles special cases for objectMetadata (injecting field IDs and fieldIdByUniversalIdentifier maps) and pageLayout (injecting tab IDs). Returns migration with enriched create actions.

**buildFieldIdByUniversalIdentifierForObjectAction** - Private utility that merges existing fieldIdByUniversalIdentifier from action with provided field IDs, filtering out empty results.

**buildTabIdByUniversalIdentifier** - Private utility that merges existing tabIdByUniversalIdentifier from pageLayout action with provided tab IDs.

## Workspace Migration Runner

### workspace-migration-runner/services/workspace-migration-runner.service.ts
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/services/workspace-migration-runner.service.ts`

**WorkspaceMigrationRunnerService** - Injectable service that executes workspace migrations transactionally.

- `run(args: { workspaceMigration; workspaceId }): Promise<{ allFlatEntityMaps; metadataEvents; hasSchemaMetadataChanged }>` - Main execution method that wraps migration actions in a database transaction. Loads flat entity maps for all affected metadata types and applications, iterates through actions in order delegating to action handlers via registry, maintains optimistic cache updates, commits transaction on success or rolls back with inverse actions on failure, invalidates caches, emits metadata events, and returns final flat entity maps with change indicators.

- `invalidateCache(args: { allFlatEntityMapsKeys; workspaceId }): Promise<void>` - Invalidates flat entity maps cache for modified keys and triggers dependent legacy cache invalidation (metadata version increment, GraphQL schema cache flush, role permissions cache, etc.).

- `getLegacyCacheInvalidationPromises(args)` - Private method that determines which legacy caches to invalidate based on modified flat entity map types (e.g., if objectMetadata changed, increment GraphQL schema version; if view data changed, flush view query cache).

## Workspace Migration Builder

The builder module contains specialized services for each entity type that validate and build migration actions. Each follows the same pattern:

### Builder Services (Pattern)

Each entity type has a corresponding builder service that extends `WorkspaceEntityMigrationBuilderService`:

- **WorkspaceMigrationObjectActionsBuilderService** - Validates and builds create/update/delete actions for objectMetadata
- **WorkspaceMigrationFieldActionsBuilderService** - Validates and builds create/update/delete actions for fieldMetadata
- **WorkspaceMigrationViewActionsBuilderService** - Validates and builds create/update/delete actions for views
- **WorkspaceMigrationIndexActionsBuilderService** - Validates and builds create/update/delete actions for indexes
- **WorkspaceMigrationRoleActionsBuilderService** - Validates and builds create/update/delete actions for roles
- **WorkspaceMigrationObjectPermissionActionsBuilderService** - Validates and builds create/update/delete actions for object permissions
- **WorkspaceMigrationFieldPermissionActionsBuilderService** - Validates and builds create/update/delete actions for field permissions
- **WorkspaceMigrationPageLayoutActionsBuilderService** - Validates and builds create/update/delete actions for page layouts
- **WorkspaceMigrationViewFieldActionsBuilderService** - Validates and builds create/update/delete actions for view fields
- **WorkspaceMigrationViewFilterActionsBuilderService** - Validates and builds create/update/delete actions for view filters
- **WorkspaceMigrationViewGroupActionsBuilderService** - Validates and builds create/update/delete actions for view groups
- **WorkspaceMigrationLogicFunctionActionsBuilderService** - Validates and builds create/update/delete actions for logic functions
- **WorkspaceMigrationAgentActionsBuilderService** - Validates and builds create/update/delete actions for agents
- **WorkspaceMigrationSkillActionsBuilderService** - Validates and builds create/update/delete actions for skills
- **WorkspaceMigrationWebhookActionsBuilderService** - Validates and builds create/update/delete actions for webhooks

All builder services implement:
- `validateAndBuild(args: UniversalFlatEntityValidationArgs): Promise<UniversalFlatEntityValidationReturnType>` - Validates creation/update/deletion of flat entities using type-specific validators, returns either fail with error list or success with action.
- `validateFlatEntityCreation(args)` - Protected method that delegates to validator and builds create action.
- `validateFlatEntityDeletion(args)` - Protected method that delegates to validator and builds delete action.
- `validateFlatEntityUpdate(args)` - Protected method that delegates to validator and builds update action.

### workspace-migration-builder/services/workspace-entity-migration-builder.service.ts
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/services/workspace-entity-migration-builder.service.ts`

**WorkspaceEntityMigrationBuilderService<T extends AllMetadataName>** - Generic injectable service that provides base validation and build logic for entity-specific builder services. Orchestrates comparison of from-to flat entities, identifies creations/updates/deletions, delegates type-specific validation, and aggregates actions.

## Utilities

### Cross-Entity Validation

#### utils/cross-entity-transversal-validation.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/cross-entity-transversal-validation.util.ts`

- `crossEntityTransversalValidation(args: { optimisticUniversalFlatMaps; orchestratorActionsReport; preDeletionFlatViewFieldMaps }): OrchestratorFailureReport` - Validates relationships across entities in the migration. Calls objectMetadata validator to check for cross-entity violations, validates view field label identifiers are unique, and validates universal identifiers are unique across all entities. Returns failure report with any cross-entity errors found.

### Orchestrator Actions Aggregation

#### utils/aggregate-orchestrator-actions-report.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/aggregate-orchestrator-actions-report.util.ts`

- `aggregateOrchestratorActionsReport(args: { orchestratorActionsReport; flatFieldMetadataMaps }): { aggregatedOrchestratorActionsReport }` - Post-processes actions after initial build by applying aggregation strategies: aggregates non-relation fields into object actions, aggregates relation field pairs, and deprioritizes search vector update actions. Returns aggregated report ready for execution.

#### utils/aggregate-non-relation-fields-into-object-actions.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/aggregate-non-relation-fields-into-object-actions.util.ts`

- `aggregateNonRelationFieldsIntoObjectActions(args)` - Merges field creation/update/deletion actions into parent object actions when the object is being created/updated, eliminating redundant separate field actions.

#### utils/aggregate-relation-field-pairs.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/aggregate-relation-field-pairs.util.ts`

- `aggregateRelationFieldPairs(args)` - Processes relation field pairs (one-to-many and many-to-many) to ensure consistent handling of bidirectional relationships. Handles deletion, creation, and update of paired relation fields.

### Flat Entity Maps Computation

#### utils/compute-universal-flat-entity-maps-from-to-through-mutation.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/compute-universal-flat-entity-maps-from-to-through-mutation.util.ts`

- `computeUniversalFlatEntityMapsFromToThroughMutation<T extends AllMetadataName>(args: { flatEntityMaps; flatEntityToCreate; flatEntityToDelete; flatEntityToUpdate }): { from; to }` - Computes from-to flat entity maps by cloning the initial maps, applying deletions, then updates, then creations. Returns both from (initial subset) and to (modified subset) maps for comparison during validation.

### Flat Entity Maps Mutation

#### universal-flat-entity/utils/add-universal-flat-entity-to-universal-flat-entity-maps-through-mutation-or-throw.util.ts
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/add-universal-flat-entity-to-universal-flat-entity-maps-through-mutation-or-throw.util.ts`

- `addUniversalFlatEntityToUniversalFlatEntityMapsThroughMutationOrThrow<T extends AllMetadataName>(args: { universalFlatEntity; universalFlatEntityMapsToMutate }): void` - Mutates flat entity maps in-place to add a new entity. Adds entity to byId, byUniversalIdentifier, and allIds maps. Throws if entity with same universal identifier already exists.

#### universal-flat-entity/utils/delete-universal-flat-entity-from-universal-flat-entity-maps-through-mutation-or-throw.util.ts
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/delete-universal-flat-entity-from-universal-flat-entity-maps-through-mutation-or-throw.util.ts`

- `deleteUniversalFlatEntityFromUniversalFlatEntityMapsThroughMutationOrThrow<T extends AllMetadataName>(args: { universalIdentifierToDelete; universalFlatEntityMapsToMutate }): void` - Mutates flat entity maps in-place to remove an entity. Removes from byId, byUniversalIdentifier, and allIds maps. Throws if entity not found.

#### universal-flat-entity/utils/replace-universal-flat-entity-in-universal-flat-entity-maps-through-mutation-or-throw.util.ts
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/replace-universal-flat-entity-in-universal-flat-entity-maps-through-mutation-or-throw.util.ts`

- `replaceUniversalFlatEntityInUniversalFlatEntityMapsThroughMutationOrThrow<T extends AllMetadataName>(args: { universalFlatEntity; universalFlatEntityMapsToMutate }): void` - Mutates flat entity maps in-place to update an entity. Updates byId and byUniversalIdentifier maps with new entity data. Throws if entity not found.

### Validation Utilities

#### utils/validate-universal-identifier-cross-entity-uniqueness-through-report-mutation.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/validate-universal-identifier-cross-entity-uniqueness-through-report-mutation.util.ts`

- `validateUniversalIdentifierCrossEntityUniquenessThroughReportMutation(args: { optimisticUniversalFlatMaps; orchestratorActionsReport; orchestratorFailureReport }): void` - Validates that universal identifiers are globally unique across all entity types and applications. Scans all create actions to ensure no duplicates exist in optimistic maps or other create actions. Mutates failure report with any uniqueness violations found.

#### utils/should-infer-deletion-from-missing-entities.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/should-infer-deletion-from-missing-entities.util.ts`

- `shouldInferDeletionFromMissingEntities(args: { inferDeletionFromMissingEntities }): boolean` - Determines if entities missing from the target state should be treated as deletions based on configuration flags.

#### utils/validate-index-where-clause.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/validate-index-where-clause.util.ts`

- `validateIndexWhereClause(args: { whereClause }): void` - Validates SQL WHERE clause syntax used in index definitions. Throws on invalid syntax.

### Identification and Aggregation

#### utils/build-all-universal-identifier-map.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/build-all-universal-identifier-map.util.ts`

- `buildAllUniversalIdentifierMap(args: { optimisticUniversalFlatMaps }): AllUniversalIdentifierMap` - Builds a map of all universal identifiers to their owners (entity type, application, etc.) from optimistic flat entity maps. Used for uniqueness validation and reference resolution.

### Miscellaneous Utilities

#### utils/compute-postgres-enum-name.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/compute-postgres-enum-name.util.ts`

- `computePostgresEnumName(args: { objectNameSingular; fieldName }): string` - Generates PostgreSQL enum type name from object and field names following naming conventions.

#### utils/convert-on-delete-action-to-on-delete.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/convert-on-delete-action-to-on-delete.util.ts`

- `convertOnDeleteActionToOnDelete(args: { onDeleteAction }): string` - Converts application-level on-delete action enum to PostgreSQL ON DELETE clause syntax (CASCADE, SET NULL, RESTRICT, etc.).

#### utils/remove-sql-injection.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/remove-sql-injection.util.ts`

- `removeSqlInjection(args: { value }): string` - Sanitizes string input to prevent SQL injection by escaping or removing dangerous characters.

#### utils/merge-orchestrator-failure-reports.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/merge-orchestrator-failure-reports.util.ts`

- `mergeOrchestratorFailureReports(args: { target; source }): void` - Merges failure reports from multiple sources into a single report for aggregated error collection. Mutates target report in-place.

#### utils/topologically-sort-universal-flat-entities-for-self-referential-fks.util.ts
file: `/engine/workspace-manager/workspace-migration/utils/topologically-sort-universal-flat-entities-for-self-referential-fks.util.ts`

- `topologicallySortUniversalFlatEntitiesForSelfReferentialFks<T extends AllMetadataName>(args: { universalFlatEntities }): T[]` - Topologically sorts entities to handle self-referential foreign keys. Ensures parent entities are processed before child references.

## Workspace Migration Runner Action Handlers

The runner delegates action execution to specialized handler services. Located in workspace-migration-runner/action-handlers/:

### Create Action Handlers
Each entity type has a corresponding create handler:
- **CreateObjectActionHandler** - Creates object metadata in database, updates caches
- **CreateFieldActionHandler** - Creates field on object, updates field caches
- **CreateViewActionHandler** - Creates view record, updates view caches
- **CreateIndexActionHandler** - Creates database index via SQL
- **CreateRoleActionHandler** - Creates role record, updates role caches
- **CreateObjectPermissionActionHandler** - Creates object permission record
- **CreateFieldPermissionActionHandler** - Creates field permission record
- **CreatePageLayoutActionHandler** - Creates page layout record
- **CreateWebhookActionHandler** - Creates webhook record
- Similar handlers for: ViewField, ViewFilter, ViewGroup, LogicFunction, Agent, Skill, PageLayoutTab, PageLayoutWidget, CommandMenuItem, NavigationMenuItem, FrontComponent, ApplicationVariable, ConnectionProvider

All create handlers implement:
- `executeActionHandler(args: ActionHandlerContext): Promise<{ partialOptimisticCache; metadataEvents }>` - Executes the create action by writing to database, updates optimistic cache with new entity, and emits metadata events.

### Update Action Handlers
Similar set of update handlers for each entity type that patch existing records and update caches.

### Delete Action Handlers
Similar set of delete handlers for each entity type that soft-delete or hard-delete records and clean up related data.

### Rollback Handlers
Corresponding rollback handlers exist for each action type to undo changes in case of transaction failure.

## Validators

The workspace-migration-builder module contains specialized validators for each entity type:

### workspace-migration-builder/validators/services/

- **FlatObjectMetadataValidatorService** - Validates object metadata creation, updates, and deletion
- **FlatFieldMetadataValidatorService** - Validates field metadata creation, updates, and deletion
- **FlatViewValidatorService** - Validates view creation, updates, and deletion
- **FlatIndexValidatorService** - Validates index creation and deletion
- **FlatRoleValidatorService** - Validates role creation, updates, and deletion
- **FlatObjectPermissionValidatorService** - Validates object permission creation and deletion
- **FlatFieldPermissionValidatorService** - Validates field permission creation and deletion

Each validator provides:
- `validateFlatXyzCreation(args: UniversalFlatEntityValidationArgs): ValidationResult` - Validates entity can be created with given properties
- `validateFlatXyzUpdate(args: FlatEntityUpdateValidationArgs): ValidationResult` - Validates update is valid
- `validateFlatXyzDeletion(args: UniversalFlatEntityValidationArgs): ValidationResult` - Validates entity can be safely deleted

## Exceptions and Filters

### exceptions/workspace-migration-builder-exception.ts
file: `/engine/workspace-manager/workspace-migration/exceptions/workspace-migration-builder-exception.ts`

**WorkspaceMigrationBuilderException** - Error class for builder failures containing the failed build result details.

### filters/workspace-migration-runner-rest-api-exception.filter.ts
file: `/engine/workspace-manager/workspace-migration/filters/workspace-migration-runner-rest-api-exception.filter.ts`

**WorkspaceMigrationRunnerRestApiExceptionFilter** - NestJS ExceptionFilter that catches workspace migration runner exceptions and returns formatted REST API error responses.

### interceptors/workspace-migration-builder-graphql-api-exception-handler.util.ts
file: `/engine/workspace-manager/workspace-migration/interceptors/utils/workspace-migration-builder-graphql-api-exception-handler.util.ts`

- `workspaceMigrationBuilderGraphqlApiExceptionHandler(args: { error; logger }): void` - Handles and logs builder exceptions for GraphQL API responses. Formats error messages and validation details for client consumption.

## Types and Constants

### Universal Flat Entity Types

The universal-flat-entity/types/ directory defines entity representation types:

- **UniversalFlatEntity<T, N extends AllMetadataName>** - Base flat entity type mapping database entity to universal representation
- **UniversalFlatObjectMetadata** - Object metadata in universal flat format
- **UniversalFlatFieldMetadata** - Field metadata in universal flat format
- **UniversalFlatView** - View in universal flat format
- **UniversalFlatRole** - Role in universal flat format
- Similar types for all other metadata entities

- **UniversalFlatEntityMaps<T>** - Map containers holding byId, byUniversalIdentifier, allIds for an entity type
- **AllUniversalFlatEntityMaps** - Union of all entity type maps

### Migration Action Types

Types representing the actions generated during build:

- **UniversalCreateObjectAction** - Action to create object with nested field creations
- **UniversalUpdateObjectAction** - Action to update object properties
- **UniversalDeleteObjectAction** - Action to delete object
- Similar universal action types for: Field, View, Index, Role, Permissions, ViewFields, Filters, Groups, LogicFunctions, Agents, Skills, PageLayouts, Webhooks, etc.

- **WorkspaceMigration** - Container with ordered list of migration actions for application

### Orchestrator Types

- **WorkspaceMigrationOrchestratorBuildArgs** - Input arguments to build orchestrator
- **OrchestratorActionsReport** - Structured collection of all built actions by type
- **OrchestratorFailureReport** - Structured collection of all validation errors by entity type
- **WorkspaceMigrationOrchestratorSuccessfulResult** - Build success with migration and actions
- **WorkspaceMigrationOrchestratorFailedResult** - Build failure with error report

### Constants

#### constant/empty-orchestrator-actions-report.constant.ts
- `createEmptyOrchestratorActionsReport()` - Returns empty OrchestratorActionsReport structure

#### constant/empty-orchestrator-failure-report.constant.ts
- `EMPTY_ORCHESTRATOR_FAILURE_REPORT()` - Returns empty OrchestratorFailureReport structure

#### constant/default-feature-flags.ts
- `DEFAULT_FEATURE_FLAGS` - Default feature flag values for migrations

#### constant/standard-object-icons.ts
- Standard icon mappings for common object types

#### constant/workspace-migration-additional-cache-data-maps-key.constant.ts
- `WORKSPACE_MIGRATION_ADDITIONAL_CACHE_DATA_MAPS_KEY` - Cache keys needed during migration building

## Key Workflows

### Building a Migration

1. **Validate & Build** (WorkspaceMigrationValidateBuildAndRunService)
   - Input: Entity operations (create/update/delete) by metadata name
   - Load all related flat entity maps from cache
   - Compute from-to entity maps by applying operations
   - Call orchestrator to build actions

2. **Build Orchestration** (WorkspaceMigrationBuildOrchestratorService)
   - For each entity type, delegate to specialized builder
   - Each builder validates and generates create/update/delete actions
   - Aggregate actions into optimal execution order
   - Perform cross-entity validation
   - Return ordered actions or errors

3. **Running a Migration** (WorkspaceMigrationRunnerService)
   - Start database transaction
   - For each action, execute handler via registry
   - Update optimistic cache after each action
   - On success: commit, invalidate caches, emit events
   - On failure: rollback, apply inverse actions, invalidate caches

### Entity Types Supported

- **Metadata**: Objects, Fields, Indexes
- **Views**: View definitions, View Fields, Filters, Filter Groups, Groups, Sorts, Field Groups
- **Access Control**: Roles, Role Targets, Object Permissions, Field Permissions, Permission Flags, Role Permission Flags, Row-Level Permission Predicates
- **Configuration**: Logic Functions, Page Layouts, Page Layout Tabs, Widgets
- **Integrations**: Webhooks, Agents, Skills, Front Components
- **Advanced**: Command Menu Items, Navigation Menu Items, Application Variables, Connection Providers


## NOT YET COVERED

Due to the extensive scope of this module (358 TypeScript files), the following categories are documented at a module level but individual function signatures require further detailed reading:

**Files not yet fully detailed (by count)**:
- workspace-migration-runner/action-handlers/*: ~100 handler files (create/update/delete/rollback handlers for each entity type) - documented as patterns
- workspace-migration-builder/builders/*: ~30 builder service files - documented with shared interface
- workspace-migration-runner/commands/*: Instance commands for migrations - documented as module
- workspace-migration-builder/validators/*: ~15 validator services - documented by pattern
- workspace-migration-builder/utils/*: ~20 utility files - many documented, some remaining
- workspace-migration-runner/utils/*: ~15 utility files - similar to builder utils
- Type definition files (*.type.ts): ~40 files - documented as type groupings
- Constant and configuration files: ~10 files

**Major documented components** (~50-60 exported functions/classes):
- 3 core services with ~15 methods
- 30+ builder services (documented by pattern)
- 25+ action handlers (documented by pattern)
- 15+ utility functions
- 10+ validators (documented by pattern)
- Exception handlers and filters

The documentation covers the critical entry points, orchestration patterns, and utility logic. Individual action handler implementations follow consistent patterns documented in the ActionHandler and Rollback sections.

