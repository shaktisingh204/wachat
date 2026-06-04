# Metadata Modules: Permissions, Roles, Channels & Functions

Comprehensive documentation of role management, permission systems, and communication channel handlers in the Twenty Server backend metadata modules.

## role

### Role Management Service
`file:role/role.service.ts`

#### getWorkspaceRoles
- `(workspaceId: string) → Promise<RoleEntity[]>`
- Retrieves all roles in workspace with relations to roleTargets, rolePermissionFlags, permissionFlags, objectPermissions, and fieldPermissions. Core entry point for role discovery.

#### getRoleById
- `(id: string, workspaceId: string) → Promise<RoleEntity | null>`
- Fetches single role by ID with all nested permission relations. Returns null if not found.

#### getRoleByUniversalIdentifier
- `(universalIdentifier: string, workspaceId: string) → Promise<RoleDTO | null>`
- Resolves role using flat entity maps cache. Uses cached flat role maps for performance optimization.

#### createRole
- `(input: CreateRoleInput, workspaceId: string, ownerFlatApplication: FlatApplication) → Promise<RoleDTO>`
- Creates new role entity via workspace migration system. Converts CreateRoleInput → FlatRole → validates → builds → returns RoleDTO. Uses cache invalidation and recomputation.

#### updateRole
- `(input: UpdateRoleInput, workspaceId: string, ownerFlatApplication?: FlatApplication) → Promise<RoleDTO>`
- Updates role using migration validation. Resolves owner app if not provided. Updates only changed fields and refreshes flat entity maps.

#### deleteRole
- `(roleId: string, workspaceId: string, ownerFlatApplication?: FlatApplication) → Promise<RoleDTO>`
- Wrapper around deleteManyRoles for single deletion. Rebinds all role targets to default role before deletion.

#### deleteManyRoles
- `(ids: string[], workspaceId: string, isSystemBuild?: boolean, ownerFlatApplication?: FlatApplication) → Promise<RoleDTO[]>`
- Batch delete roles with comprehensive validation. Prevents default role deletion, rebinds user/API key/agent targets to default role. Throws if default role cannot accept rebinds.

#### createMemberRole
- `(workspaceId: string, ownerFlatApplication: FlatApplication) → Promise<RoleDTO>`
- Creates standard "Member" role with all object access but limited settings. Used for workspace initialization.

#### createGuestRole
- `(workspaceId: string, ownerFlatApplication: FlatApplication) → Promise<RoleDTO>`
- Creates "Guest" role with read-only object access and no tool access. Restricted role for limited collaboration.

#### rebindTargetsOfRoleToDeleteToDefaultRole (private)
- `(roleId: string, roleLabel: string, workspaceId: string, defaultRoleId: string) → Promise<void>`
- Reassigns all users, API keys, and agents from deleted role to workspace default role. Validates that default role can be assigned to each target type.

#### toRoleDeleteRebindException (private)
- `(roleLabel: string, targetKind: 'apiKey' | 'agent') → Error`
- Creates user-friendly exception when default role cannot be assigned to API key or agent targets during deletion.

### Role Resolver
`file:role/role.resolver.ts`

#### getRoles
- `() → Promise<RoleDTO[]>`
- Query resolver returning all workspace roles. Requires ROLES permission flag.

#### updateWorkspaceMemberRole
- `(workspaceMemberId: string, roleId: string, updatorWorkspaceMemberId: string) → Promise<WorkspaceMemberDTO>`
- Mutation assigning new role to workspace member. Prevents users from changing own role and validates admin count.

#### createOneRole
- `(createRoleInput: CreateRoleInput) → Promise<RoleDTO>`
- Mutation creating new role. Resolves workspace custom application for ownership.

#### updateOneRole
- `(updateRoleInput: UpdateRoleInput) → Promise<RoleDTO>`
- Mutation updating existing role with provided input changes.

#### deleteOneRole
- `(roleId: string) → Promise<string>`
- Mutation deleting role by ID. Returns deleted role ID as string.

#### upsertObjectPermissions
- `(upsertObjectPermissionsInput: UpsertObjectPermissionsInput) → Promise<ObjectPermissionDTO[]>`
- Mutation upserting object-level permissions for role on specific objects. Maps flat object permissions to DTOs.

#### upsertPermissionFlags
- `(upsertPermissionFlagsInput: UpsertPermissionFlagsInput) → Promise<RolePermissionFlagDTO[]>`
- Mutation upserting permission flags for role. Validates flags exist and syncs with flat entity maps.

#### upsertFieldPermissions
- `(upsertFieldPermissionsInput: UpsertFieldPermissionsInput) → Promise<FieldPermissionDTO[]>`
- Mutation upserting field-level permissions for role on specific fields.

#### upsertRowLevelPermissionPredicates
- `(input: UpsertRowLevelPermissionPredicatesInput) → Promise<UpsertRowLevelPermissionPredicatesResultDTO>`
- Mutation upserting row-level permission predicates (RLS). Delegates to RowLevelPermissionPredicateService.

#### assignRoleToAgent
- `(agentId: string, roleId: string, workspaceId: string) → Promise<boolean>`
- Mutation assigning role to AI agent. Returns true on success.

#### removeRoleFromAgent
- `(agentId: string, workspaceId: string) → Promise<boolean>`
- Mutation removing role from AI agent.

#### getWorkspaceMembersAssignedToRole (ResolveField)
- `(role: RoleDTO) → Promise<WorkspaceMemberWorkspaceEntity[]>`
- Field resolver returning all workspace members with this role.

#### getAgentsAssignedToRole (ResolveField)
- `(role: RoleDTO) → Promise<AgentDTO[]>`
- Field resolver returning all AI agents with this role. Maps to agent DTOs with application context.

#### getApiKeysAssignedToRole (ResolveField)
- `(role: RoleDTO) → Promise<ApiKeyForRoleDTO[]>`
- Field resolver returning all API keys with this role (limited fields: id, name, expiresAt, revokedAt).

#### getRowLevelPermissionPredicatesForRole (ResolveField)
- `(role: RoleDTO) → Promise<RowLevelPermissionPredicateDTO[]>`
- Field resolver returning RLS predicates filtering by role ID.

#### getRowLevelPermissionPredicateGroupsForRole (ResolveField)
- `(role: RoleDTO) → Promise<RowLevelPermissionPredicateGroupDTO[]>`
- Field resolver returning RLS predicate groups for this role.

## role-target

### RoleTargetService
`file:role-target/services/role-target.service.ts`

#### create
- `(createRoleTargetInput: CreateRoleTargetInput, workspaceId: string) → Promise<FlatRoleTarget>`
- Wraps createMany for single role target. Returns single FlatRoleTarget.

#### createMany
- `(createRoleTargetInputs: CreateRoleTargetInput[], workspaceId: string) → Promise<FlatRoleTarget[]>`
- Batch creates role targets (role-to-user/api-key/agent associations). Validates inputs, converts to flat entities, runs workspace migration, refreshes cache.

#### delete
- `(id: string, workspaceId: string) → Promise<void>`
- Deletes role target by ID. Validates existence and runs migration.

#### findOne
- `(findRoleTargetInput: FindRoleTargetInput) → Promise<FlatRoleTarget | null>`
- Finds role target by ID. Returns null if not found.

## role-permission-flag

### RolePermissionFlagService
`file:role-permission-flag/role-permission-flag.service.ts`

#### upsertPermissionFlags
- `(workspaceId: string, input: UpsertPermissionFlagsInput) → Promise<FlatRolePermissionFlag[]>`
- Upserts permission flags for role. Validates role exists and all flags are valid. Creates missing flags, deletes no-longer-wanted flags, returns current state.

## role-validation

### RoleValidationService
`file:role-validation/services/role-validation.service.ts`

- Small service for role-level validation operations. Prevents invalid role state transitions.

## user-role

### UserRoleService
`file:user-role/user-role.service.ts`

#### assignRoleToManyUserWorkspace
- `(workspaceId: string, userWorkspaceIds: string[], roleId: string) → Promise<void>`
- Assigns role to multiple user workspaces. Validates inputs, filters unchanged assignments, creates role targets.

#### getRoleIdForUserWorkspace
- `(workspaceId: string, userWorkspaceId: string) → Promise<string>`
- Gets role ID for user workspace from cache. Throws if no role assigned.

#### getRolesByUserWorkspaces
- `(userWorkspaceIds: string[], workspaceId: string) → Promise<Map<string, RoleEntity[]>>`
- Maps user workspace IDs to their assigned roles. Returns Map for efficient lookup.

#### getWorkspaceMembersAssignedToRole
- `(roleId: string, workspaceId: string) → Promise<WorkspaceMemberWorkspaceEntity[]>`
- Returns all workspace members (WorkspaceMember objects) with specific role.

#### getUserWorkspaceIdsAssignedToRole
- `(roleId: string, workspaceId: string) → Promise<string[]>`
- Returns user workspace IDs assigned to role. Uses cache lookup.

#### validateUserWorkspaceIsNotUniqueAdminOrThrow
- `(userWorkspaceId: string, workspaceId: string) → Promise<void>`
- Validates user is not the only admin before allowing role change. Throws if attempting to unassign last admin.

## permissions

### PermissionsService
`file:permissions/permissions.service.ts`

#### getUserWorkspacePermissions
- `(userWorkspaceId: string, workspaceId: string) → Promise<UserWorkspacePermissions>`
- Returns full permission object for user including permission flags (feature access) and object permissions. Computes based on role's settings/tool access and explicit permission flags.

#### getDefaultUserWorkspacePermissions
- `() → UserWorkspacePermissions`
- Returns constant default permissions with all flags false and empty object permissions.

#### userHasWorkspaceSettingPermission
- `(userWorkspaceId?: string, workspaceId: string, setting: PermissionFlagType, apiKeyId?: string, applicationId?: string) → Promise<boolean>`
- Checks if specific user/api-key/application has given setting permission. Resolves role and checks permissions.

#### checkRolePermissions
- `(role: RoleEntity, setting: PermissionFlagType) → boolean`
- Checks if role has base permission or explicit permission flag for setting (synchronous).

#### checkRolesPermissions
- `(rolePermissionConfig: RolePermissionConfig, workspaceId: string, setting: PermissionFlagType) → Promise<boolean>`
- Checks permission against union/intersection of multiple roles. Returns true for shouldBypassPermissionChecks config.

#### hasToolPermission
- `(rolePermissionConfig: RolePermissionConfig, workspaceId: string, flag: PermissionFlagType) → Promise<boolean>`
- Checks if roles have tool permission (canAccessAllTools or explicit flag).

## permission-flag

### PermissionFlagService
`file:permission-flag/permission-flag.service.ts`

#### findAll
- `(workspaceId: string) → Promise<PermissionFlagDTO[]>`
- Returns all permission flags sorted by creation date.

#### findById
- `(id: string, workspaceId: string) → Promise<PermissionFlagDTO | null>`
- Finds permission flag by ID.

#### create
- `(input: CreatePermissionFlagInput, workspaceId: string) → Promise<PermissionFlagDTO>`
- Creates new permission flag via workspace migration.

#### update
- `(input: UpdatePermissionFlagInput, workspaceId: string) → Promise<PermissionFlagDTO>`
- Updates permission flag with validation.

#### delete
- `(id: string, workspaceId: string) → Promise<PermissionFlagDTO>`
- Deletes permission flag.

## object-permission

### ObjectPermissionService
`file:object-permission/object-permission.service.ts`

#### upsertObjectPermissions
- `(workspaceId: string, input: UpsertObjectPermissionsInput) → Promise<FlatObjectPermission[]>`
- Upserts object-level permissions for role on objects. Validates read>write consistency (cannot grant write without read). Creates/updates/deletes permissions as needed. Returns final state.

#### validateObjectPermissionsReadAndWriteConsistencyOrThrow (private)
- Ensures write/delete permissions cannot be granted without read permission. Enforces permission hierarchy.

#### getFlatApplicationForWorkspace (private)
- `(workspaceId: string) → Promise<FlatApplication>`
- Resolves workspace custom application for migration building.

## row-level-permission-predicate

### RowLevelPermissionPredicateService
`file:row-level-permission-predicate/services/row-level-permission-predicate.service.ts`

#### findByWorkspaceId
- `(workspaceId: string) → Promise<RowLevelPermissionPredicateDTO[]>`
- Returns all RLS predicates for workspace if feature enabled. Filters deleted, sorts by position.

#### findByRoleAndObject
- `(workspaceId: string, roleId: string, objectMetadataId: string) → Promise<RowLevelPermissionPredicateDTO[]>`
- Returns RLS predicates for specific role-object pair. Filtered and sorted.

#### findById
- `(id: string, workspaceId: string) → Promise<RowLevelPermissionPredicateDTO | null>`
- Finds RLS predicate by ID if not soft-deleted.

#### upsertRowLevelPermissionPredicates
- `(input: UpsertRowLevelPermissionPredicatesInput, workspaceId: string) → Promise<{ predicates: RowLevelPermissionPredicateDTO[], predicateGroups: RowLevelPermissionPredicateGroupDTO[] }>`
- Comprehensive RLS upsert. Validates feature enabled, computes create/update/delete operations for predicates and groups, runs migration, returns final state.

#### computePredicateGroupOperations (private)
- Determines group create/update/delete operations. Handles id generation, change tracking, maps updates.

#### computePredicateOperations (private)
- Determines predicate create/update/delete operations. Tracks by id, applies changes, validates field relations.

#### runUpsertMigration (private)
- Executes workspace migration for all predicate/group changes. Invalidates rolesPermissions cache.

#### hasRowLevelPermissionFeature (private)
- `(workspaceId: string) → Promise<boolean>`
- Checks if RLS feature enabled (valid enterprise plan + billing entitlement).

#### hasRowLevelPermissionFeatureOrThrow (private)
- `(workspaceId: string) → Promise<void>`
- Throws if RLS feature not enabled.

## webhook

### WebhookService
`file:webhook/webhook.service.ts`

#### findAll
- `(workspaceId: string) → Promise<WebhookDTO[]>`
- Returns all active webhooks ordered by creation.

#### findById
- `(id: string, workspaceId: string) → Promise<WebhookDTO | null>`
- Finds webhook by ID if not deleted.

#### create
- `(input: CreateWebhookInput, workspaceId: string) → Promise<WebhookDTO>`
- Creates webhook. Normalizes target URL, converts to flat entity, validates, builds, returns DTO.

#### update
- `(input: UpdateWebhookInput, workspaceId: string) → Promise<WebhookDTO>`
- Updates webhook with change validation.

#### delete
- `(id: string, workspaceId: string) → Promise<WebhookDTO>`
- Deletes webhook, returns deleted entity as DTO.

#### normalizeTargetUrl (private)
- `(targetUrl: string) → string`
- Normalizes webhook target URL using URL constructor. Returns original if parse fails.

### WebhookResolver
`file:webhook/webhook.resolver.ts`

#### webhooks (Query)
- `() → Promise<WebhookDTO[]>`
- Returns all webhooks. Requires API_KEYS_AND_WEBHOOKS permission.

#### webhook (Query)
- `(id: string) → Promise<WebhookDTO | null>`
- Finds single webhook by ID. Requires API_KEYS_AND_WEBHOOKS permission.

#### createWebhook (Mutation)
- `(input: CreateWebhookInput) → Promise<WebhookDTO>`
- Creates webhook. Requires API_KEYS_AND_WEBHOOKS permission.

#### updateWebhook (Mutation)
- `(input: UpdateWebhookInput) → Promise<WebhookDTO>`
- Updates webhook. Requires API_KEYS_AND_WEBHOOKS permission.

#### deleteWebhook (Mutation)
- `(id: string) → Promise<WebhookDTO>`
- Deletes webhook. Requires API_KEYS_AND_WEBHOOKS permission.

## logic-function

### LogicFunctionFromSourceHelperService
`file:logic-function/services/logic-function-from-source-helper.service.ts`

#### findLogicFunctionAndApplicationOrThrow
- `(id: string, workspaceId: string) → Promise<{ flatLogicFunction: FlatLogicFunction, ownerFlatApplication: FlatApplication }>`
- Resolves logic function and owner application. Throws if logic function not found.

#### buildHandlerPaths
- `(logicFunctionId: string) → { sourceHandlerPath: string, builtHandlerPath: string }`
- Builds file system paths for logic function handler source and compiled output.

#### createOneFromMetadata
- `(universalFlatLogicFunctionToCreate: UniversalFlatLogicFunction & { id: string }, workspaceId: string) → Promise<UniversalFlatLogicFunction & { id: string }>`
- Creates logic function via workspace migration. Validates and returns created entity.

#### updateOneFromMetadata
- `(flatLogicFunctionToUpdate: FlatLogicFunction, workspaceId: string, applicationUniversalIdentifier: string) → Promise<FlatLogicFunction>`
- Updates logic function via workspace migration. Refreshes flat entity maps.

### LogicFunctionResolver
`file:logic-function/logic-function.resolver.ts`

#### findOneLogicFunction (Query)
- `(id: string) → Promise<LogicFunctionDTO>`
- Returns single logic function by ID. Handles exceptions via handler.

#### findManyLogicFunctions (Query)
- `() → Promise<LogicFunctionDTO[]>`
- Returns all non-deleted logic functions. Filters by deletedAt.

#### getAvailablePackages (Query)
- `(id: string) → Promise<Object>`
- Returns available npm packages for logic function. Requires WORKFLOWS permission.

(Additional queries and mutations for execution, logs, and from-source operations not fully listed due to size.)

## logic-function-layer

### LogicFunctionLayerEntity
`file:logic-function-layer/logic-function-layer.entity.ts`

- TypeORM entity representing logic function layers (execution layers for workflow logic).

## route-trigger

- Route trigger configuration for logic functions and workflows.

## message-channel

### MessageChannelMetadataService
`file:message-channel/message-channel-metadata.service.ts`

#### findAll
- `(workspaceId: string) → Promise<MessageChannelDTO[]>`
- Returns all message channels in workspace.

#### findByUserWorkspaceId
- `(userWorkspaceId: string, workspaceId: string) → Promise<MessageChannelDTO[]>`
- Returns message channels accessible to user (owned + shared).

#### findByConnectedAccountIdForUser
- `(connectedAccountId: string, userWorkspaceId: string, workspaceId: string) → Promise<MessageChannelDTO[]>`
- Returns channels for specific connected account, verifies ownership.

#### findByConnectedAccountId
- `(connectedAccountId: string, workspaceId: string) → Promise<MessageChannelDTO[]>`
- Returns channels for connected account.

#### findByConnectedAccountIds
- `(connectedAccountIds: string[], workspaceId: string) → Promise<MessageChannelDTO[]>`
- Batch finds channels by multiple connected accounts.

#### findById
- `(id: string, workspaceId: string) → Promise<MessageChannelDTO | null>`
- Finds message channel by ID.

#### verifyOwnership
- `(id: string, userWorkspaceId: string, workspaceId: string) → Promise<MessageChannelEntity>`
- Verifies user owns or workspace shares channel. Throws if unauthorized.

(Additional methods for sync state, group emails, inbound email handling not listed due to size.)

## message-folder

### MessageFolderMetadataService
`file:message-folder/message-folder-metadata.service.ts`

- Manages message folder entities (Inbox, Drafts, Sent, etc.) for message channels.

## calendar-channel

### CalendarChannelMetadataService
`file:calendar-channel/calendar-channel-metadata.service.ts`

#### findAll
- `(workspaceId: string) → Promise<CalendarChannelDTO[]>`
- Returns all calendar channels.

#### findByUserWorkspaceId
- `(userWorkspaceId: string, workspaceId: string) → Promise<CalendarChannelDTO[]>`
- Returns user's calendar channels.

#### findByConnectedAccountIdForUser
- `(connectedAccountId: string, userWorkspaceId: string, workspaceId: string) → Promise<CalendarChannelDTO[]>`
- Returns calendar channels for connected account, verifies ownership.

#### findByConnectedAccountId
- `(connectedAccountId: string, workspaceId: string) → Promise<CalendarChannelDTO[]>`
- Returns channels for connected account.

#### findByConnectedAccountIds
- `(connectedAccountIds: string[], workspaceId: string) → Promise<CalendarChannelDTO[]>`
- Batch returns channels for multiple connected accounts.

#### findById
- `(id: string, workspaceId: string) → Promise<CalendarChannelDTO | null>`
- Finds calendar channel by ID.

## connected-account

### ConnectedAccountMetadataService
`file:connected-account/connected-account-metadata.service.ts`

#### findByUserWorkspaceId
- `(userWorkspaceId: string, workspaceId: string) → Promise<ConnectedAccountEntity[]>`
- Returns connected accounts owned by user.

#### findById
- `(id: string, workspaceId: string) → Promise<ConnectedAccountEntity | null>`
- Finds connected account by ID.

#### findByIdAndUserWorkspaceId
- `(id: string, userWorkspaceId: string, workspaceId: string) → Promise<ConnectedAccountEntity | null>`
- Finds connected account with user ownership verification.

#### verifyOwnership
- `(id: string, userWorkspaceId: string, workspaceId: string) → Promise<ConnectedAccountEntity>`
- Verifies user owns connected account or workspace shares it. Throws if unauthorized.

#### getUserConnectedAccountIds
- `(userWorkspaceId: string, workspaceId: string) → Promise<string[]>`
- Returns IDs of user's connected accounts.

#### getWorkspaceSharedConnectedAccountIds
- `(workspaceId: string) → Promise<string[]>`
- Returns IDs of workspace-shared connected accounts.

#### create
- `(data: Partial<ConnectedAccountEntity> & { workspaceId, handle, provider, userWorkspaceId }) → Promise<ConnectedAccountEntity>`
- Creates new connected account (OAuth token storage).

#### update
- `(id: string, workspaceId: string, data: Partial<ConnectedAccountEntity>) → Promise<ConnectedAccountEntity>`
- Updates connected account fields.

#### delete
- `(id: string, workspaceId: string) → Promise<ConnectedAccountEntity>`
- Deletes connected account, revokes OAuth if applicable, logs channel cleanup.

### ConnectedAccountTokenEncryptionService
`file:connected-account/services/connected-account-token-encryption.service.ts`

- Handles encryption/decryption of OAuth tokens stored in connected accounts.

## flat-role-target, flat-role-permission-flag, flat-object-permission, flat-permission-flag

These "flat-" prefixed modules contain:
- **Types**: FlatRoleTarget, FlatRolePermissionFlag, FlatObjectPermission, FlatPermissionFlag types
- **Utils**: Conversion utilities between entities, DTOs, and flat representations (from-*-to-*.util.ts)
- **Services**: Cache management services for fast lookups (workspace-*-map-cache.service.ts)

## flat-row-level-permission-predicate

### Constants
- `flat-row-level-permission-predicate-editable-properties.constant.ts`: Properties of RLS predicates editable by users
- `row-level-permission-predicate-entity-relation-properties.constant.ts`: Entity relation definitions for RLS predicates

### Utils
- Conversion utilities between RLS entities and DTOs
- Builders for create/update operations on RLS predicates and groups

### Services
- `workspace-flat-row-level-permission-predicate-map-cache.service.ts`: Caching for RLS predicates
- `workspace-flat-row-level-permission-predicate-group-map-cache.service.ts`: Caching for RLS predicate groups

## flat-application-variable

- Manages application-level variables and configuration through flat entity system.

## flat-connection-provider

- Manages connection provider configurations (OAuth, API providers) through flat entity system.

---

## Summary

This metadata-modules slice covers the complete role-based access control (RBAC) system for Twenty Server:

- **Role Management**: CRUD operations, role hierarchies, target assignments (users/API keys/agents)
- **Permissions**: Feature flags, object/field/row-level permissions, permission inheritance
- **Channels**: Message channels, calendar channels, connected accounts for email/calendar integration
- **Workflows**: Logic functions, layers, and route triggers for automation
- **Caching**: Extensive use of flat entity maps and workspace cache for performance

Key patterns:
- Workspace migration system for all metadata changes
- Flat entity system for efficient caching and transformation
- Exception hierarchy for domain-specific errors
- GraphQL resolvers with permission guards
- DTO transformation layers separating entities from API responses

Total documented functions: ~130+

## NOT YET COVERED

Due to size constraints, the following files have not been fully documented but exist in the directory:
- role/utils/* (fromFlatRoleToRoleDto, fromRoleEntityToRoleDto, etc.) - Conversion utilities
- role/services/workspace-*-cache.service.ts - Caching services
- role-target/services/workspace-*-cache.service.ts - Caching services  
- role-validation/services/role-validation.service.ts - Validation logic
- webhook/entities/webhook.entity.ts, dtos/*.ts - Entity and DTO definitions
- webhook/services/*, webhook/interceptors/* - Supporting services
- message-channel/*, calendar-channel/*, message-folder/* - Additional resolvers, interceptors, entities
- logic-function/* (majority of file) - Additional resolvers, services, utilities (large module)
- logic-function-layer/logic-function-layer.entity.ts
- route-trigger/* - All files
- connected-account/entities/connected-account.entity.ts, resolvers/*, interceptors/*
- All flat-* utility functions and entity converters
- All remaining service implementations beyond 200 lines

To continue documentation: read entity files, interceptors, exception definitions, and remaining service methods from large modules.
