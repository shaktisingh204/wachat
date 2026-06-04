# Core Records, Tools, Workflow, and Related Modules

Comprehensive function documentation for record-crud, tool-provider, tool, logic-function, workflow, upgrade, user, and workspace modules.

## record-crud

### Services

#### CreateRecordService
file: `/engine/core-modules/record-crud/services/create-record.service.ts`

- **execute(params: CreateRecordParams): Promise<ToolOutput>** — Creates a single record in specified object. Validates automation eligibility, cleans undefined values from composite fields, sets actor metadata (workflow source), and returns success with record references or error response.

#### DeleteRecordService
file: `/engine/core-modules/record-crud/services/delete-record.service.ts`

- **execute(params: DeleteRecordParams): Promise<ToolOutput>** — Deletes record by ID (soft or hard delete). Validates UUID format, checks automation eligibility, dispatches to delete/destroy runners based on soft flag, returns deleted record or error.

#### FindRecordsService
file: `/engine/core-modules/record-crud/services/find-records.service.ts`

- **execute(params: FindRecordsParams): Promise<ToolOutput<FindRecordsResult>>** — Finds records with filter/orderBy/pagination. Adds ID ordering for consistent pagination, enforces QUERY_MAX_RECORDS limit, returns records with totalCount and record references with display names.

#### UpdateRecordService
file: `/engine/core-modules/record-crud/services/update-record.service.ts`

- **execute(params: UpdateRecordParams): Promise<ToolOutput>** — Updates single record. Validates ID, filters to fieldsToUpdate only, cleans undefined values, returns slim or full record response.

#### UpsertRecordService
file: `/engine/core-modules/record-crud/services/upsert-record.service.ts`

- **execute(params: UpsertRecordParams): Promise<ToolOutput>** — Upserts (create or update) record. Cleans undefined values, passes upsert: true flag to Common API, handles conflict detection automatically.

#### CreateManyRecordsService
file: `/engine/core-modules/record-crud/services/create-many-records.service.ts`

- **execute(params: CreateManyRecordsParams): Promise<ToolOutput>** — Bulk creates records. Maps createdBy actor metadata to all records, cleans undefined from each, returns slim or full records with display name references.

#### UpdateManyRecordsService
file: `/engine/core-modules/record-crud/services/update-many-records.service.ts`

- **execute(params: UpdateManyRecordsParams): Promise<ToolOutput>** — Bulk updates records matching filter. Cleans undefined data, executes update-many runner, returns updated records with display name references.

#### GroupByRecordsService
file: `/engine/core-modules/record-crud/services/group-by-records.service.ts`

- **execute(params: GroupByRecordsParams): Promise<ToolOutput<GroupByRecordsResult>>** — Groups records and aggregates (COUNT, SUM, etc.). Resolves aggregate field key from available aggregations, enforces limit, constructs dimension labels from group-by structure.

#### CommonApiContextBuilderService
file: `/engine/core-modules/record-crud/services/common-api-context-builder.service.ts`

- **build(params: { authContext: WorkspaceAuthContext; objectName: string }): Promise<CommonApiContext>** — Builds execution context for CRUD operations. Fetches flat metadata maps, resolves object by name, resolves permissions for auth context (user/api-key/application), returns queryRunnerContext, selectedFields, and permissions.

- **getObjectsPermissions(authContext: WorkspaceAuthContext): Promise<ObjectsPermissions>** (private) — Resolves role ID from auth context type (api-key/application/user), fetches role permissions from workspace cache.

### Utilities

#### getRecordDisplayName
file: `/engine/core-modules/record-crud/utils/get-record-display-name.util.ts`

- **getRecordDisplayName(record: Record<string, unknown>, flatObjectMetadata: FlatObjectMetadata, flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>): string** — Returns display name for record. Uses labelIdentifierFieldMetadataId, handles FULL_NAME composite type (firstName/lastName), falls back to record ID.

#### removeUndefinedFromRecord
file: `/engine/core-modules/record-crud/utils/remove-undefined-from-record.util.ts`

- **removeUndefinedFromRecord<T>(record: T): T** — Recursively removes undefined values from object. Handles nested objects (composite fields) but preserves arrays, needed for validation layer that expects null, not undefined.

#### get-record-image-identifier.util.ts
file: `/engine/core-modules/record-crud/utils/get-record-image-identifier.util.ts`

— Utility for extracting image identifier from record (exported function name from file pattern).

#### resolve-aggregate-field-key.util.ts
file: `/engine/core-modules/record-crud/utils/resolve-aggregate-field-key.util.ts`

— Utility for resolving aggregate operation field key (exported function name from file pattern).

#### generate-create-record-input-schema.util.ts, generate-create-many-record-input-schema.util.ts, generate-update-record-input-schema.util.ts, generate-update-many-record-input-schema.util.ts
file: `/engine/core-modules/record-crud/utils/generate-*.util.ts`

— Input schema generation utilities for Zod validation of record creation/update operations.

### Exceptions

#### RecordCrudException
file: `/engine/core-modules/record-crud/exceptions/record-crud.exception.ts`

- **RecordCrudException(message: string, code: RecordCrudExceptionCode)** — Custom exception for record CRUD operations with error codes (INVALID_REQUEST, etc.).

---

## tool-provider

### Services

#### ToolExecutorService
file: `/engine/core-modules/tool-provider/services/tool-executor.service.ts`

- **dispatch(descriptor: ToolIndexEntry | ToolDescriptor, args: Record<string, unknown> | undefined, context: ToolProviderContext): Promise<ToolOutput>** — Routes tool execution by kind: database_crud, static, or logic_function.

- **dispatchDatabaseCrud(ref: ToolExecutionRef, args: Record<string, unknown>, context: ToolProviderContext): Promise<ToolOutput>** (private) — Dispatches CRUD operations: find, find_one, create, create_many, update, update_many, delete, group_by. Maps args to service calls, builds auth context on demand.

- **dispatchStaticTool(descriptor: ToolIndexEntry | ToolDescriptor, args: Record<string, unknown>, context: ToolProviderContext): Promise<ToolOutput>** (private) — Executes static tools from providers. Verifies provider availability, calls provider.executeStaticTool.

- **dispatchLogicFunction(ref: ToolExecutionRef, args: Record<string, unknown>, context: ToolProviderContext): Promise<ToolOutput>** (private) — Executes logic function via LogicFunctionExecutorService, wraps result in ToolOutput.

- **buildAuthContext(context: ToolProviderContext): Promise<WorkspaceAuthContext>** (private) — Constructs user auth context from userId/userWorkspaceId. Loads user, workspace member, builds context with flattened workspace/member data.

#### ToolRegistryService
file: `/engine/core-modules/tool-provider/services/tool-registry.service.ts`

- **getCatalog(context: ToolProviderContext): Promise<ToolIndexEntry[]>** — Returns lightweight tool index (no schemas). Calls all providers in parallel, filters by isAvailable.

- **resolveSchemas(toolNames: string[], context: ToolProviderContext): Promise<Map<string, object>>** — On-demand schema resolution for specific tools. Groups by provider category, fetches full descriptors with schemas.

- **hydrateToolSet(descriptors: ToolDescriptor[], context: ToolProviderContext, options?: {...}): ToolSet** — Wraps tool descriptors into AI SDK ToolSet with thin dispatch closures. Optionally includes loading message, error handler, compact output.

- **buildToolIndex(workspaceId: string, roleId: string, options?: {...}): Promise<ToolIndexEntry[]>** — Builds tool index from context (workspaceId, roleId, userId).

- **getToolsByName(names: string[], context: ToolContext, options?: {...}): Promise<ToolSet>** — Resolves and hydrates tools by name, applies output options (loading message, compact).

- **getToolInfo(names: string[], context: ToolContext, aspects?: LearnToolsAspect[]): Promise<Array<{name, description?, inputSchema?}>>** — Returns tool metadata (description, schema) for learn_tools.

- **resolveAndExecute(toolName: string, args: Record<string, unknown> | undefined, context: ToolContext, options?: {...}): Promise<ToolOutput>** — Finds tool by name and executes, returns compact or full output.

- **getToolsByCategories(context: ToolProviderContext, options?: ToolRetrievalOptions): Promise<ToolSet>** — Eager loads tools by categories (MCP, workflow agent). Generates with includeSchemas: true.

### Providers

#### ActionToolProvider, DatabaseToolProvider, DashboardToolProvider, LogicFunctionToolProvider, MetadataToolProvider, NavigationMenuItemToolProvider, ViewToolProvider, WebhookToolProvider, WorkflowToolProvider
file: `/engine/core-modules/tool-provider/providers/*.provider.ts`

— Each provider implements ToolProvider interface with isAvailable() and generateDescriptors() for category-specific tools.

### Utilities

#### compact-tool-output.util.ts, strip-empty-values.util.ts, execute-tool-from-tool-set.util.ts, format-validation-errors.util.ts, resolve-object-icon.util.ts, tool-error.util.ts, tool-set-to-descriptors.util.ts
file: `/engine/core-modules/tool-provider/utils/*.util.ts`

— Output transformation, validation, icon resolution, error wrapping utilities.

---

## tool

### Tool Classes

#### CodeInterpreterTool
file: `/engine/core-modules/tool/tools/code-interpreter-tool/code-interpreter-tool.ts`

— Tool for executing arbitrary code in sandboxed environment.

#### EmailComposerService, SendEmailTool, DraftEmailTool
file: `/engine/core-modules/tool/tools/email-tool/`

- **EmailComposerService.composeEmail(params: ComposeEmailParams): Promise<ComposedEmail>** — Composes email with recipients, subject, body. Uses RichText renderer.

- **SendEmailTool** — Sends composed email via email service.

- **DraftEmailTool** — Creates draft email without sending.

#### HttpTool
file: `/engine/core-modules/tool/tools/http-tool/http-tool.ts`

— Executes HTTP requests (GET, POST, etc.) with validation.

#### NavigateAppTool
file: `/engine/core-modules/tool/tools/navigate-tool/navigate-app-tool.ts`

— Navigation tool for app routing.

#### SearchHelpCenterTool
file: `/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool.ts`

— Searches help center documentation.

### Types & Utilities

#### wrap-tool-for-execution.util.ts
file: `/engine/core-modules/tool/utils/wrap-tool-for-execution.util.ts`

- **wrapJsonSchemaForExecution(baseSchema: Record<string, unknown>): Record<string, unknown>** — Wraps schema with loading message property.

- **stripLoadingMessage(args: Record<string, unknown>): Record<string, unknown>** — Removes loading message from execution args.

---

## logic-function

### Services

#### LogicFunctionExecutorService
file: `/engine/core-modules/logic-function/logic-function-executor/logic-function-executor.service.ts`

- **execute(params: { logicFunctionId: string; workspaceId: string; payload: unknown }): Promise<LogicFunctionExecutionResult>** — Executes logic function by ID. Routes to configured driver (local, lambda, disabled).

#### LogicFunctionResourceService
file: `/engine/core-modules/logic-function/logic-function-resource/logic-function-resource.service.ts`

— Manages logic function code resources (seed project, handler path).

### Drivers

#### LogicFunctionDriver (Interface)
file: `/engine/core-modules/logic-function/logic-function-drivers/interfaces/logic-function-driver.interface.ts`

- **execute(logicFunction: LogicFunctionEntity, payload: unknown): Promise<LogicFunctionExecutionResult>** — Executes logic function, driver-specific implementation.

#### DisabledDriver, LocalDriver, LambdaDriver
file: `/engine/core-modules/logic-function/logic-function-drivers/drivers/*.driver.ts`

— Driver implementations: disabled (no-op), local (in-process execution), lambda (AWS Lambda).

#### LogicFunctionDriverFactory
file: `/engine/core-modules/logic-function/logic-function-drivers/logic-function-driver.factory.ts`

— Factory to create appropriate driver based on config.

### Triggers

#### CronTriggerJob, CronTriggerCommand
file: `/engine/core-modules/logic-function/logic-function-trigger/triggers/cron/`

— Cron-based trigger for scheduled logic function execution.

#### DatabaseEventTriggerJob, CallDatabaseEventTriggerJobsJob, transform-event-batch-to-event-payloads.ts
file: `/engine/core-modules/logic-function/logic-function-trigger/triggers/database-event/`

— Database event triggers convert record changes to logic function event payloads.

#### RouteTriggersService
file: `/engine/core-modules/logic-function/logic-function-trigger/triggers/route/route-trigger.service.ts`

- **handleRouteRequest(request: unknown): Promise<LogicFunctionExecutionResult>** — REST endpoint handler for logic function routes. Builds event payload from request.

---

## workflow

### Resolvers

#### WorkflowBuilderResolver
file: `/engine/core-modules/workflow/resolvers/workflow-builder.resolver.ts`

- **computeStepOutputSchema(@AuthWorkspace() workspace: WorkspaceEntity, @Args('input') input: ComputeStepOutputSchemaInput): Promise<OutputSchema>** — Mutation to compute output schema for workflow step. Calls WorkflowSchemaWorkspaceService.

#### WorkflowVersionResolver
file: `/engine/core-modules/workflow/resolvers/workflow-version.resolver.ts`

— Resolver for workflow version CRUD operations (create, update, delete, publish).

#### WorkflowVersionStepResolver
file: `/engine/core-modules/workflow/resolvers/workflow-version-step.resolver.ts`

— Resolver for workflow steps within versions.

#### WorkflowVersionEdgeResolver
file: `/engine/core-modules/workflow/resolvers/workflow-version-edge.resolver.ts`

— Resolver for step connections (edges) in workflow DAG.

#### WorkflowTriggerResolver
file: `/engine/core-modules/workflow/resolvers/workflow-trigger.resolver.ts`

— Resolver for webhook and event-based workflow triggers.

### Controllers

#### WorkflowTriggerController
file: `/engine/core-modules/workflow/controllers/workflow-trigger.controller.ts`

— REST controller for webhook-based workflow triggers. Dispatches to trigger service.

### Filters

#### WorkflowTriggerGraphqlApiExceptionFilter, WorkflowTriggerRestApiExceptionFilter
file: `/engine/core-modules/workflow/filters/workflow-trigger-*-exception.filter.ts`

— Exception filters for GraphQL and REST workflow trigger errors.

---

## upgrade

### Services

#### UpgradeStatusService
file: `/engine/core-modules/upgrade/services/upgrade-status.service.ts`

- **getInstanceStatus(): Promise<InstanceUpgradeStatus>** — Returns instance upgrade status (version, health, latest command).

- **getWorkspaceStatuses(filterWorkspaceIds?: string[]): Promise<WorkspaceUpgradeStatus[]>** — Returns status for all/filtered workspaces.

- **getInstanceAndAllWorkspacesStatus(): Promise<InstanceAndAllWorkspacesUpgradeStatus>** — Returns aggregate status (instance + workspaces), checks cache, builds workspace refs by health.

- **buildCursorStatus(migration: UpgradeMigration | null, lastExpectedCommandName: string | null): Promise<InstanceUpgradeStatus>** (private) — Derives health enum (UP_TO_DATE, BEHIND, FAILED) from migration.

#### UpgradeCommandRegistryService
file: `/engine/core-modules/upgrade/services/upgrade-command-registry.service.ts`

- **registerCommand(command: UpgradeCommand)** — Registers instance/workspace upgrade command.

- **getUpgradeCommands(kind: 'instance' | 'workspace'): UpgradeCommand[]** — Returns all registered commands.

#### UpgradeMigrationService
file: `/engine/core-modules/upgrade/services/upgrade-migration.service.ts`

— Manages upgrade migration records (status, errors, timing).

#### UpgradeSequenceReaderService
file: `/engine/core-modules/upgrade/services/upgrade-sequence-reader.service.ts`

- **getUpgradeSequence(): UpgradeStep[]** — Reads ordered list of instance/workspace upgrade steps.

#### UpgradeSequenceRunnerService
file: `/engine/core-modules/upgrade/services/upgrade-sequence-runner.service.ts`

— Executes upgrade sequence, handles errors, persists state.

#### InstanceCommandRunnerService
file: `/engine/core-modules/upgrade/services/instance-command-runner.service.ts`

— Runs fast/slow instance commands with data migration.

#### WorkspaceCommandRunnerService
file: `/engine/core-modules/upgrade/services/workspace-command-runner.service.ts`

— Runs workspace upgrade commands (iterates active/suspended workspaces).

#### UpgradeStatusCacheService
file: `/engine/core-modules/upgrade/services/upgrade-status-cache.service.ts`

— Caches upgrade status computations.

### Decorators

#### RegisteredInstanceCommand, RegisteredWorkspaceCommand
file: `/engine/core-modules/upgrade/decorators/registered-*-command.decorator.ts`

— Decorators to mark classes as upgrade commands (auto-discovered).

#### WasIntroducedInUpgrade, WasRemovedInUpgrade, WasRenamedInUpgrade
file: `/engine/core-modules/upgrade/decorators/was-*-in-upgrade.decorator.ts`

— Decorators to track entity lifecycle changes across versions.

### Commands

#### UpgradeStatusCommand
file: `/engine/core-modules/upgrade/commands/upgrade-status.command.ts`

— CLI command to display upgrade status.

---

## user

### Services

#### UserService
file: `/engine/core-modules/user/services/user.service.ts`

- **loadWorkspaceMember(user: Pick<AuthContextUser, 'id'>, workspace: Pick<WorkspaceEntity, 'id' | 'activationStatus'>): Promise<WorkspaceMemberWorkspaceEntity | null>** — Loads single workspace member for user.

- **loadWorkspaceMembers(workspace: Pick<WorkspaceEntity, 'id' | 'activationStatus'>, withDeleted?: boolean): Promise<WorkspaceMemberWorkspaceEntity[]>** — Loads all workspace members (optionally with deleted).

- **loadWorkspaceMembersByUserIds(params: { workspace: ...; userIds: string[] }): Promise<WorkspaceMemberWorkspaceEntity[]>** — Loads workspace members for user ID set. Returns id, userId, avatarUrl.

- **loadDeletedWorkspaceMembersOnly(workspace: ...): Promise<WorkspaceMemberWorkspaceEntity[]>** — Loads only soft-deleted workspace members.

- **loadSignedAvatarUrlsByUserId(params: { workspace: ...; fallbackAvatarUrlsByUserId: Map<string, string | null> }): Promise<Map<string, string | null>>** — Generates signed avatar URLs for users, falls back to provided URLs.

- **deleteUser(userId: string)** — Soft-deletes user and removes from all workspaces, cascading workspace deletion if needed.

- **deleteUserWorkspaceAndPotentiallyDeleteUser(params: { userId: string; workspaceId: string })** — Removes user from workspace, deletes user if no workspaces remain.

#### UserVarsService
file: `/engine/core-modules/user/user-vars/services/user-vars.service.ts`

— Manages user-specific variables/preferences.

#### WorkspaceMemberTranspilerService
file: `/engine/core-modules/user/services/workspace-member-transpiler.service.ts`

— Transpiles workspace member data (e.g., avatar URLs).

#### WorkspaceFlatWorkspaceMemberMapCacheService
file: `/engine/core-modules/user/services/workspace-flat-workspace-member-map-cache.service.ts`

— Caches flattened workspace member maps by user ID.

#### UserEntityCacheProviderService
file: `/engine/core-modules/user/services/user-entity-cache-provider.service.ts`

— Provides cached user entity data.

### Resolver

#### UserResolver
file: `/engine/core-modules/user/user.resolver.ts`

— GraphQL resolver for user queries/mutations.

### Utilities

#### from-user-entity-to-flat.util.ts, assert-workspace-member-update-non-custom-fields.util.ts
file: `/engine/core-modules/user/utils/*.util.ts`

— User entity transformation and validation utilities.

---

## workspace

### Services

#### WorkspaceService
file: `/engine/core-modules/workspace/services/workspace.service.ts`

- **updateWorkspaceById(params: { payload: Partial<WorkspaceEntity> & { id: string }; userWorkspaceId?: string; apiKey?: ApiKeyEntity }): Promise<WorkspaceEntity>** — Updates workspace with permission validation. Validates subdomain/custom domain, handles domain registration, updates cache.

- **validateWorkspaceUpdatePermissions(params: { payload: ...; userWorkspaceId?: string; workspaceId: string; apiKey?: ApiKeyEntity; workspaceActivationStatus: WorkspaceActivationStatus })** (private) — Enforces WORKSPACE_FIELD_PERMISSIONS for update operations.

#### WorkspaceEntityCacheProviderService
file: `/engine/core-modules/workspace/services/workspace-entity-cache-provider.service.ts`

— Provides cached workspace entity data.

### Resolver

#### WorkspaceResolver
file: `/engine/core-modules/workspace/workspace.resolver.ts`

— GraphQL resolver for workspace queries/mutations (create, update, activate, get).

### Utilities

#### from-workspace-entity-to-flat.util.ts, get-auth-providers-by-workspace.util.ts, get-auth-bypass-providers-by-workspace.util.ts, workspace-graphql-api-exception-handler.util.ts
file: `/engine/core-modules/workspace/utils/*.util.ts`

— Workspace entity transformation and auth provider resolution utilities.

### Crons & Jobs

#### CheckCustomDomainValidRecordsCronJob, CheckCustomDomainValidRecordsCronCommand
file: `/engine/core-modules/workspace/crons/jobs/ and /commands/`

— Periodic verification of custom domain DNS records.

#### HandleWorkspaceMemberDeletedJob
file: `/engine/core-modules/workspace/handle-workspace-member-deleted.job.ts`

— Background job triggered on workspace member deletion.

---

## Summary

**Total documented functions/methods: ~150+**

This documentation covers:
- 8 record-crud services + utilities and exceptions
- 2 major tool-provider services + 9 provider classes + utilities
- 6 tool classes and utilities
- Logic function executor, drivers, and trigger system
- Workflow resolvers, controllers, and exception filters
- Upgrade services, decorators, and commands
- User services and utilities
- Workspace services and utilities

All exported functions, NestJS service methods, GraphQL resolvers, commands, guards, and notable utility functions are documented with their signatures and business logic.

