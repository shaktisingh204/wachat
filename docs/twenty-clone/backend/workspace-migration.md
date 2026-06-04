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


## Runner Action Handler Infrastructure

### BaseWorkspaceMigrationRunnerActionHandlerService.execute
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface.ts:242`
`(context: WorkspaceMigrationActionRunnerArgs<TUniversalAction>) => Promise<ActionHandlerExecuteResult<TMetadataName>>`

Core abstract base every action handler extends. `execute` transpiles the universal action to a flat action (`transpileUniversalActionToFlatActionOrThrow`, wrapping errors as `WorkspaceMigrationRunnerException` with code `EXECUTION_FAILED`), then runs `executeForMetadata` (writes metadata tables) and `executeForWorkspaceSchema` (DDL against the workspace schema) **concurrently** via `Promise.allSettled` — each wrapped in a perf-timer. If either rejects it throws an aggregate `WorkspaceMigrationRunnerException` carrying `{ metadata, workspaceSchema }` reasons. On success it derives metadata events and returns `{ partialOptimisticCache, metadataEvents }`.

### BaseWorkspaceMigrationRunnerActionHandlerService.rollback
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface.ts:290`
`(context: Omit<WorkspaceMigrationActionRunnerArgs<TUniversalAction>, 'queryRunner'>) => Promise<void>`

Calls `rollbackForMetadata`; any error is caught and logged (never re-thrown) so a failing rollback cannot mask the original failure.

### BaseWorkspaceMigrationRunnerActionHandlerService (protected hooks)
- `executeForMetadata(context)` / `executeForWorkspaceSchema(context)` — default no-op `Promise.resolve()`; concrete handlers override the relevant one(s).
- `rollbackForMetadata(context)` — default no-op; overridden by handlers needing metadata rollback.
- `transpileUniversalActionToFlatAction(context)` — abstract; resolves universal identifiers/relations to concrete IDs.
- `sanitizeUniversalAction(action)` — for `update` actions, runs `sanitizeUniversalFlatEntityUpdate` on the update payload; otherwise passthrough.
- `optimisticallyApplyActionOnAllFlatEntityMaps` / `deriveMetadataEventsFromFlatAction` — switch on `flatAction.type` (create/delete/update) and delegate to the corresponding util.
- `asyncMethodPerformanceMetricWrapper({ label, method })` — wraps a method in `logger.time/timeEnd` keyed by `${actionType}_${metadataName} ${label}`.

### WorkspaceMigrationRunnerActionHandler (decorator factory)
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface.ts:325`
`(actionType, metadataName) => abstract class extends BaseWorkspaceMigrationRunnerActionHandlerService`

Mixin factory: returns an abstract subclass with `actionType`/`metadataName` fixed and attaches `WORKSPACE_MIGRATION_ACTION_HANDLER_METADATA_KEY` metadata = `buildActionHandlerKey(actionType, metadataName)` so the registry can discover it. Every concrete handler (e.g. `CreateObjectActionHandler`) extends `WorkspaceMigrationRunnerActionHandler('create', 'objectMetadata')`.

### WorkspaceMigrationRunnerActionHandlerRegistryService
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/registry/workspace-migration-runner-action-handler-registry.service.ts:20`

`OnModuleInit` service. On init, `discoverAndRegisterActionHandlers()` uses NestJS `DiscoveryService` to enumerate providers in `WorkspaceSchemaMigrationRunnerActionHandlersModule`, reads each provider's `WORKSPACE_MIGRATION_ACTION_HANDLER_METADATA_KEY` via `Reflect.getMetadata`, and stores instances in a `Map<key, handler>`. `getActionHandler(action)` looks up by `buildActionHandlerKey(action.type, action.metadataName)`, throwing `WorkspaceMigrationActionExecutionException` (code `ACTION_HANDLER_NOT_FOUND`) if missing. The runner uses this to dispatch each action.

## Runner Action Handlers (per entity, create/update/delete)

All ~100 handlers under `workspace-migration-runner/action-handlers/<entity>/services/` follow one shape. Each `@Injectable()` extends the decorator-produced base for its `(actionType, metadataName)` pair and implements `transpileUniversalActionToFlatAction` plus the relevant `executeForMetadata` / `executeForWorkspaceSchema` / `rollbackForMetadata` overrides. Examples of the meaningful (non-pure-CRUD) ones:

### CreateObjectActionHandler / DeleteObjectActionHandler / UpdateObjectActionHandler
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/object/services/`
Create writes objectMetadata rows AND issues `CREATE TABLE` in the workspace schema (via `WorkspaceSchemaManagerService`), creating columns for nested field creations and any enum types. Delete drops the table. Update handles renames/`ALTER TABLE`. They use `from-universal-flat-object-metadata-to-flat-object-metadata.util.ts` to convert universal → flat object metadata.

### CreateFieldActionHandler / UpdateFieldActionHandler / DeleteFieldActionHandler
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/field/services/`
Create adds the column(s) (composite types expand to multiple columns), creating/altering enums; update alters column type/default/nullable and renames enums; delete drops columns. Helpers: `from-universal-flat-field-metadata-to-flat-field-metadata.util.ts`, `from-universal-settings-to-flat-field-metadata-settings.util.ts`, `find-field-metadata-id-in-create-field-context.util.ts` (resolves a sibling field's just-generated ID from the in-flight create-object context).

### CreateIndexActionHandler / DeleteIndexActionHandler / UpdateIndexActionHandler
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/index/services/`
Emit `CREATE INDEX` / `DROP INDEX` SQL (incl. partial-index WHERE and unique flags). Helpers `from-universal-flat-index-to-flat-index.util.ts` and `index-action-handler.utils.ts` build the index name and column list.

### Other entity handlers (metadata-only)
View, ViewField, ViewFilter, ViewFilterGroup, ViewGroup, ViewSort, ViewFieldGroup, PageLayout, PageLayoutTab, PageLayoutWidget, Role, RoleTarget, ObjectPermission, FieldPermission, PermissionFlag, RolePermissionFlag, RowLevelPermissionPredicate(+Group), Agent, Skill, Webhook, LogicFunction, CommandMenuItem, NavigationMenuItem, FrontComponent, ApplicationVariable, ConnectionProvider — each only overrides `executeForMetadata`/`rollbackForMetadata` to insert/update/soft-delete the corresponding metadata row; no schema DDL. Several have small `from-universal-...-to-...` converter utils (e.g. page-layout-widget `from-universal-configuration-...`, `from-universal-overrides-...`; view-field `from-universal-overrides-to-view-field-overrides`; page-layout `find-page-layout-tab-id-in-create-page-layout-context`).

### WorkspaceSchemaMigrationRunnerActionHandlersModule
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/action-handlers/workspace-schema-migration-runner-action-handlers.module.ts`
Declares every action-handler service as a provider so the registry's `DiscoveryService` scan can find them.

## Runner Metadata-Event & Optimistic-Cache Utilities

### deriveMetadataEventsFromCreateAction
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/derive-metadata-events-from-create-action.util.ts:11`
`(flatAction: AllFlatWorkspaceMigrationAction<'create'>) => MetadataEvent[]`

Switches on `metadataName` to build `CreateMetadataEvent`s (type `'created'`, `properties.after` = `flatEntityToScalarFlatEntity(...)`). For `fieldMetadata` it emits an event for both the field and its `relatedFlatFieldMetadata` (relation pair). Filters the result through `METADATA_EVENTS_TO_EMIT` so only event-eligible metadata names propagate.

### deriveMetadataEventsFromUpdateAction / deriveMetadataEventsFromDeleteAction
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/derive-metadata-events-from-update-action.util.ts`, `.../derive-metadata-events-from-delete-action.util.ts`
Update builds `{ type: 'updated', properties: { before, after } }` (before = current scalar from `allFlatEntityMaps`, after = applied update); delete builds `{ type: 'deleted', properties: { before } }`. Both filter via `METADATA_EVENTS_TO_EMIT`.

### optimisticallyApplyCreateActionOnAllFlatEntityMaps
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/optimistically-apply-create-action-on-all-flat-entity-maps.util.ts`
`({ flatAction, allFlatEntityMaps }) => AllFlatEntityMaps`

Switch on metadataName; mutates the in-flight cache by calling `addFlatEntityToFlatEntityAndRelatedEntityMapsThroughMutationOrThrow` for the created entity (and the related field metadata for relation pairs). Keeps the optimistic cache consistent so later actions in the same migration validate against post-create state.

### optimisticallyApplyUpdateActionOnAllFlatEntityMaps / optimisticallyApplyDeleteActionOnAllFlatEntityMaps
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/optimistically-apply-update-action-on-all-flat-entity-maps.util.ts`, `.../optimistically-apply-delete-action-on-all-flat-entity-maps.util.ts`
Replace / remove the entity (and related entries) in the cache maps through mutation helpers.

### flatEntityToScalarFlatEntity
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/flat-entity-to-scalar-flat-entity.util.ts:8`
`<T>({ metadataName, flatEntity }) => ScalarFlatEntity<MetadataEntity<T>>`

Projects a flat entity down to its scalar (DB-column) shape using `ALL_ENTITY_PROPERTIES_CONFIGURATION_BY_METADATA_NAME[metadataName]`, then force-adds `id`, `workspaceId`, `applicationId`, `universalIdentifier`. Used to build event payloads.

## Runner SQL / Schema Utilities

### getWorkspaceSchemaContextForMigration
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/get-workspace-schema-context-for-migration.util.ts:11`
`({ workspaceId, objectMetadata }) => { schemaName, tableName }`

Returns `{ schemaName: getWorkspaceSchemaName(workspaceId), tableName: computeObjectTargetTable(objectMetadata) }` — the per-workspace Postgres schema and the table name for an object (handles custom vs standard naming).

### fieldMetadataTypeToColumnType
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/field-metadata-type-to-column-type.util.ts:9`
`<Type extends FieldMetadataType>(fieldMetadataType: Type) => string`

Maps a (scalar) field metadata type to a Postgres column type: TEXT/ARRAY/RICH_TEXT(_V2) → `text`; UUID→`uuid`; NUMERIC→`numeric`; NUMBER/POSITION→`float`; BOOLEAN→`boolean`; DATE_TIME→`timestamptz`; DATE→`date`; RATING/SELECT/MULTI_SELECT→`enum`; FILES/RAW_JSON→`jsonb`; TS_VECTOR→`tsvector`. Throws `WorkspaceMigrationActionExecutionException` (`UNSUPPORTED_FIELD_METADATA_TYPE`) otherwise. Composite types never reach here (they are flattened).

### isTextColumnType
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/is-text-column-type.util.ts:5`
`(type: FieldMetadataType) => boolean`

True for TEXT, ARRAY, and the legacy raw strings `'RICH_TEXT'` / `'RICH_TEXT_V2'` (kept for pre-1.20 workspaces not yet migrated to TEXT).

### generateColumnDefinitions / generateCompositeColumnDefinition
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/generate-column-definitions.util.ts:176`, `:32`
`generateColumnDefinitions({...}) => ColumnDefinition[]`

Builds the array of column definitions for a field. Composite fields are expanded via `generateCompositeColumnDefinition` into one column per composite property (using `computeCompositeColumnName`); scalar fields produce a single column with type from `fieldMetadataTypeToColumnType`, default value, and nullability.

### collectEnumOperationsForField / collectEnumOperationsForObject / executeBatchEnumOperations
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/workspace-schema-enum-operations.util.ts:152`, `:183`, `:204`

`collectEnumOperationsForField` returns `EnumOperationSpec[]` (CREATE/DROP/RENAME) for an enum or composite-enum field; non-enum fields return `[]`. `collectEnumOperationsForObject` flat-maps the per-field collector over all of an object's fields. `executeBatchEnumOperations` runs the specs against the workspace schema via `workspaceSchemaManagerService.enumManager` (`createEnum`/`dropEnum`/`renameEnum`), short-circuiting on an empty list and wrapping failures.

## Runner Commands, Constants, Exceptions, Types

### FlatCacheInvalidateCommand
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/commands/flat-cache-invalidate.command.ts:23`

`@Command`-decorated CLI extending `ActiveOrSuspendedWorkspaceCommandRunner`. Invalidates the flat-entity-maps cache for chosen metadata names across active/suspended workspaces. `parseMetadataName(val, previous)` accumulates `--metadata-name` options; `parseAllMetadata()` toggles all-metadata mode.

### METADATA_EVENTS_TO_EMIT
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/constants/metadata-event-to-emit.constant.ts`
Boolean map by metadata name gating which entity types emit metadata events from the runner.

### WORKSPACE_MIGRATION_ACTION_HANDLER_METADATA_KEY
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/constants/workspace-migration-action-handler-metadata-key.constant.ts`
Reflect-metadata key under which the decorator stamps each handler's action key.

### WorkspaceMigrationRunnerException / WorkspaceMigrationActionExecutionException
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/exceptions/workspace-migration-runner.exception.ts`, `.../workspace-migration-action-execution.exception.ts`
Custom exceptions with enum codes. Runner exception carries `{ action, errors, code }` (codes incl. `EXECUTION_FAILED`); action-execution exception carries `{ message, code }` (codes incl. `ACTION_HANDLER_NOT_FOUND`, `UNSUPPORTED_FIELD_METADATA_TYPE`).

### MetadataEvent / WorkspaceMigrationActionRunnerArgs (types)
file: `/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/metadata-event.ts`, `.../workspace-migration-action-runner-args.type.ts`
`MetadataEvent` is the discriminated union (`CreateMetadataEvent`/`UpdateMetadataEvent`/`DeleteMetadataEvent`). `WorkspaceMigrationActionRunnerArgs` is the per-action context (`action`, `workspaceId`, `queryRunner`, `allFlatEntityMaps`, …); `WorkspaceMigrationActionRunnerContext` adds the transpiled `flatAction`.

## Entity Migration Builder (base)

### WorkspaceEntityMigrationBuilderService.validateAndBuild
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/services/workspace-entity-migration-builder.service.ts:63`
`({ from, to, ... }) => Promise<{ failed; created; updated; deleted }>`

Generic base for all entity builders. Computes the deleted/created/updated matrix between from/to, then for each bucket calls the per-action validation path: deletions → `validateFlatEntityDeletion`; updates → `validateFlatEntityUpdate`; creations → `innerValidateFlatEntityCreation` (which first runs `validateUniversalIdentifier` + `validateUniversalIdentifierNotAlreadyInCurrentMetadataMaps`, then the abstract `validateFlatEntityCreation`). Aggregates failures vs. successful actions, wrapped in a perf timer. The three `validateFlatEntity{Creation,Deletion,Update}` methods are `abstract` and implemented by each concrete builder (e.g. `WorkspaceMigrationObjectActionsBuilderService` delegates to `FlatObjectMetadataValidatorService`). `validateUniversalIdentifier` enforces UUID validity; the not-already-in-maps check prevents duplicate creates within one migration.

### Concrete builders (object example)
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/object/workspace-migration-object-actions-builder.service.ts:13`
`WorkspaceMigrationObjectActionsBuilderService` overrides `validateFlatEntityCreation` (→ `flatObjectValidatorService.validateFlatObjectMetadataCreation`), `validateFlatEntityDeletion`, `validateFlatEntityUpdate`, each returning either a fail descriptor or a built create/update/delete action. Every other entity (field, view, role, permission, view-field/filter/group/sort, page-layout(+tab/widget), agent, skill, webhook, logic-function, command/navigation-menu-item, front-component, application-variable, connection-provider, role-target, permission-flag, role-permission-flag, row-level-permission-predicate(+group)) has an analogous `*ActionsBuilderService` under `builders/<entity>/` delegating to its validator service.

## Validators (real logic)

### FlatObjectMetadataValidatorService
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-object-metadata-validator.service.ts:18`
`validateFlatObjectMetadataCreation` (`:172`), `validateFlatObjectMetadataUpdate` (`:19`), `validateFlatObjectMetadatadeletion` (`:106`) — check name singular/plural uniqueness and validity, reserved-name collisions, label identifier presence, editability (standard objects can't be deleted/renamed), and relation-integrity before allowing the action.

### FlatFieldMetadataValidatorService
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/flat-field-metadata-validator.service.ts:24`
`validateFlatFieldMetadataCreation` (`:305`), `validateFlatFieldMetadataUpdate` (`:29`), `validateFlatFieldMetadataDeletion` (`:227`) — validate field name/type, default-value compatibility, relation settings, and that standard fields aren't illegally mutated/deleted.

### Other validator services
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/services/`
One `Flat<Entity>ValidatorService` per entity (view, view-field, view-filter(+group), view-group, view-sort, view-field-group, index, role, role-target, object-permission, field-permission, permission-flag, role-permission-flag, row-level-permission-predicate(+group), agent, skill, webhook, logic-function, command/navigation-menu-item, front-component, application-variable, connection-provider). Each exposes creation/update/deletion validators returning a `FailedFlatEntityValidation` or success.

### Validator utility functions
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/validators/utils/`
Small pure validators reused by the services:
- `validateAgentNameUniqueness`, `validateAgentRequiredProperties`, `validateAgentResponseFormat` — agent field checks.
- `validateSkillNameUniqueness`, `validateSkillLabelIsDefined`, `validateSkillContentIsDefined`, `validateSkillRequiredProperties` — skill checks.
- `validateRoleLabelUniqueness`, `validateRoleIsEditable`, `validateRoleBelongsToCallerApplication`, `validateRoleReadWritePermissionsConsistency`, `validateRoleRequiredPropertiesAreDefined` — role checks (consistency = a role can't grant write without read).
- `validateFlatRoleTargetAssignationAvailability`, `validateFlatRoleTargetTargetsOnlyOneEntity` — a role target may point at exactly one of user/agent/apiKey and that target must be assignable.
- `validateLabelIdentifierFieldMetadataIdFlatViewField` — view field's label-identifier reference must resolve.

### getEmptyFlatEntityValidationError
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/utils/get-flat-entity-validation-error.util.ts`
`({ metadataName, flatEntityMinimalInformation, type }) => FailedFlatEntityValidation`
Seeds an empty failure descriptor (`errors: []`) that validators push errors onto.

## Builder Utilities (real logic)

### serializeDefaultValue
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/utils/serialize-default-value.util.ts:28`
`({ columnType, defaultValue, schemaName, tableName, columnName }) => string`

Produces the SQL default-value fragment. `null/undefined` → `'NULL'`; function defaults (e.g. `now`/`uuid`) → `serializeFunctionDefaultValue`; literals are stripped of pre-quoting (`stripSurroundingQuotes`) then re-escaped with `escapeLiteral`; enum columns get a schema-qualified cast whose enum name is built from `removeSqlDDLInjection`-sanitized table+column (matching `computePostgresEnumName`). Uses `escapeIdentifier` for identifiers.

### buildUniversalFlatObjectFieldByNameAndJoinColumnMaps
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/utils/build-universal-flat-object-field-by-name-and-join-column-maps.util.ts:9`
Builds lookup maps (field-by-name, field-by-join-column) for an object's universal flat fields, used when resolving relations during build.

### isCompositeFieldDefaultValueCompatibleWithUniqueIndex
file: `/engine/workspace-manager/workspace-migration/workspace-migration-builder/utils/is-composite-field-default-value-compatible-with-unique-index.util.ts:9`
Returns whether a composite field's default value is safe to put under a unique index (rejects defaults that would collide).

## Universal Flat Entity Utilities (from/to computation core)

### flatEntityDeletedCreatedUpdatedMatrixDispatcher
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/universal-flat-entity-deleted-created-updated-matrix-dispatcher.util.ts:37`
`<T>({ from, to, metadataName, buildOptions }) => DeletedCreatedUpdatedMatrix<T>`

The diff engine. Builds `Map`s keyed by `universalIdentifier` for from and to. If `shouldInferDeletionFromMissingEntities` is true, entities present in `from` but absent in `to` go to `deletedFlatEntityMaps`. Entities in `to` but not `from` go to `createdFlatEntityMaps`. For entities in both, it runs `compareTwoFlatEntity` and, if a diff exists, records it in `updatedFlatEntityMaps`.

### compareTwoFlatEntity
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/compare-two-universal-flat-entity.util.ts:17`
`<T>({ fromUniversalFlatEntity, toUniversalFlatEntity, metadataName }) => UniversalFlatEntityUpdate<T> | undefined`

Reads `ALL_UNIVERSAL_FLAT_ENTITY_PROPERTIES_TO_COMPARE_AND_STRINGIFY[metadataName]` to know which props to compare directly vs. JSON-stringify, transforms both entities via `transformUniversalFlatEntityForComparison`, runs a structural `diff`, and reduces CHANGE/ADD/REMOVE differences into an update payload. Returns `undefined` when there is no difference.

### transformUniversalFlatEntityForComparison
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/transform-universal-flat-entity-for-comparison.util.ts:8`
Normalizes an entity for diffing: keeps `propertiesToCompare` as-is and JSON-stringifies `propertiesToStringify` (jsonb columns) so deep equality is decidable.

### resolveUniversalRelationIdentifiersToIds / resolveUniversalUpdateRelationIdentifiersToIds
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/resolve-universal-relation-identifiers-to-ids.util.ts:67`, `.../resolve-universal-update-relation-identifiers-to-ids.util.ts:16`
Convert universal foreign-key references (universalIdentifier of the target) into concrete DB IDs by looking up `flatEntityMaps`, honoring each relation's `isNullable`. The `Update` variant only resolves keys present in the update payload. Used by handlers when transpiling universal → flat actions.

### sanitizeUniversalFlatEntityUpdate
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/sanitize-universal-flat-entity-update.util.ts:6`
Strips/normalizes an update payload (e.g. removes non-updatable props) per metadata name before it is applied.

### Flat-entity-maps mutation helpers
file: `/engine/workspace-manager/workspace-migration/universal-flat-entity/utils/`
- `addUniversalFlatEntityToUniversalFlatEntityMapsThroughMutationOrThrow` / `...MapsOrThrow` (immutable variant) — add to byId/byUniversalIdentifier/allIds, throw on duplicate.
- `addUniversalFlatEntityToUniversalFlatEntityAndRelatedEntityMapsThroughMutationOrThrow` — also updates related-entity maps.
- `deleteUniversalFlatEntityFromUniversalFlatEntityMapsThroughMutationOrThrow` / `...AndRelatedEntityMaps...` — remove (and clean related maps), throw if missing.
- `replaceUniversalFlatEntityInUniversalFlatEntityMapsThroughMutationOrThrow` — update in place, throw if missing.
- `getUniversalFlatEntityEmptyForeignKeyAggregators` / `resetUniversalFlatEntityForeignKeyAggregators` / `deleteUniversalFlatEntityForeignKeyAggregators` — manage the FK aggregator structures used to keep reverse-relation lookups consistent during map mutation.

## Builder/Runner GraphQL & REST Exception Interceptors

### WorkspaceMigrationGraphqlApiExceptionInterceptor
file: `/engine/workspace-manager/workspace-migration/interceptors/workspace-migration-graphql-api-exception.interceptor.ts:21`
NestJS `NestInterceptor` that catches builder/runner exceptions thrown from GraphQL resolvers and routes them through the GraphQL exception handler util.

### workspaceMigrationBuilderGraphqlApiExceptionHandler / workspaceMigrationBuilderRestApiExceptionHandler
file: `/engine/workspace-manager/workspace-migration/interceptors/utils/workspace-migration-builder-graphql-api-exception-handler.util.ts:13`, `.../workspace-migration-builder-rest-api-exception-handler.util.ts:8`
Translate a `WorkspaceMigrationBuilderException`'s failure report into client-facing GraphQL/REST errors (validation details, messages).

### buildMetadataValidationErrorPayload
file: `/engine/workspace-manager/workspace-migration/interceptors/utils/build-metadata-validation-error-payload.util.ts:43`
Shapes a structured validation-error payload (per `MetadataValidationErrorResponseDescriptor`) from the builder failure report.

### workspaceMigrationRunnerExceptionFormatter
file: `/engine/workspace-manager/workspace-migration/interceptors/workspace-migration-runner-exception-formatter.ts:10`
Formats a `WorkspaceMigrationRunnerException` into a user-presentable message string.

## NOT YET COVERED

Genuinely-trivial leftovers only:
- `*.spec.ts` test files and the `utils/__tests__` directory (excluded per scope).
- Pure type-alias files under `builders/<entity>/types/*.type.ts` and `types/` (per-action discriminated-union shapes already summarized under "Migration Action Types").
- Data-only constant files (`constant/standard-object-icons.ts`, `constant/default-feature-flags.ts`, etc.) — values, no logic.

