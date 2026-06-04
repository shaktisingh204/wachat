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

## NOT YET COVERED

The following files contain significant code that was not fully documented due to length constraints:

- repository/workspace-insert-query-builder.ts (403 lines) - INSERT query builder with relation/file handling
- repository/workspace-delete-query-builder.ts (236 lines) - DELETE query builder with RLS
- repository/workspace-soft-delete-query-builder.ts (222 lines) - SOFT DELETE query builder
- workspace-schema-manager/services/workspace-schema-enum-manager.service.ts (403 lines) - ENUM type management
- workspace-schema-manager/services/workspace-schema-foreign-key-manager.service.ts (131 lines) - Foreign key DDL
- utils/is-record-matching-rls-row-level-permission-predicate.util.ts (444 lines) - Complex RLS evaluation
- factories/entity-schema-column.factory.ts (157 lines) - Detailed column metadata construction
- utils/compute-relation-connect-query-configs.util.ts (347 lines) - Relation config computation
- upgrade-aware/upgrade-aware-entity-metadata.adapter.ts (369 lines) - Metadata adaptation during upgrade
- field-operations/files-field-sync/files-field-sync.ts (641 lines) - Detailed files sync logic
- utils/format-twenty-orm-event-to-database-batch-event.util.ts (268 lines) - Event formatting
- utils/format-result.util.ts (395 lines) - Detailed result formatting with composite fields
- utils/apply-row-level-permission-predicates.util.ts (250 lines) - RLS predicate application
- utils/validate-rls-predicates-for-records.util.ts (82 lines) - Record RLS validation
- utils/build-row-level-permission-record-filter.util.ts (228 lines) - RLS filter SQL generation

