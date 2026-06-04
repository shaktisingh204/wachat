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

## role — utils & cache services

### fromRoleEntityToRoleDto / fromRoleEntitiesToRoleDtos
`file:role/utils/fromRoleEntityToRoleDto.util.ts:6`
`(role: RoleEntity) → RoleDTO` / `(roleEntities: RoleEntity[]) → RoleDTO[]`
Maps a RoleEntity to its GraphQL DTO, flattening `rolePermissionFlags` into `{id, roleId, flag}` (reading `permissionFlag.key` as `PermissionFlagType`) and passing through object/field permissions and all the `canX` booleans.

### fromFlatRoleToRoleDto
`file:role/utils/fromFlatRoleToRoleDto.util.ts`
Converts a `FlatRole` (cache representation) to a `RoleDTO` — the flat-map counterpart of `fromRoleEntityToRoleDto`, used by cache-served read paths.

### fromUserWorkspacePermissionsToUserWorkspacePermissionsDto
`file:role/utils/fromUserWorkspacePermissionsToUserWorkspacePermissionsDto.ts`
Maps the computed `UserWorkspacePermissions` object (flags + object permissions) into its GraphQL DTO shape.

### WorkspaceFlatRoleMapCacheService.computeForCache
`file:role/services/workspace-flat-role-map-cache.service.ts:53`
`async computeForCache(workspaceId) → FlatEntityMaps<FlatRole>`
`WorkspaceCacheProvider` (decorated `@WorkspaceCache`) that loads all role entities and builds the flat role maps keyed by universal identifier — the source of `flatRoleMaps` used everywhere for fast role lookups.

### WorkspaceRolesPermissionsCacheService.computeForCache
`file:role/services/workspace-roles-permissions-cache.service.ts:61`
`async computeForCache(workspaceId) → ObjectsPermissionsByRoleId`
Computes the per-role, per-object effective permission matrix (`rolesPermissions`). Walks the workspace object-metadata collection and each role's base `canX` flags plus explicit object/field permissions, applying settings-gating (`hasSettingsGatedObjectPermissions`) so settings-only objects respect the role's settings access.

### WorkspaceUserWorkspaceRoleMapCacheService.computeForCache
`file:role-target/services/workspace-user-workspace-role-map-cache.service.ts:24`
`async computeForCache(workspaceId) → UserWorkspaceRoleMap`
Loads all role targets with a non-null `userWorkspaceId` and reduces them into a `{ userWorkspaceId → roleId }` map (`userWorkspaceRoleMap`), used by the ORM permission resolution and RLS layers.

### WorkspaceApiKeyRoleMapCacheService.computeForCache
`file:role-target/services/workspace-api-key-role-map-cache.service.ts:24`
`async computeForCache(workspaceId) → Record<string, string>`
Same pattern for API keys: builds the `{ apiKeyId → roleId }` map consumed by `resolveRolePermissionConfig`.

## role-validation

### RoleValidationService.validateRoleAssignableToUsersOrThrow
`file:role-validation/services/role-validation.service.ts:19`
`async validateRoleAssignableToUsersOrThrow(roleId, workspaceId) → Promise<void>`
Loads the role; throws `ROLE_NOT_FOUND` if missing, or `ROLE_CANNOT_BE_ASSIGNED_TO_USERS` if `canBeAssignedToUsers` is false. Guards user-role assignment mutations.

## object-permission — field-permission

### FieldPermissionService.upsertFieldPermissions
`file:object-permission/field-permission/field-permission.service.ts:49`
`async upsertFieldPermissions({workspaceId, input}) → Promise<FlatFieldPermission[]>`
Diffs desired vs current field permissions for a role and runs a workspace migration. Loads role/object/field flat maps + current permissions, validates each entry (`validateFieldPermission`), auto-adds the paired relation-target field (`addRelatedFieldPermissionsToDesired`), computes create/update/delete sets, runs `validateBuildAndRunWorkspaceMigration`, invalidates the `rolesPermissions` cache, and returns the role's permissions for the affected objects. No-ops (returns current) when nothing changed.

### FieldPermissionService.validateFieldPermission (private)
`file:object-permission/field-permission/field-permission.service.ts:311`
Rejects duplicate field entries; enforces that field permissions may only *restrict* (canRead/canUpdate must be false/null, else `ONLY_FIELD_RESTRICTION_ALLOWED`); verifies object exists, is non-system, field exists, and the role already has an object permission on that object (else the corresponding `*_NOT_FOUND` exception).

### FieldPermissionService.addRelatedFieldPermissionsToDesired (private)
`file:object-permission/field-permission/field-permission.service.ts:407`
For ONE_TO_MANY/MANY_TO_ONE relation fields, also restricts the relation's target field (so a restriction on one side mirrors to the other). Throws `Conflicting field permissions` if the paired field is in the input with contradicting values.

### from-flat-field-permission-to-field-permission-dto / from-flat-object-permission-to-object-permission-dto
`file:object-permission/utils/from-flat-field-permission-to-field-permission-dto.util.ts` / `file:object-permission/utils/from-flat-object-permission-to-object-permission-dto.util.ts`
Flat-map → DTO converters for field/object permissions returned by the resolver mutations.

## row-level-permission-predicate — group service

### RowLevelPermissionPredicateGroupService.findByWorkspaceId
`file:row-level-permission-predicate/services/row-level-permission-predicate-group.service.ts:30`
`async findByWorkspaceId(workspaceId) → RowLevelPermissionPredicateGroupDTO[]`
Returns all non-deleted predicate groups sorted by position — but only if RLS feature is enabled (valid enterprise plan + RLS billing entitlement), else `[]`.

### RowLevelPermissionPredicateGroupService.findByRole / findById
`file:row-level-permission-predicate/services/row-level-permission-predicate-group.service.ts:61` / `:93`
Same gated read for a single role's groups, or a single group by id (null if missing/deleted or feature off).

### RowLevelPermissionPredicateGroupService.deleteAllRowLevelPermissionPredicateGroups
`file:row-level-permission-predicate/services/row-level-permission-predicate-group.service.ts:124`
`async deleteAllRowLevelPermissionPredicateGroups(workspaceId)`
Hard-deletes every group in the workspace and invalidates the `rolesPermissions` + RLS predicate/group caches.

### RowLevelPermissionPredicateGroupService.hasRowLevelPermissionFeature (private)
`file:row-level-permission-predicate/services/row-level-permission-predicate-group.service.ts:137`
Returns `enterprisePlanService.isValid() && billingService.hasEntitlement(RLS)`. The feature gate reused by all reads.

## webhook — controller, jobs, tools & utils

### WebhookController
`file:webhook/controllers/webhook.controller.ts:41`
REST controller (guarded by `SettingsPermissionGuard(API_KEYS_AND_WEBHOOKS)`) exposing `@Get()` findAll, `@Get(':id')` findOne, `@Post()` create, update and `remove` — thin wrappers over `WebhookService` for the REST surface (the GraphQL surface is `WebhookResolver`).

### generateWebhookSecret
`file:webhook/utils/generate-webhook-secret.util.ts:3`
`() → string`
Generates the random HMAC secret stored on a webhook and used to sign deliveries.

### transformEventToWebhookEvent
`file:webhook/utils/transform-event-to-webhook-event.ts:7`
`({eventName, event}) → { record, updatedFields? }`
Picks `properties.after` (falling back to `.before`) as the record, includes `updatedFields` when present, and strips secrets via `removeSecretFromWebhookRecord` (special-casing webhook-on-webhook events). Shapes a single record event for delivery.

### transformEventBatchToWebhookEvents
`file:webhook/utils/transform-event-batch-to-webhook-events.ts:8`
`({workspaceEventBatch, webhooks}) → CallWebhookJobData[]`
Fans a batch out into one job-data item per (record × matching webhook), embedding target URL, secret, event name and the transformed record.

### CallWebhookJobsJob.handle
`file:webhook/jobs/call-webhook-jobs.job.ts:30`
`async handle(workspaceEventBatch) → Promise<void>`
Queue processor: for an object-record event, computes the four wildcard operation patterns (`x.y`, `*.y`, `x.*`, `*.*`), reads `flatWebhookMaps` from cache, filters webhooks subscribed to any pattern, transforms to webhook events, chunks by 20, and enqueues `CallWebhookJob` batches with `retryLimit: 3`.

### CallWebhookJobsForMetadataJob.handle
`file:webhook/jobs/call-webhook-jobs-for-metadata.job.ts:26`
`async handle(metadataEventBatch) → Promise<void>`
Metadata-event counterpart of `CallWebhookJobsJob` — matches webhooks subscribed to metadata events (`transformMetadataEventBatchToWebhookEvents`) and enqueues delivery jobs.

### CallWebhookJob.handle / callWebhook / generateSignature
`file:webhook/jobs/call-webhook.job.ts:34`
`async handle(events: WebhookJobData[])`
Actual HTTP delivery processor. For each event POSTs the (secret-stripped) payload via `SecureHttpClientService` (SSRF-guarded) with a 5s timeout; when a secret exists, signs with `X-Twenty-Webhook-Signature` (HMAC-SHA256 of `timestamp:payload`), plus timestamp + nonce headers. Records `WEBHOOK_RESPONSE_EVENT` audit entries and metrics, and detects SSRF-blocked private-IP targets in the error path.

### WebhookToolWorkspaceService.generateWebhookTools
`file:webhook/tools/services/webhook-tool.workspace-service.ts:20`
`generateWebhookTools(workspaceId) → ToolSet`
Builds the AI `ToolSet` (list/create/update/delete webhook tools) bound to the workspace, wiring each `create*Tool` factory with `{webhookService}` deps — exposes webhook management to the agent layer.

### create{List,Create,Update,Delete}WebhookTool
`file:webhook/tools/list-webhooks.tool.ts`, `create-webhook.tool.ts`, `update-webhook.tool.ts`, `delete-webhook.tool.ts`
Factory functions returning an AI tool (name + schema + execute) that calls the corresponding `WebhookService` method. `compile-webhook-operations.util.ts` normalizes the operation-pattern input from the schema.

## logic-function — resolver & from-source service

### LogicFunctionResolver
`file:logic-function/logic-function.resolver.ts:38`
Metadata GraphQL resolver (guarded by workspace auth + feature flag; mutations gated on `WORKFLOWS` permission).

- `findOneLogicFunction` (`:46`) / `findManyLogicFunctions` (`:71`): read from `flatLogicFunctionMaps` cache, filtering soft-deleted, mapping to DTO.
- `getAvailablePackages` (`:99`): resolves the function's owning application and returns its `availablePackages`.
- `createOneLogicFunction` (`:154`) / `updateOneLogicFunction` (`:203`) / `deleteOneLogicFunction` (`:138`) / `executeOneLogicFunction` (`:170`) / `getLogicFunctionSourceCode` (`:187`): delegate to `LogicFunctionFromSourceService`.
- `logicFunctionLogs` (`:255`): GraphQL `@Subscription` to `LOGIC_FUNCTION_LOGS_CHANNEL`, with a filter matching by id/universalIdentifier/name/applicationId.

### LogicFunctionFromSourceService.createOneFromSource
`file:logic-function/services/logic-function-from-source.service.ts:41`
`async createOneFromSource({input, workspaceId}) → LogicFunctionDTO`
Resolves the owning custom application, builds source/built handler paths, either uploads the provided source (build marked stale) or seeds template source files (build up-to-date), creates the metadata entry via the helper migration, and returns the resulting DTO.

### LogicFunctionFromSourceService.duplicateOneWithSource
`file:logic-function/services/logic-function-from-source.service.ts:129`
`async duplicateOneWithSource({existingLogicFunctionId, workspaceId}) → {id}`
Copies the source/built resources to new id-stamped paths, rebuilds the universal flat entity carrying over all trigger settings (cron/db-event/http-route/tool/workflow-action), and creates the duplicate.

### LogicFunctionFromSourceService.updateOneFromSource
`file:logic-function/services/logic-function-from-source.service.ts:202`
`async updateOneFromSource({updateLogicFunctionFromSourceInput, workspaceId})`
Re-uploads source code if changed, builds the flat-update from the input + existing entity, and runs the update migration.

### LogicFunctionFromSourceService.deleteOneWithSource
`file:logic-function/services/logic-function-from-source.service.ts:241`
`async deleteOneWithSource({id, workspaceId, isSystemBuild?, ownerFlatApplication?}) → LogicFunctionDTO`
Runs a destroy migration (`flatEntityToDelete: [function]`); throws `WorkspaceMigrationBuilderException` on validation failure; returns the deleted entity's DTO.

### LogicFunctionFromSourceService.buildOneFromSource
`file:logic-function/services/logic-function-from-source.service.ts:292`
`async buildOneFromSource({id, workspaceId})`
Fetches source, transpiles via `LogicFunctionExecutorService.transpile`, uploads the built file, computes an md5 checksum, and marks `isBuildUpToDate: true`.

### LogicFunctionFromSourceService.executeOneFromSource
`file:logic-function/services/logic-function-from-source.service.ts:345`
`async executeOneFromSource({id, payload, workspaceId}) → LogicFunctionExecutionResultDTO`
Lazily builds if stale, executes via the executor service, and normalizes the result (data/logs/duration/status + flattened error stack trace).

### LogicFunctionFromSourceService.getSourceCode
`file:logic-function/services/logic-function-from-source.service.ts:387`
`async getSourceCode({id, workspaceId}) → string | null`
Returns the stored source handler file contents.

### WorkspaceFlatLogicFunctionMapCacheService.computeForCache
`file:logic-function/services/workspace-flat-logic-function-map-cache.service.ts:32`
`WorkspaceCacheProvider` building `flatLogicFunctionMaps` from logic-function entities — backs the resolver reads.

### logic-function utils
`file:logic-function/utils/`
Conversion + helper utilities: `from-flat-logic-function-to-logic-function-dto`, `from-logic-function-entity-to-flat-logic-function`, `from-create-...-input-to-universal-flat-logic-function-to-create`, `from-update-...-input-to-flat-logic-function-to-update`, `build-universal-flat-logic-function-to-create`, `find-flat-logic-function-or-throw`, `logic-function-create-hash` (md5 of build), `get-logic-function-subfolder-for-from-source`, and `logic-function-graphql-api-exception-handler`.

## route-trigger

### RouteTriggerController
`file:route-trigger/route-trigger.controller.ts:24`
Public (`PublicEndpointGuard`, `NoPermissionGuard`) controller mounted at `/s`, with `@Get/@Post/@Put/@Patch/@Delete('*path')` handlers that all forward the raw `Request` plus the `HTTPMethod` to `RouteTriggerService.handle` — the public HTTP entry point that invokes logic-function route triggers.

## message-channel — resolver

### MessageChannelResolver
`file:message-channel/resolvers/message-channel.resolver.ts:42`
Metadata resolver (workspace auth + exception interceptor).

- `connectedAccount` ResolveField (`:54`): resolves the channel's public connected account; for EMAIL_GROUP channels looks up by id, otherwise verifies user-workspace ownership.
- `myMessageChannels` Query (`:80`): returns the user's channels, optionally filtered by connected account.
- `updateMessageChannel` Mutation (`:107`): verifies ownership, blocks updates while a sync is ongoing with pending folder/group-email actions, schedules group-email import/deletion when `excludeGroupEmails` changes, then updates.
- `createEmailGroupChannel` Mutation (`:170`) / `deleteEmailGroupChannel` Mutation (`:184`): create/delete EMAIL_GROUP channels (delete verifies type + cascades to the connected account).

## calendar-channel — resolver

### CalendarChannelResolver
`file:calendar-channel/resolvers/calendar-channel.resolver.ts:19`
`myCalendarChannels` Query (`:26`) returns the user's calendar channels (optionally by connected account); `updateCalendarChannel` Mutation (`:53`) verifies ownership and applies the update — the calendar-side analogue of the message-channel resolver.

## message-folder — resolver

### MessageFolderResolver
`file:message-folder/resolvers/message-folder.resolver.ts:22`
`myMessageFolders` Query (`:29`) lists folders for a user; `updateMessageFolder` Mutation (`:54`) updates one; `updateMessageFolders` Mutation (`:74`) batch-updates folder sync selections (e.g. which folders to sync).

## connected-account — resolver, utils & token encryption

### ConnectedAccountResolver
`file:connected-account/resolvers/connected-account.resolver.ts:20`
`myConnectedAccounts` Query (`:27`) returns the user's connected accounts as public DTOs; `deleteConnectedAccount` Mutation (`:42`) verifies ownership then deletes (revoking OAuth + cleaning channels).

### buildPublicConnectedAccount
`file:connected-account/utils/build-public-connected-account.util.ts:5`
Overloaded `(account) → ConnectedAccountPublicDTO | null`. Strips secret/token fields, exposing only the public-safe subset (handle, provider, etc.) for GraphQL.

### ConnectedAccountTokenEncryptionService
`file:connected-account/services/connected-account-token-encryption.service.ts:22`
Envelope encryption wrapper over `SecretEncryptionService`, scoped per workspace.

- `encrypt` (`:31`): versioned-encrypts a plaintext, throwing `ALREADY_ENCRYPTED` if the input already looks like a ciphertext envelope (double-encryption guard).
- `encryptNullable` (`:50`) / `decryptNullable` (`:83`): null-passthrough variants.
- `decrypt` (`:64`): versioned-decrypts, throwing `MALFORMED_ENVELOPE` if the value isn't a proper ciphertext (e.g. un-backfilled plaintext).
- `encryptTokenPair` (`:97`): encrypts access + (nullable) refresh OAuth tokens.
- `encryptConnectionParameters` (`:125`) / `decryptConnectionParameters` (`:150`): per-protocol (IMAP/SMTP/CalDAV) password encryption across `ACCOUNT_TYPES`.
- `decryptProtocolPassword` (`:175`): decrypts a protocol password, tolerating legacy un-encrypted values during the encryption-backfill rollout window (logs a warning).

## Interceptors & exception handlers (channels, permissions, logic-function)

Each channel/permission module ships a thin GraphQL exception interceptor + handler util that maps domain exceptions to GraphQL errors with user-friendly messages, e.g. `message-channel/interceptors/message-channel-graphql-api-exception.interceptor.ts` + `utils/message-channel-graphql-api-exception-handler.util.ts` (and the same pattern for calendar-channel, message-folder, connected-account, logic-function, row-level-permission-predicate, and permissions' filters). They share the same shape: catch the module's `*Exception`, translate its code to an appropriate GraphQL/HTTP error.

## NOT YET COVERED

Genuinely-trivial remainders only:
- `*.entity.ts`, `*.dto.ts`, `*.input.ts`, `*.exception.ts`, `*.enum.ts`, `*.type.ts`, `*.constant.ts` declaration files (data shapes / error-code enums)
- `logic-function-layer/logic-function-layer.entity.ts` (entity shape only)
- `webhook/tools/schemas/webhook-operation.schema.ts` (zod schema)
- Per-module GraphQL exception interceptors/handlers beyond the representative pattern noted above
