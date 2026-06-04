# Twenty-ORM Backend Documentation

Core multi-tenant ORM layer providing workspace-scoped data access, permissions, and entity management for Twenty backend.

## Repository / workspace.repository.ts

### find
file:repository/workspace.repository.ts:93
`async find(options?: FindManyOptions<T>, entityManager?: WorkspaceEntityManager): Promise<T[]>`
Delegates to entity manager's find with transformed options and permission context. Applies formatting and permission filtering.

### findBy
file:repository/workspace.repository.ts:112
`async findBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<T[]>`
Finds records matching WHERE conditions with permission and transformation applied.

### findOne
file:repository/workspace.repository.ts:169
`async findOne(options: FindOneOptions<T>, entityManager?: WorkspaceEntityManager): Promise<T | null>`
Finds single record with permission checks and data formatting. Returns null if not found.

### findOneBy
file:repository/workspace.repository.ts:188
`async findOneBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<T | null>`
Finds single record by WHERE clause, applies permissions and formatting.

### findOneOrFail
file:repository/workspace.repository.ts:207
`async findOneOrFail(options: FindOneOptions<T>, entityManager?: WorkspaceEntityManager): Promise<T>`
Finds single record or throws EntityNotFoundError if not found after permission checks.

### findOneByOrFail
file:repository/workspace.repository.ts:226
`async findOneByOrFail(where: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<T>`
Finds by WHERE or throws if not found.

### findAndCount
file:repository/workspace.repository.ts:131
`async findAndCount(options?: FindManyOptions<T>, entityManager?: WorkspaceEntityManager): Promise<[T[], number]>`
Returns records and total count with permission checks applied.

### findAndCountBy
file:repository/workspace.repository.ts:150
`async findAndCountBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<[T[], number]>`
Finds records matching WHERE and returns count.

### createQueryBuilder
file:repository/workspace.repository.ts:67
`override createQueryBuilder<U extends T>(alias?: string, queryRunner?: QueryRunner): WorkspaceSelectQueryBuilder<U>`
Creates permission-aware query builder wrapping TypeORM's query builder.

### save
file:repository/workspace.repository.ts:248
`override save<U extends DeepPartialWithNestedRelationFields<T>>(entity: U | U[], options?: SaveOptions, entityManager?: WorkspaceEntityManager): Promise<U & T>`
Persists entity/entities with relation handling, files sync, and event emission. Validates permissions on write.

### remove
file:repository/workspace.repository.ts:308
`override remove(entityOrEntities: T | T[], options?: RemoveOptions, entityManager?: WorkspaceEntityManager): Promise<T | T[]>`
Removes entity/entities with event emission and formatting. Hard delete.

### delete
file:repository/workspace.repository.ts:340
`override delete(criteria: string | string[] | number | number[] | Date | Date[] | ObjectId | ObjectId[] | FindOptionsWhere<T>, entityManager?: WorkspaceEntityManager, selectedColumns?: string[] | '*'): Promise<DeleteResult>`
Deletes records by criteria or WHERE conditions with permission checks.

### softRemove
file:repository/workspace.repository.ts:373
`override softRemove<U extends DeepPartial<T>>(entityOrEntities: U | U[], options?: SaveOptions, entityManager?: WorkspaceEntityManager): Promise<U | U[]>`
Soft deletes (marks deletedAt) entities with event emission.

### softDelete
file:repository/workspace.repository.ts:429
`override softDelete(criteria: string | string[] | number | number[] | Date | Date[] | ObjectId | ObjectId[] | FindOptionsWhere<T>, entityManager?: WorkspaceEntityManager, selectedColumns?: string[]): Promise<UpdateResult>`
Soft deletes records matching criteria.

### recover
file:repository/workspace.repository.ts:465
`override recover<U extends DeepPartial<T>>(entityOrEntities: U | U[], options?: SaveOptions, entityManager?: WorkspaceEntityManager): Promise<U | U[]>`
Restores soft-deleted entity/entities with event emission.

### restore
file:repository/workspace.repository.ts:521
`override restore(criteria: string | string[] | number | number[] | Date | Date[] | ObjectId | ObjectId[] | FindOptionsWhere<T>, entityManager?: WorkspaceEntityManager, selectedColumns?: string[]): Promise<UpdateResult>`
Restores soft-deleted records by criteria.

### insert
file:repository/workspace.repository.ts:557
`override async insert(entity: QueryDeepPartialEntityWithNestedRelationFields<T> | QueryDeepPartialEntityWithNestedRelationFields<T>[], entityManager?: WorkspaceEntityManager, selectedColumns?: string[]): Promise<InsertResult>`
Inserts raw entities with permission validation.

### update
file:repository/workspace.repository.ts:583
`override async update(criteria: string | string[] | number | number[] | Date | Date[] | ObjectId | ObjectId[] | FindOptionsWhere<T>, partialEntity: QueryDeepPartialEntity<T>, entityManager?: WorkspaceEntityManager, selectedColumns?: string[]): Promise<UpdateResult>`
Updates records by criteria with permission checks.

### updateMany
file:repository/workspace.repository.ts:619
`async updateMany(inputs: {criteria: string; partialEntity: QueryDeepPartialEntity<T>}[], entityManager?: WorkspaceEntityManager, selectedColumns?: string[]): Promise<UpdateResult>`
Batch updates with multiple criteria/entity pairs for efficient batch operations.

### upsert
file:repository/workspace.repository.ts:644
`override async upsert(entityOrEntities: QueryDeepPartialEntityWithNestedRelationFields<T> | QueryDeepPartialEntityWithNestedRelationFields<T>[], conflictPathsOrOptions: string[] | UpsertOptions<T>, entityManager?: WorkspaceEntityManager, selectedColumns: string[] = []): Promise<InsertResult>`
Inserts or updates on conflict.

### exists
file:repository/workspace.repository.ts:677
`override async exists(options?: FindManyOptions<T>, entityManager?: WorkspaceEntityManager): Promise<boolean>`
Checks if records exist matching options.

### existsBy
file:repository/workspace.repository.ts:692
`override async existsBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<boolean>`
Checks if records exist by WHERE clause.

### count
file:repository/workspace.repository.ts:714
`override async count(options?: FindManyOptions<T>, entityManager?: WorkspaceEntityManager): Promise<number>`
Counts records matching options.

### countBy
file:repository/workspace.repository.ts:729
`override async countBy(where: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<number>`
Counts records by WHERE clause.

### sum
file:repository/workspace.repository.ts:751
`override async sum(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<number | null>`
Sums numeric column values with WHERE filter.

### average
file:repository/workspace.repository.ts:772
`override async average(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<number | null>`
Computes average of numeric column.

### minimum
file:repository/workspace.repository.ts:793
`override async minimum(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<number | null>`
Finds minimum value in numeric column.

### maximum
file:repository/workspace.repository.ts:814
`override async maximum(columnName: PickKeysByType<T, number>, where?: FindOptionsWhere<T> | FindOptionsWhere<T>[], entityManager?: WorkspaceEntityManager): Promise<number | null>`
Finds maximum value in numeric column.

### increment
file:repository/workspace.repository.ts:835
`override async increment(conditions: FindOptionsWhere<T>, propertyPath: string, value: number | string, entityManager?: WorkspaceEntityManager, selectedColumns?: string[]): Promise<UpdateResult>`
Increments numeric column by value.

### decrement
file:repository/workspace.repository.ts:862
`override async decrement(conditions: FindOptionsWhere<T>, propertyPath: string, value: number | string, entityManager?: WorkspaceEntityManager, selectedColumns?: string[]): Promise<UpdateResult>`
Decrements numeric column by value.

### preload
file:repository/workspace.repository.ts:892
`override async preload<U extends DeepPartial<T>>(entityLike: U, entityManager?: WorkspaceEntityManager): Promise<T | undefined>`
Loads and merges a partial entity into database-loaded entity.

### clear
file:repository/workspace.repository.ts:908
`override async clear(entityManager?: WorkspaceEntityManager): Promise<void>`
Truncates entire table.

### query
file:repository/workspace.repository.ts:921
`override async query(): Promise<unknown>`
Throws error - raw SQL queries forbidden for security.

## Entity Manager / entity-manager/workspace-entity-manager.ts

### getRepository
file:entity-manager/workspace-entity-manager.ts:137
`override getRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, rolePermissionConfig?: RolePermissionConfig, authContext?: WorkspaceAuthContext): WorkspaceRepository<Entity>`
Creates WorkspaceRepository with permission checks for given entity target and role configuration.

### createQueryBuilder
file:entity-manager/workspace-entity-manager.ts:192
`override createQueryBuilder<Entity extends ObjectLiteral>(entityClassOrQueryRunner?: EntityTarget<Entity> | QueryRunner, alias?: string, queryRunner?: QueryRunner, options?: {shouldBypassPermissionChecks?: boolean; objectRecordsPermissions?: ObjectsPermissions}): WorkspaceSelectQueryBuilder<Entity>`
Creates workspace-aware query builder with permission enforcement.

### insert
file:entity-manager/workspace-entity-manager.ts:234
`override async insert<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, entity: QueryDeepPartialEntityWithNestedRelationFields<Entity> | QueryDeepPartialEntityWithNestedRelationFields<Entity>[], selectedColumns: string[] | '*' = '*', permissionOptions?: PermissionOptions, authContext?: WorkspaceAuthContext): Promise<InsertResult>`
Inserts entities returning selected columns.

### upsert
file:entity-manager/workspace-entity-manager.ts:258
`override upsert<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, entityOrEntities: QueryDeepPartialEntityWithNestedRelationFields<Entity> | QueryDeepPartialEntityWithNestedRelationFields<Entity>[], conflictPathsOrOptions: string[] | UpsertOptions<Entity>, permissionOptions?: {shouldBypassPermissionChecks?: boolean; objectRecordsPermissions?: ObjectsPermissions}, selectedColumns: string[] | '*' = '*'): Promise<InsertResult>`
Upserts with conflict resolution on specified columns.

### update
file:entity-manager/workspace-entity-manager.ts:328
`override update<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, criteria: string | string[] | number | number[] | Date | Date[] | ObjectId | ObjectId[] | unknown, partialEntity: QueryDeepPartialEntity<Entity>, permissionOptions?: PermissionOptions, selectedColumns: string[] | '*' = '*'): Promise<UpdateResult>`
Updates records by ID or WHERE conditions.

### updateMany
file:entity-manager/workspace-entity-manager.ts:390
`public updateMany<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, inputs: {criteria: string; partialEntity: QueryDeepPartialEntity<Entity>}[], permissionOptions?: PermissionOptions, selectedColumns: string[] | '*' = '*'): Promise<UpdateResult>`
Batch updates multiple criteria-entity pairs in single query.

### increment
file:entity-manager/workspace-entity-manager.ts:413
`override increment<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, criteria: object, propertyPath: string, value: number | string, permissionOptions?: PermissionOptions, selectedColumns: string[] | '*' = '*'): Promise<UpdateResult>`
Increments numeric property by value.

### validatePermissions
file:entity-manager/workspace-entity-manager.ts:446
`validatePermissions<Entity extends ObjectLiteral>({target, operationType, permissionOptions, selectedColumns, updatedColumns}: {target: EntityTarget<Entity> | Entity; operationType: OperationType; permissionOptions?: {shouldBypassPermissionChecks?: boolean; objectRecordsPermissions?: ObjectsPermissions}; selectedColumns: string[]; updatedColumns?: string[]}): void`
Validates that operation is permitted on entity/columns. Throws PermissionsException if not.

### find
file:entity-manager/workspace-entity-manager.ts:495
`override find<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, options?: FindManyOptions<Entity>, permissionOptions?: PermissionOptions): Promise<Entity[]>`
Finds records with find options applied.

### findBy
file:entity-manager/workspace-entity-manager.ts:512
`override findBy<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<Entity[]>`
Finds by WHERE clause.

### findOne
file:entity-manager/workspace-entity-manager.ts:529
`override findOne<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, options: FindOneOptions<Entity>, permissionOptions?: PermissionOptions): Promise<Entity | null>`
Finds single record with full options.

### findOneBy
file:entity-manager/workspace-entity-manager.ts:561
`override findOneBy<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<Entity | null>`
Finds single record by WHERE.

### findAndCount
file:entity-manager/workspace-entity-manager.ts:582
`override findAndCount<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, options?: FindManyOptions<Entity>, permissionOptions?: PermissionOptions): Promise<[Entity[], number]>`
Returns records and total count.

### findAndCountBy
file:entity-manager/workspace-entity-manager.ts:599
`override findAndCountBy<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<[Entity[], number]>`
Finds by WHERE and returns count.

### findOneOrFail
file:entity-manager/workspace-entity-manager.ts:616
`override findOneOrFail<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, options: FindOneOptions<Entity>, permissionOptions?: PermissionOptions): Promise<Entity>`
Finds or throws EntityNotFoundError.

### findOneByOrFail
file:entity-manager/workspace-entity-manager.ts:632
`override findOneByOrFail<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<Entity>`
Finds by WHERE or throws.

### delete
file:entity-manager/workspace-entity-manager.ts:648
`override delete<Entity extends ObjectLiteral>(targetOrEntity: EntityTarget<Entity>, criteria: unknown, permissionOptions?: PermissionOptions, selectedColumns: string[] | '*' = '*'): Promise<DeleteResult>`
Hard deletes records.

### softDelete
file:entity-manager/workspace-entity-manager.ts:698
`override softDelete<Entity extends ObjectLiteral>(targetOrEntity: EntityTarget<Entity>, criteria: unknown, permissionOptions?: PermissionOptions, selectedColumns: string[] | '*' = '*'): Promise<UpdateResult>`
Soft deletes (sets deletedAt) records.

### restore
file:entity-manager/workspace-entity-manager.ts:749
`override restore<Entity extends ObjectLiteral>(targetOrEntity: EntityTarget<Entity>, criteria: unknown, permissionOptions?: PermissionOptions, selectedColumns: string[] | '*' = '*'): Promise<UpdateResult>`
Restores soft-deleted records.

### exists
file:entity-manager/workspace-entity-manager.ts:800
`override exists<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, options?: FindManyOptions<Entity>, permissionOptions?: PermissionOptions): Promise<boolean>`
Checks if records exist.

### existsBy
file:entity-manager/workspace-entity-manager.ts:820
`override existsBy<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<boolean>`
Checks if records exist by WHERE.

### count
file:entity-manager/workspace-entity-manager.ts:840
`override count<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, options?: FindManyOptions<Entity>, permissionOptions?: PermissionOptions): Promise<number>`
Counts records.

### countBy
file:entity-manager/workspace-entity-manager.ts:857
`override countBy<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, where: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<number>`
Counts by WHERE.

### sum
file:entity-manager/workspace-entity-manager.ts:907
`override sum<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, columnName: PickKeysByType<Entity, number>, where?: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<number | null>`
Sums numeric column.

### average
file:entity-manager/workspace-entity-manager.ts:922
`override average<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, columnName: PickKeysByType<Entity, number>, where?: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<number | null>`
Averages numeric column.

### minimum
file:entity-manager/workspace-entity-manager.ts:937
`override minimum<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, columnName: PickKeysByType<Entity, number>, where?: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<number | null>`
Minimizes numeric column.

### maximum
file:entity-manager/workspace-entity-manager.ts:952
`override maximum<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, columnName: PickKeysByType<Entity, number>, where?: FindOptionsWhere<Entity> | FindOptionsWhere<Entity>[], permissionOptions?: PermissionOptions): Promise<number | null>`
Maximizes numeric column.

### save
file:entity-manager/workspace-entity-manager.ts:1082
`override async save<Entity extends ObjectLiteral, T extends DeepPartialWithNestedRelationFields<Entity>>(targetOrEntity: EntityTarget<Entity> | Entity | Entity[], entityOrMaybeOptions: T | T[] | SaveOptions | (SaveOptions & { reload: false }), maybeOptionsOrMaybePermissionOptions?: PermissionOptions | SaveOptions | (SaveOptions & { reload: false }), permissionOptions?: PermissionOptions): Promise<(T & Entity) | (T & Entity)[] | Entity | Entity[]>`
Saves entities with full lifecycle: relation nested queries, files sync, event emission. Returns saved entities with restricted fields filtered.

### remove
file:entity-manager/workspace-entity-manager.ts:1441
`override async remove<Entity extends ObjectLiteral>(targetOrEntity: EntityTarget<Entity> | Entity[] | Entity, entityOrMaybeOptions: Entity | Entity[] | RemoveOptions, maybeOptionsOrMaybePermissionOptions?: RemoveOptions | PermissionOptions, permissionOptions?: PermissionOptions): Promise<Entity | Entity[]>`
Removes entities with event emission (DESTROYED action).

### softRemove
file:entity-manager/workspace-entity-manager.ts:1531
`override async softRemove<Entity extends ObjectLiteral, T extends DeepPartial<Entity>>(targetOrEntityOrEntities: Entity | Entity[] | EntityTarget<Entity>, entitiesOrMaybeOptions: T | T[] | SaveOptions, maybeOptionsOrMaybePermissionOptions?: SaveOptions | PermissionOptions, permissionOptions?: PermissionOptions): Promise<Entity | Entity[] | T | T[]>`
Soft removes entities with DELETED event emission.

### recover
file:entity-manager/workspace-entity-manager.ts:1711
`override async recover<Entity extends ObjectLiteral, T extends DeepPartial<Entity>>(targetOrEntityOrEntities: EntityTarget<Entity> | Entity | Entity[], entityOrEntitiesOrMaybeOptions: T | T[] | SaveOptions, maybeOptionsOrMaybePermissionOptions?: SaveOptions | PermissionOptions, permissionOptions?: PermissionOptions): Promise<Entity | Entity[] | T | T[]>`
Recovers soft-deleted entities with RESTORED event emission.

### preload
file:entity-manager/workspace-entity-manager.ts:981
`override async preload<Entity extends ObjectLiteral>(entityClass: EntityTarget<Entity>, entityLike: DeepPartial<Entity>, permissionOptions?: PermissionOptions): Promise<Entity | undefined>`
Preloads entity from DB and merges changes.

### decrement
file:entity-manager/workspace-entity-manager.ts:1026
`override decrement<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, criteria: object, propertyPath: string, value: number | string, permissionOptions?: PermissionOptions, selectedColumns: string[] | '*' = '*'): Promise<UpdateResult>`
Decrements numeric property.

### clear
file:entity-manager/workspace-entity-manager.ts:967
`override clear<Entity>(entityClass: EntityTarget<Entity>, permissionOptions?: PermissionOptions): Promise<void>`
Truncates table after permission check.

## Query Builders

### WorkspaceSelectQueryBuilder.getMany
file:repository/workspace-select-query-builder.ts:105
`override async getMany(options?: { noFormatting?: boolean }): Promise<T[]>`
Executes SELECT and returns formatted results. Formats composite fields and relations by object metadata.

### WorkspaceSelectQueryBuilder.getRawOne
file:repository/workspace-select-query-builder.ts:136
`override async getRawOne<U = any>(): Promise<U | undefined>`
Gets single raw result without formatting.

### WorkspaceSelectQueryBuilder.getRawMany
file:repository/workspace-select-query-builder.ts:147
`override async getRawMany<U = any>(): Promise<U[]>`
Gets multiple raw results without formatting.

### WorkspaceSelectQueryBuilder.clone
file:repository/workspace-select-query-builder.ts:59
`override clone(): this`
Clones query builder preserving permission context.

## Global Workspace DataSource / global-workspace-datasource/global-workspace-datasource.ts

### getRepository
file:global-workspace-datasource/global-workspace-datasource.ts:73
`override getRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>, permissionOptions?: RolePermissionConfig): WorkspaceRepository<Entity>`
Gets WorkspaceRepository with role-based permission configuration.

### getMetadata
file:global-workspace-datasource/global-workspace-datasource.ts:91
`override getMetadata(target: EntityTarget<ObjectLiteral>): EntityMetadata`
Returns entity metadata from workspace cache, throws if not found.

### findMetadata
file:global-workspace-datasource/global-workspace-datasource.ts:82
`override findMetadata(target: EntityTarget<ObjectLiteral>): EntityMetadata | undefined`
Finds entity metadata from workspace context, returns undefined if not found.

### createEntityManager
file:global-workspace-datasource/global-workspace-datasource.ts:101
`override createEntityManager(queryRunner?: QueryRunner): WorkspaceEntityManager`
Creates WorkspaceEntityManager instance.

### createQueryRunner
file:global-workspace-datasource/global-workspace-datasource.ts:111
`override createQueryRunner(mode = 'master' as ReplicationMode): WorkspaceQueryRunner`
Creates query runner with attached WorkspaceEntityManager.

### createQueryRunnerForEntityPersistExecutor
file:global-workspace-datasource/global-workspace-datasource.ts:124
`createQueryRunnerForEntityPersistExecutor(mode = 'master' as ReplicationMode)`
Creates query runner for internal EntityPersistExecutor without permission checks.

## Global Workspace DataSource Service / global-workspace-datasource/global-workspace-datasource.service.ts

### onModuleInit
file:global-workspace-datasource/global-workspace-datasource.service.ts:30
`async onModuleInit(): Promise<void>`
Initializes primary and replica GlobalWorkspaceDataSource instances with PostgreSQL config.

### getGlobalWorkspaceDataSource
file:global-workspace-datasource/global-workspace-datasource.service.ts:97
`public getGlobalWorkspaceDataSource(): GlobalWorkspaceDataSource`
Returns initialized primary data source, throws if not initialized.

### getGlobalWorkspaceDataSourceReplica
file:global-workspace-datasource/global-workspace-datasource.service.ts:107
`public getGlobalWorkspaceDataSourceReplica(): GlobalWorkspaceDataSource`
Returns replica data source, falls back to primary if replica not configured.

### onApplicationShutdown
file:global-workspace-datasource/global-workspace-datasource.service.ts:115
`async onApplicationShutdown(): Promise<void>`
Destroys data source connections on app shutdown.

## ORM Entity Metadatas Cache Service / workspace-orm-entity-metadatas-cache.service.ts

### computeForCache
file:global-workspace-datasource/workspace-orm-entity-metadatas-cache.service.ts:34
`async computeForCache(workspaceId: string): Promise<EntityMetadata[]>`
Builds entity metadatas from object and field metadata. Creates EntitySchemas then builds TypeORM EntityMetadata.

## Files Field Sync / field-operations/files-field-sync/files-field-sync.ts

### computeFilesFieldDiffBeforeUpsert
file:field-operations/files-field-sync/files-field-sync.ts:177
`computeFilesFieldDiffBeforeUpsert<Entity extends ObjectLiteral>(entities: QueryDeepPartialEntity<Entity>[], target: EntityTarget<Entity>, beforeUpdateMapById: Record<string, ObjectLiteral>): FilesFieldDiffByEntityIndex | null`
Computes file additions/updates/removals for upsert operation.

### enrichFilesFields
file:field-operations/files-field-sync/files-field-sync.ts:250
`async enrichFilesFields({entities, filesFieldDiffByEntityIndex, workspaceId, target}: {entities: QueryDeepPartialEntity<Entity>[]; filesFieldDiffByEntityIndex: FilesFieldDiffByEntityIndex; workspaceId: string; target: EntityTarget<Entity>}): Promise<{entities: QueryDeepPartialEntity<Entity>[]; fileIds: string[]}>`
Creates File entities and updates entities with file IDs. Returns updated entities and file IDs.

### updateFileEntityRecords
file:field-operations/files-field-sync/files-field-sync.ts:343
`async updateFileEntityRecords(fileIds: string[]): Promise<void>`
Updates File entities with synced status after successful upsert.

## Relation Nested Queries / field-operations/relation-nested-queries/relation-nested-queries.ts

### prepareNestedRelationQueries
file:field-operations/relation-nested-queries/relation-nested-queries.ts:38
`prepareNestedRelationQueries<Entity extends ObjectLiteral>(entities: QueryDeepPartialEntityWithNestedRelationFields<Entity>[] | QueryDeepPartialEntityWithNestedRelationFields<Entity>, target: EntityTarget<Entity>): [RelationConnectQueryConfig[], RelationDisconnectQueryFieldsByEntityIndex] | null`
Extracts nested relation connect/disconnect fields from entities.

### processRelationNestedQueries
file:field-operations/relation-nested-queries/relation-nested-queries.ts:87
`async processRelationNestedQueries<Entity extends ObjectLiteral>({entities, relationNestedConfig, queryBuilder}: {entities: QueryDeepPartialEntityWithNestedRelationFields<Entity>[] | QueryDeepPartialEntityWithNestedRelationFields<Entity>; relationNestedConfig: [RelationConnectQueryConfig[], RelationDisconnectQueryFieldsByEntityIndex]; queryBuilder: WorkspaceSelectQueryBuilder<Entity> | SelectQueryBuilder<Entity>}): Promise<QueryDeepPartialEntity<Entity>[]>`
Executes relation connect/disconnect queries and returns updated entities.

## Utilities / utils

### formatData
file:utils/format-data.util.ts:18
`function formatData<T>(data: T, flatObjectMetadata: FlatObjectMetadata, flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>, fieldMapsForObject?: FieldMapsForObject): T`
Transforms incoming data before DB write: explodes composite fields (e.g., address) into columns, parses JSON.

### formatCompositeField
file:utils/format-data.util.ts:75
`function formatCompositeField(value: any, fieldMetadata: FlatFieldMetadata): Record<string, any>`
Explodes composite field object into prefixed columns (e.g., {city: 'NYC'} -> {addressCity: 'NYC'}).

### formatResult
file:utils/format-result.util.ts:29
`function formatResult<T>(data: any, flatObjectMetadata: FlatObjectMetadata | undefined, flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>, flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>, fieldMapsForObject?: FieldMapsForObject): T`
Transforms DB result to API response: reassembles composite fields, formats dates, resolves relations recursively.

### validateOperationIsPermittedOrThrow
file:repository/permissions.utils.ts:84
`function validateOperationIsPermittedOrThrow({entityName, operationType, objectsPermissions, flatObjectMetadataMaps, flatFieldMetadataMaps, objectIdByNameSingular, selectedColumns, allFieldsSelected, updatedColumns}: ValidateOperationIsPermittedOrThrowArgs): void`
Validates CRUD operation against object and field permissions. Throws PermissionsException if denied.

### validateQueryIsPermittedOrThrow
file:repository/permissions.utils.ts:171
`export function validateQueryIsPermittedOrThrow({expressionMap, flatObjectMetadataMaps, flatFieldMetadataMaps, shouldBypassPermissionChecks, objectsPermissions, objectIdByNameSingular}: ValidateQueryIsPermittedOrThrowArgs): void`
Validates custom query builder operations against permissions.

### applyRowLevelPermissionPredicates
file:utils/apply-row-level-permission-predicates.util.ts:23
`function applyRowLevelPermissionPredicates(queryBuilder: SelectQueryBuilder<T>, internalContext: WorkspaceInternalContext, shouldBypassPermissionChecks: boolean): SelectQueryBuilder<T>`
Adds WHERE predicates to enforce row-level permissions based on user roles.

### isRecordMatchingRLSRowLevelPermissionPredicate
file:utils/is-record-matching-rls-row-level-permission-predicate.util.ts:5
`function isRecordMatchingRLSRowLevelPermissionPredicate(record: any, predicate: RowLevelPermissionPredicateWithTarget): boolean`
Checks if single record matches RLS predicate conditions.

### validateRLSPredicatesForRecords
file:utils/validate-rls-predicates-for-records.util.ts:15
`function validateRLSPredicatesForRecords(records: any[], predicates: RowLevelPermissionPredicateWithTarget[]): {invalid: any[]; valid: any[]}`
Partitions records into valid/invalid based on RLS predicate matching.

### buildRowLevelPermissionRecordFilter
file:utils/build-row-level-permission-record-filter.util.ts:17
`function buildRowLevelPermissionRecordFilter(predicates: RowLevelPermissionPredicateWithTarget[]): {sqlAnd: Brackets; sqlOr: Brackets}`
Builds SQL AND/OR branches from RLS predicates for query WHERE clause.

### computeRelationConnectQueryConfigs
file:utils/compute-relation-connect-query-configs.util.ts:21
`function computeRelationConnectQueryConfigs(entities: QueryDeepPartialEntityWithNestedRelationFields<Entity>[], objectMetadata: FlatObjectMetadata, flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>, flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>, flatIndexMaps: FlatEntityMaps<any>, relationConnectQueryFieldsByEntityIndex: RelationConnectQueryFieldsByEntityIndex): RelationConnectQueryConfig[]`
Computes relation connect configurations from nested relation data.

### extractNestedRelationFieldsByEntityIndex
file:utils/extract-nested-relation-fields-by-entity-index.util.ts:8
`function extractNestedRelationFieldsByEntityIndex(entities: QueryDeepPartialEntityWithNestedRelationFields<Entity>[]): {relationConnectQueryFieldsByEntityIndex: RelationConnectQueryFieldsByEntityIndex; relationDisconnectQueryFieldsByEntityIndex: RelationDisconnectQueryFieldsByEntityIndex}`
Extracts nested connect/disconnect relation fields per entity.

### computePermissionIntersection
file:utils/compute-permission-intersection.util.ts:6
`function computePermissionIntersection(permissionsArray: ObjectsPermissions[]): ObjectsPermissions`
Computes intersection of multiple permission sets for multi-role queries.

### getObjectMetadataFromEntityTarget
file:utils/get-object-metadata-from-entity-target.util.ts:12
`function getObjectMetadataFromEntityTarget(target: EntityTarget<Entity>, internalContext: WorkspaceInternalContext): FlatObjectMetadata`
Looks up object metadata from entity class/name.

### formatTwentyOrmEventToDatabaseBatchEvent
file:utils/format-twenty-orm-event-to-database-batch-event.util.ts:12
`function formatTwentyOrmEventToDatabaseBatchEvent({action, objectMetadataItem, flatFieldMetadataMaps, workspaceId, recordsAfter, recordsBefore}: FormatTwentyOrmEventToDatabaseBatchEventArgs): DatabaseBatchEvent`
Converts ORM save/update/delete to database batch event for subscribers.

## Factories

### EntitySchemaFactory.create
file:factories/entity-schema.factory.ts:22
`create(workspaceId: string, objectMetadata: EntitySchemaObjectMetadata, objectMetadataMaps: EntitySchemaObjectMetadataMaps, fieldMetadataMaps: EntitySchemaFieldMetadataMaps): EntitySchema`
Creates TypeORM EntitySchema from object and field metadata with columns and relations.

### EntitySchemaColumnFactory.create
file:factories/entity-schema-column.factory.ts:22
`create(objectMetadata: EntitySchemaObjectMetadata, fieldMetadataMaps: EntitySchemaFieldMetadataMaps): ColumnMetadata[]`
Creates column metadata for all fields including composites expanded to columns.

### EntitySchemaRelationFactory.create
file:factories/entity-schema-relation.factory.ts:16
`create(objectMetadata: EntitySchemaObjectMetadata, objectMetadataMaps: EntitySchemaObjectMetadataMaps, fieldMetadataMaps: EntitySchemaFieldMetadataMaps): RelationMetadata[]`
Creates relation metadata mapping one-to-many/many-to-one fields to foreign keys.

## Workspace Schema Manager / workspace-schema-manager

### WorkspaceSchemaManagerService
file:workspace-schema-manager/workspace-schema-manager.service.ts:10
NestJS service aggregating table, column, index, enum, and foreign key managers for DDL operations.

### WorkspaceSchemaColumnManagerService.createColumn
file:workspace-schema-manager/services/workspace-schema-column-manager.service.ts:30
`async createColumn(workspaceId: string, objectMetadata: ObjectMetadataEntity, fieldMetadata: FieldMetadataEntity): Promise<void>`
Adds column to workspace table with type/default/constraints from field metadata.

### WorkspaceSchemaColumnManagerService.alterColumnType
file:workspace-schema-manager/services/workspace-schema-column-manager.service.ts:98
`async alterColumnType(workspaceId: string, objectMetadata: ObjectMetadataEntity, fieldMetadata: FieldMetadataEntity): Promise<void>`
Changes column data type with migration.

### WorkspaceSchemaIndexManagerService.createIndex
file:workspace-schema-manager/services/workspace-schema-index-manager.service.ts:27
`async createIndex(workspaceId: string, index: WorkspaceSchemaIndexDefinition): Promise<void>`
Creates database index on columns.

### WorkspaceSchemaTableManagerService.createTable
file:workspace-schema-manager/services/workspace-schema-table-manager.service.ts:28
`async createTable(workspaceId: string, objectMetadata: ObjectMetadataEntity): Promise<void>`
Creates new workspace table with id/createdAt/updatedAt/deletedAt columns.

## Workspace Scoped Repository / workspace-scoped-repository/workspace-scoped-repository.ts

### findOne
file:workspace-scoped-repository/workspace-scoped-repository.ts:24
`findOne(workspaceId: string, options: FindOneOptions<T>): Promise<T | null>`
Finds single record scoped to workspace.

### find
file:workspace-scoped-repository/workspace-scoped-repository.ts:53
`find(workspaceId: string, options?: FindManyOptions<T>): Promise<T[]>`
Finds records scoped to workspace.

### count
file:workspace-scoped-repository/workspace-scoped-repository.ts:62
`count(workspaceId: string, options?: FindManyOptions<T>): Promise<number>`
Counts records in workspace.

### update
file:workspace-scoped-repository/workspace-scoped-repository.ts:116
`update(workspaceId: string, criteria: FindOptionsWhere<T>, partialEntity: QueryDeepPartialEntity<T>): Promise<UpdateResult>`
Updates records in workspace by criteria.

### delete
file:workspace-scoped-repository/workspace-scoped-repository.ts:159
`delete(workspaceId: string, criteria: FindOptionsWhere<T>): Promise<DeleteResult>`
Hard deletes records in workspace.

### softDelete
file:workspace-scoped-repository/workspace-scoped-repository.ts:170
`softDelete(workspaceId: string, criteria: FindOptionsWhere<T>): Promise<UpdateResult>`
Soft deletes records in workspace.

### insert
file:workspace-scoped-repository/workspace-scoped-repository.ts:189
`insert(workspaceId: string, entity: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[]): Promise<InsertResult>`
Inserts entities with workspace scoping.

### save
file:workspace-scoped-repository/workspace-scoped-repository.ts:213
`save<E extends DeepPartial<T>>(workspaceId: string, entity: E, options?: SaveOptions): Promise<E & T>`
Saves single entity scoped to workspace.

### saveMany
file:workspace-scoped-repository/workspace-scoped-repository.ts:223
`saveMany<E extends DeepPartial<T>>(workspaceId: string, entities: E[], options?: SaveOptions): Promise<(E & T)[]>`
Saves multiple entities scoped to workspace.

### createQueryBuilder
file:workspace-scoped-repository/workspace-scoped-repository.ts:237
`createQueryBuilder(alias?: string): SelectQueryBuilder<T>`
Creates query builder (caller must add workspaceId WHERE predicate).

### withManager
file:workspace-scoped-repository/workspace-scoped-repository.ts:242
`withManager(manager: EntityManager): WorkspaceScopedRepository<T>`
Returns new repository bound to transaction manager.

## Storage & Context

### getWorkspaceContext
file:storage/orm-workspace-context.storage.ts:15
`function getWorkspaceContext(): WorkspaceContextType`
Retrieves workspace auth context, entity metadatas, and flat metadata maps from async local storage.

### PromiseMemoizer
file:storage/promise-memoizer.storage.ts:1
`class PromiseMemoizer<T>`
Caches promise result to prevent redundant async operations within same request.

## Exceptions & Error Handling

### TwentyORMException
file:exceptions/twenty-orm.exception.ts:5
`class TwentyORMException extends Error`
Custom error class for ORM-specific errors with error codes (INVALID_INPUT, PERMISSION_DENIED, etc).

### computeTwentyORMException
file:error-handling/compute-twenty-orm-exception.ts:8
`async function computeTwentyORMException(error: any, objectMetadata?: FlatObjectMetadata, manager?: WorkspaceEntityManager, internalContext?: WorkspaceInternalContext): Promise<Error>`
Converts TypeORM and DB errors to TwentyORMException with user-friendly messages.

## Upgrade-Aware Repository

### UpgradeAwareRepositoryProxy
file:upgrade-aware/upgrade-aware-repository.proxy.ts:11
`class UpgradeAwareRepositoryProxy<T extends ObjectLiteral>`
Proxy intercepting repository operations during migrations to allow staged schema changes.

### installUpgradeAwareRepositoryProxy
file:upgrade-aware/install-upgrade-aware-repository-proxy.ts:11
`function installUpgradeAwareRepositoryProxy(manager: WorkspaceEntityManager, state: UpgradeAwareRepositoryState): WorkspaceEntityManager`
Patches entity manager with upgrade-aware proxy during instance command execution.

## Write Query Builders (mutation lifecycle)

These four builders all extend TypeORM's native query builders, wrap them with the workspace permission context (`objectRecordsPermissions`, `shouldBypassPermissionChecks`, `internalContext`, `authContext`, `featureFlagMap`), and share the same shape: a `clone()` that re-wraps, a private `getMainAliasTarget()` that throws `MISSING_MAIN_ALIAS_TARGET` if absent, and morph-blockers (`select`/`update`/`delete`/`softDelete`/`restore`/`insert`) that throw `METHOD_NOT_ALLOWED` so a builder cannot change query type. All wrap `execute()` in try/catch routing errors through `computeTwentyORMException`.

### WorkspaceInsertQueryBuilder
`file:repository/workspace-insert-query-builder.ts:37`
`class WorkspaceInsertQueryBuilder<T> extends InsertQueryBuilder<T>`
INSERT builder with relation-connect, files-field sync, RLS and event emission. Lazily builds `RelationNestedQueries`/`FilesFieldSync` from `internalContext`.

### WorkspaceInsertQueryBuilder.values
`file:repository/workspace-insert-query-builder.ts:91`
`override values(values: QueryDeepPartialEntityWithNestedRelationFields<T> | [...]): this`
Extracts nested relation connect/disconnect config via `prepareNestedRelationQueries`, then runs `formatData` to explode composite fields into columns before delegating to `super.values`.

### WorkspaceInsertQueryBuilder.execute
`file:repository/workspace-insert-query-builder.ts:118`
`override async execute(): Promise<InsertResult>`
Validates query permissions; patches `onUpdate.overwrite` to include composite columns missing after `formatData`; computes/enriches files-field diff (creates File rows, rewrites valuesSet with file ids); processes relation connect queries; runs `validateRLSPredicatesForInsert`; executes; re-selects inserted rows by id (bypassing perms) to emit `CREATED` + `UPSERTED` database batch events; filters TypeORM's extra returned columns down to `returning`, returns formatted result.

### WorkspaceInsertQueryBuilder.validateRLSPredicatesForInsert (private)
`file:repository/workspace-insert-query-builder.ts:321`
Formats the to-insert values and runs `validateRLSPredicatesForRecords` so a user cannot insert rows that fall outside their role's row-level predicates.

### WorkspaceUpdateQueryBuilder
`file:repository/workspace-update-query-builder.ts:44`
`class WorkspaceUpdateQueryBuilder<T> extends UpdateQueryBuilder<T>`
UPDATE builder supporting both single-criteria and batch (`manyInputs`) updates with relation/file sync, RLS and events.

### WorkspaceUpdateQueryBuilder.set
`file:repository/workspace-update-query-builder.ts:518`
`override set(values: ...): this`
Prepares nested relation queries from the update payload then `formatData`-formats the set values (composite explosion) before `super.set`.

### WorkspaceUpdateQueryBuilder.execute
`file:repository/workspace-update-query-builder.ts:104`
`override async execute(): Promise<UpdateResult>`
If `manyInputs` is set, delegates to `executeMany`. Otherwise: validates perms; selects "before" records (capped at `QUERY_MAX_RECORDS`, else throws `TOO_MANY_RECORDS_TO_UPDATE`); applies table-alias on wheres; computes file-field diff for single update; processes relation connects; applies RLS predicates to the WHERE; validates merged (before+set) records against RLS; executes; re-selects "after" records and emits `UPDATED` + `UPSERTED` events; returns formatted result.

### WorkspaceUpdateQueryBuilder.executeMany
`file:repository/workspace-update-query-builder.ts:303`
`public async executeMany(): Promise<UpdateResult>`
Batch path: validates each criteria/partialEntity pair with a synthetic expressionMap; selects before-records by ids; computes file diff and relation connects across all inputs; loops each input setting valuesSet + `where({id})`, applying RLS predicate + per-record RLS validation, executing one UPDATE each; collects results, emits `UPDATED`/`UPSERTED`, returns combined formatted result with `affected = inputs.length`.

### WorkspaceUpdateQueryBuilder.setManyInputs
`file:repository/workspace-update-query-builder.ts:600`
`public setManyInputs(inputs: {criteria; partialEntity}[]): this`
Stores batch inputs, formatting each `partialEntity` via `formatData`. Marks the builder to take the `executeMany` path.

### WorkspaceDeleteQueryBuilder
`file:repository/workspace-delete-query-builder.ts:35`
`class WorkspaceDeleteQueryBuilder<T> extends DeleteQueryBuilder<T>`
Hard-DELETE builder with RLS and `DESTROYED` event emission.

### WorkspaceDeleteQueryBuilder.execute
`file:repository/workspace-delete-query-builder.ts:74`
`override async execute(): Promise<DeleteResult & { generatedMaps: T[] }>`
Applies RLS predicates to the WHERE (unless bypassing); validates perms; builds an event-select query and fetches the single "before" record; rewrites wheres with the real table alias; executes the delete; emits a `DESTROYED` batch event with `recordsBefore`; returns formatted raw + generatedMaps.

### WorkspaceDeleteQueryBuilder.applyRowLevelPermissionPredicates (private)
`file:repository/workspace-delete-query-builder.ts:173`
Short-circuits when bypassing; otherwise calls the shared `applyRowLevelPermissionPredicates` util scoped to the main object metadata.

### WorkspaceSoftDeleteQueryBuilder
`file:repository/workspace-soft-delete-query-builder.ts:33`
`class WorkspaceSoftDeleteQueryBuilder<T> extends SoftDeleteQueryBuilder<T>`
Soft-delete/restore builder. Used for both `softDelete` and `restore` (distinguished by `expressionMap.queryType`).

### WorkspaceSoftDeleteQueryBuilder.execute
`file:repository/workspace-soft-delete-query-builder.ts:73`
`override async execute(): Promise<UpdateResult>`
Applies RLS predicates + perm validation; fetches before-records; rewrites wheres with table alias; executes; re-fetches after-records (with all fields, since native soft-remove only returns id); emits `RESTORED` when `queryType === 'restore'` else `DELETED`; returns formatted after-records.

## Schema Manager — Enum & Foreign Key DDL

### WorkspaceSchemaEnumManagerService.createEnum
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:16`
`async createEnum({queryRunner, schemaName, enumName, values}): Promise<void>`
`CREATE TYPE … AS ENUM (...)`; throws `ENUM_OPERATION_FAILED` if no values. Identifiers/literals escaped against injection.

### WorkspaceSchemaEnumManagerService.dropEnum
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:43`
`async dropEnum({queryRunner, schemaName, enumName}): Promise<void>`
`DROP TYPE IF EXISTS …`.

### WorkspaceSchemaEnumManagerService.renameEnum
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:57`
`async renameEnum({queryRunner, schemaName, oldEnumName, newEnumName}): Promise<void>`
`ALTER TYPE … RENAME TO …`.

### WorkspaceSchemaEnumManagerService.addEnumValue
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:73`
`async addEnumValue({queryRunner, schemaName, enumName, value, beforeValue?, afterValue?}): Promise<void>`
`ALTER TYPE … ADD VALUE …` optionally positioned `BEFORE`/`AFTER` an existing value.

### WorkspaceSchemaEnumManagerService.renameEnumValue
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:99`
`async renameEnumValue({queryRunner, schemaName, enumName, oldValue, newValue}): Promise<void>`
`ALTER TYPE … RENAME VALUE … TO …`.

### WorkspaceSchemaEnumManagerService.alterEnumValues
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:117`
`async alterEnumValues({queryRunner, schemaName, tableName, columnDefinition, enumValues, oldToNewEnumOptionMap}): Promise<void>`
Full enum rebuild in a (possibly nested) transaction: renames the old enum to `_old`, creates the new enum, renames the column to `_old`, adds a new column of the new enum type, migrates data via `migrateEnumData`, drops the old column/enum, commits (rolls back on error). This is how select-option edits propagate to live data.

### WorkspaceSchemaEnumManagerService.migrateEnumData (private)
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:284`
Builds a `CASE … WHEN old THEN new::newType` mapping from `oldToNewEnumOptionMap` and dispatches to `updateArrayEnum` (array columns, uses `unnest`/`array_agg`) or `updateAtomicEnum` (scalar columns) to copy mapped values from the old column to the new one.

### WorkspaceSchemaEnumManagerService.updateArrayEnum / updateAtomicEnum (private)
`file:workspace-schema-manager/services/workspace-schema-enum-manager.service.ts:346` / `:379`
Return the SQL strings for the array vs atomic enum-column data migration described above.

### WorkspaceSchemaForeignKeyManagerService.createForeignKey
`file:workspace-schema-manager/services/workspace-schema-foreign-key-manager.service.ts:15`
`async createForeignKey({queryRunner, schemaName, foreignKey}): Promise<void>`
Computes the FK constraint name via TypeORM `namingStrategy.foreignKeyName`, builds `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY (...) REFERENCES …`, appending validated `ON DELETE`/`ON UPDATE` actions (only `CASCADE`, `SET NULL`, `RESTRICT`, `NO ACTION`, `SET DEFAULT` allowed, else throws).

### WorkspaceSchemaForeignKeyManagerService.dropForeignKey
`file:workspace-schema-manager/services/workspace-schema-foreign-key-manager.service.ts:50`
`async dropForeignKey({queryRunner, schemaName, tableName, foreignKeyName}): Promise<void>`
`ALTER TABLE … DROP CONSTRAINT IF EXISTS …`.

### WorkspaceSchemaForeignKeyManagerService.setForeignKeyDeferrable / setForeignKeyNotDeferrable
`file:workspace-schema-manager/services/workspace-schema-foreign-key-manager.service.ts:82` / `:66`
`ALTER TABLE … ALTER CONSTRAINT … DEFERRABLE` / `NOT DEFERRABLE`. Used to defer FK checks during bulk operations.

### WorkspaceSchemaForeignKeyManagerService.getForeignKeyName
`file:workspace-schema-manager/services/workspace-schema-foreign-key-manager.service.ts:98`
`async getForeignKeyName({queryRunner, schemaName, tableName, columnName}): Promise<string | undefined>`
Parameterized query against `information_schema` joining `table_constraints` + `key_column_usage` to resolve the existing FK constraint name for a column.

## Upgrade-Aware Layer

The upgrade-aware layer lets the running app keep TypeORM entity metadata consistent with a partially-applied upgrade sequence (so a deploy mid-migration reads/writes the schema that actually exists on disk).

### UpgradeAwareEntityMetadataAdapter
`file:upgrade-aware/upgrade-aware-entity-metadata.adapter.ts:34`
`class UpgradeAwareEntityMetadataAdapter implements OnModuleInit`
NestJS service that, on init, reads the upgrade sequence, validates `@upgradeAware` decorators against it, captures canonical metadata snapshots, computes the current "cursor" (how far the sequence has been applied) and mutates `coreDataSource.entityMetadatas` to match. Registers itself on the `UpgradeAwareRepositoryState` singleton.

### UpgradeAwareEntityMetadataAdapter.refresh
`file:upgrade-aware/upgrade-aware-entity-metadata.adapter.ts:84`
`async refresh(): Promise<void>`
Reads the last attempted instance command, maps it to a sequence index, derives `nextCursor` (index+1 if completed, else index, 0 if unknown), and re-applies metadata if the cursor moved.

### UpgradeAwareEntityMetadataAdapter.isEntityAvailable / getHiddenColumnPropertyNames
`file:upgrade-aware/upgrade-aware-entity-metadata.adapter.ts:110` / `:114`
Return per-entity availability and the set of column property names hidden at the current cursor (used by the proxy to short-circuit reads/writes and strip columns).

### UpgradeAwareEntityMetadataAdapter (private helpers)
`file:upgrade-aware/upgrade-aware-entity-metadata.adapter.ts:118`
`captureCanonicalSnapshots` stores each entity's table name/path and per-column select/insert/update flags in a WeakMap; `applyCursorToMetadata`/`applyCursorToEntity` resolve the effective shape at the cursor via `resolveEntityShapeAtUpgradeCursor` and rewrite table name, column database names, select/insert/update flags, and filter out hidden columns; `validateDecoratorsAgainstSequence` throws if decorator step names don't line up with the sequence.

### wrapRepositoryWithUpgradeAwareProxy
`file:upgrade-aware/upgrade-aware-repository.proxy.ts:192`
`({repository, entityClass, state}) => Repository<Entity>`
Returns a `Proxy` over a repository: read methods (`find*`/`count*`/`exists*`) short-circuit to empty results (or `EntityNotFoundError` for `*OrFail`) when the entity is unavailable at the cursor; write methods throw `UpgradeUnavailableEntityWriteException`; find-option methods get unavailable relations stripped from their `relations` option via `stripUnavailableRelations`. `REPOSITORY_METHOD_BEHAVIORS` maps each method to its behavior.

### installUpgradeAwareRepositoryProxy
`file:upgrade-aware/install-upgrade-aware-repository-proxy.ts:18`
`(dataSource: DataSource) => void`
Monkey-patches `DataSource.getRepository` and `EntityManager.prototype.getRepository` so every repository fetched from the core data source is wrapped with the upgrade-aware proxy (cached per repository instance in a WeakMap).

### UpgradeAwareRepositoryState
`file:upgrade-aware/upgrade-aware-repository-state.ts:5`
`class UpgradeAwareRepositoryState`
Process-wide singleton holding the (optional) `UpgradeAwareEntityMetadataAdapter`. `isEntityAvailable`/`getHiddenColumnPropertyNames` defer to it, defaulting to "available / nothing hidden" before the adapter is registered.

## Row-Level Security Utilities

### applyRowLevelPermissionPredicates
`file:utils/apply-row-level-permission-predicates.util.ts:28`
`<T>({queryBuilder, objectMetadata, internalContext, authContext, featureFlagMap}): void`
Resolves the caller's roleId from `userWorkspaceRoleMap`, builds the RLS record filter, and if non-empty injects it into the query builder's WHERE as TypeORM `Brackets`/`NotBrackets`. The internal `parseKeyFilter` recursively translates `and`/`or`/`not` filter groups and delegates leaf fields to `GraphqlQueryFilterFieldParser`. Uses direct table reference for update/delete/soft-delete query types.

### validateRLSPredicatesForRecords
`file:utils/validate-rls-predicates-for-records.util.ts:27`
`<T>({records, objectMetadata, internalContext, authContext, shouldBypassPermissionChecks, errorMessage?}): void`
For write paths: resolves roleId, builds the RLS record filter, then checks each record with `isRecordMatchingRLSRowLevelPermissionPredicate`; throws `RLS_VALIDATION_FAILED` if any record would violate the role's predicates. Skips when bypassing or when no role/filter.

### buildRowLevelPermissionRecordFilter
`file:utils/build-row-level-permission-record-filter.util.ts:43`
`(args) => RecordGqlOperationFilter | null`
Collects the role's non-deleted predicates for the object, resolving each predicate's value (literal, or a workspace-member field value when `workspaceMemberFieldMetadataId` is set, including composite subfields and SELECT/MULTI_SELECT array wrapping, validated via `validateEnumValueCompatibility`). Walks predicate-group parent chains to gather relevant groups, maps logical operators, and returns a `computeRecordGqlOperationFilter` filter usable by the query parser. Returns null when no role or no predicates.

### isRecordMatchingRLSRowLevelPermissionPredicate
`file:utils/is-record-matching-rls-row-level-permission-predicate.util.ts:77`
`({record, filter, flatObjectMetadata, flatFieldMetadataMaps}): boolean`
In-memory evaluation of a record against an RLS filter — mirrors the SQL `applyRowLevelPermissionPredicates` logic so writes can be validated without a round-trip. Recursively evaluates and/or/not groups and per-field operands across all field types.

### validateEnumValueCompatibility
`file:utils/validate-enum-value-compatibility.util.ts:12`
`({workspaceMemberFieldMetadata, targetFieldMetadata, predicateValue}): boolean`
When both fields are SELECT/MULTI_SELECT, returns whether every predicate value is among the target field's defined option values (otherwise true — non-enum or empty-options cases are always compatible). Prevents building a filter from an incompatible workspace-member enum value.

### resolveRolePermissionConfig
`file:utils/resolve-role-permission-config.util.ts:11`
`({authContext, userWorkspaceRoleMap, apiKeyRoleMap}): RolePermissionConfig | null`
Maps an auth context to a permission config: system → `{shouldBypassPermissionChecks:true}`; api-key/application/user → `{intersectionOf:[roleId]}` resolved from the relevant role map; null when no role can be resolved.

### computeEventSelectQueryBuilder
`file:utils/compute-event-select-query-builder.util.ts:28`
`<T>({queryBuilder, authContext, internalContext, featureFlagMap, expressionMap, objectRecordsPermissions}): WorkspaceSelectQueryBuilder<T>`
Builds a permission-bypassing SELECT builder that mirrors a write builder's wheres/aliases/parameters, defaulting selects to the main alias. Used by the update/delete builders to capture before/after snapshots for event emission.

### buildSystemAuthContext
`file:utils/build-system-auth-context.util.ts:7`
`(workspaceId: string) => SystemWorkspaceAuthContext`
Builds a minimal system auth context (jobs/commands/crons) carrying only the workspace id, with permission checks bypassed downstream.

## Relation-Connect Configuration

### computeRelationConnectQueryConfigs
`file:utils/compute-relation-connect-query-configs.util.ts:37`
`(entities, flatObjectMetadata, flatObjectMetadataMaps, flatFieldMetadataMaps, flatIndexMaps, relationConnectQueryFieldsByEntityIndex) => RelationConnectQueryConfig[]`
For each entity's `connect:{where}` fields, validates the field is a MANY_TO_ONE relation/morph-relation (else throws `CONNECT_NOT_ALLOWED`), resolves the target object, ensures at least one unique constraint is fully populated (`checkUniqueConstraintFullyPopulated`, else `CONNECT_UNIQUE_CONSTRAINT_ERROR`), and aggregates per-field connect conditions into `RelationConnectQueryConfig`s. Helper `checkNoRelationFieldConflictOrThrow` forbids passing both `field` and `fieldId`; `computeUniqueConstraintCondition` explodes composite unique fields; `checkUniqueConstraintsAreSameOrThrow` enforces the same constraint fields across all entities in a batch.

## NOT YET COVERED

Remaining items are small leaf utilities and type/exception declarations whose behavior is fully implied by the functions above:
- Column-name mapping helpers (`utils/get-column-name-*.util.ts`, `utils/format-column-name*.util.ts`, `utils/process-field-metadata-for-column-name-mapping.util.ts`)
- Misc small utils (`convert-relation-type-to-typeorm-relation-type`, `create-sql-where-tuple-in-clause`, `determine-schema-relation-details`, `get-default-columns-for-index`, `get-composite-field-metadata-collection`, `get-subfields-for-aggregate-operation`, `get-record-to-connect-fields`)
- Type/definition files under `workspace-schema-manager/types/*` and `*.exception.ts` declarations

