# Engine API GraphQL

This document comprehensively documents all exported functions, services, resolvers, and utilities in the `engine/api/graphql` module - the core GraphQL API execution and schema building system for Twenty.

## Direct Execution Service

### direct-execution.service.ts

### DirectExecutionService
`file:direct-execution/direct-execution.service.ts:80`
Service that directly executes GraphQL queries and mutations against workspace objects. Manages factory resolution and argument assertion for all CRUD operations (findMany, findOne, create, update, delete, destroy, restore, merge, groupBy, findDuplicates).

**Methods:**
- `constructor(...)` — Initializes 15 resolver factories and 15 assertion maps for method dispatch.
- `getWorkspaceResolverNames(workspaceId: string): Promise<Set<string> | null>` — Retrieves cached resolver name map for a workspace, returns set of available resolver names.
- `execute(req: Request, document: DocumentNode, hasIntrospectionFields: boolean, hasWorkspaceFields: boolean): Promise<DirectExecutionResult | null>` — Main entry point; parallelizes introspection and workspace query execution, merges results.
- `executeWorkspaceQuery(req: Request, document: DocumentNode): Promise<DirectExecutionResult | null>` — Executes workspace queries by extracting top-level fields, building context, and delegating to factories.
- `executeIntrospectionQuery(req: Request, document: DocumentNode): Promise<DirectExecutionResult | null>` — Executes GraphQL introspection queries using SDL schema built by WorkspaceGraphqlSchemaSDLService.
- `mergeDirectExecutionResults(introspectionResult, workspaceResult): DirectExecutionResult | null` — Combines introspection and workspace results into single response.
- `executeField({entry, args, graphqlPartialResolveInfo, workspaceSchemaBuilderContext}): Promise<unknown>` — Dispatches to appropriate factory based on entry.method, validates args, creates resolver.
- `formatError(error: unknown, req: Request): GraphQLFormattedError` — Converts errors to GraphQL format, applies i18n for user-friendly messages.
- `checkRootResolverLimitsOrThrow(topLevelFields: FieldNode[]): void` — Validates root resolver count against config limits and checks for duplicates.

## GraphQL Configuration

### graphql-config.service.ts

### GraphQLConfigService
`file:graphql-config/graphql-config.service.ts:37`
Implements `GqlOptionsFactory` to create Yoga GraphQL driver configuration. Configures plugins for error handling, direct execution, introspection, query complexity validation, and Sentry tracing.

**Methods:**
- `createGqlOptions(): YogaDriverConfig` — Returns configured GraphQL Yoga driver config with plugins, resolvers (JSON scalar), context loaders, and playground rendering.

## Workspace Resolver Builder

### workspace-resolver-builder.service.ts

### WorkspaceResolverBuilderService
`file:workspace-resolver-builder/workspace-resolver-builder.service.ts:12`
Determines which resolvers should be built for a given object metadata. Conditionally builds findDuplicates and mergeMany only if duplicateCriteria is defined.

**Methods:**
- `shouldBuildResolver(objectMetadata: Pick<ObjectMetadataEntity, 'duplicateCriteria'>, methodName: WorkspaceResolverBuilderMethodNames): boolean` — Returns true for all methods except findDuplicates and mergeMany, which require duplicateCriteria.

### workspace-resolver.factory.ts

### WorkspaceResolverFactory
`file:workspace-resolver-builder/workspace-resolver.factory.ts:34`
Factory that creates all Query and Mutation resolvers for workspace objects. Iterates through all objects and builds appropriate resolvers using individual resolver factories.

**Methods:**
- `create(flatObjectMetadataMaps: FlatEntityMaps<FlatObjectMetadata>, flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>, objectIdByNameSingular: Record<string, string>, workspaceResolverBuilderMethods: WorkspaceResolverBuilderMethods): Promise<IResolvers>` — Builds Query and Mutation objects by iterating objects and methods, instantiating factories conditionally.

## Resolver Factories

### find-many-resolver.factory.ts

### FindManyResolverFactory
`file:workspace-resolver-builder/factories/find-many-resolver.factory.ts:20`
Creates resolver for findMany queries. Executes common query runner, parses to GraphQL connection type with aggregations.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<FindManyResolverArgs>` — Returns resolver function that calls CommonFindManyQueryRunnerService, formats results to connection type with pagination.

### find-one-resolver.factory.ts

### FindOneResolverFactory
`file:workspace-resolver-builder/factories/find-one-resolver.factory.ts:19`
Creates resolver for findOne queries. Executes runner, returns single object record.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<FindOneResolverArgs>` — Returns resolver that calls CommonFindOneQueryRunnerService and processes single record.

### create-one-resolver.factory.ts

### CreateOneResolverFactory
`file:workspace-resolver-builder/factories/create-one-resolver.factory.ts:19`
Creates resolver for createOne mutations. Executes runner with selected fields, returns created object.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<CreateOneResolverArgs>` — Returns resolver that calls CommonCreateOneQueryRunnerService and processes created record.

### create-many-resolver.factory.ts

### CreateManyResolverFactory
`file:workspace-resolver-builder/factories/create-many-resolver.factory.ts:20`
Creates resolver for createMany mutations. Maps over array of inputs, creates records.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<CreateManyResolverArgs>` — Returns resolver that calls CommonCreateManyQueryRunnerService and maps records through processor.

### update-one-resolver.factory.ts

### UpdateOneResolverFactory
`file:workspace-resolver-builder/factories/update-one-resolver.factory.ts:19`
Creates resolver for updateOne mutations. Executes runner, returns updated object.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<UpdateOneResolverArgs>` — Returns resolver that calls CommonUpdateOneQueryRunnerService and processes updated record.

### update-many-resolver.factory.ts

### UpdateManyResolverFactory
`file:workspace-resolver-builder/factories/update-many-resolver.factory.ts:20`
Creates resolver for updateMany mutations. Maps over updates, returns array of updated records.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<UpdateManyResolverArgs>` — Returns resolver that calls CommonUpdateManyQueryRunnerService and maps records.

### delete-one-resolver.factory.ts

### DeleteOneResolverFactory
`file:workspace-resolver-builder/factories/delete-one-resolver.factory.ts:19`
Creates resolver for deleteOne mutations (soft delete). Executes runner, returns deleted object.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<DeleteOneResolverArgs>` — Returns resolver that calls CommonDeleteOneQueryRunnerService.

### delete-many-resolver.factory.ts

### DeleteManyResolverFactory
`file:workspace-resolver-builder/factories/delete-many-resolver.factory.ts:20`
Creates resolver for deleteMany mutations (soft delete). Maps over IDs, returns deleted records.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<DeleteManyResolverArgs>` — Returns resolver that calls CommonDeleteManyQueryRunnerService and maps records.

### destroy-one-resolver.factory.ts

### DestroyOneResolverFactory
`file:workspace-resolver-builder/factories/destroy-one-resolver.factory.ts:19`
Creates resolver for destroyOne mutations (hard delete). Executes runner, returns destroyed object.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<DestroyOneResolverArgs>` — Returns resolver that calls CommonDestroyOneQueryRunnerService.

### destroy-many-resolver.factory.ts

Creates resolver for destroyMany mutations (hard delete).

### restore-one-resolver.factory.ts

### RestoreOneResolverFactory
`file:workspace-resolver-builder/factories/restore-one-resolver.factory.ts:19`
Creates resolver for restoreOne mutations (undo soft delete). Executes runner, returns restored object.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<RestoreOneResolverArgs>` — Returns resolver that calls CommonRestoreOneQueryRunnerService.

### restore-many-resolver.factory.ts

Creates resolver for restoreMany mutations (undo soft delete).

### find-duplicates-resolver.factory.ts

### FindDuplicatesResolverFactory
`file:workspace-resolver-builder/factories/find-duplicates-resolver.factory.ts:20`
Creates resolver for findDuplicates queries. Groups duplicate records by criteria, returns paginated groups.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<FindDuplicatesResolverArgs>` — Returns resolver that calls CommonFindDuplicatesQueryRunnerService and maps each group to connection type.

### merge-many-resolver.factory.ts

### MergeManyResolverFactory
`file:workspace-resolver-builder/factories/merge-many-resolver.factory.ts:19`
Creates resolver for mergeMany mutations. Merges multiple records into one, returns merged result.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<MergeManyResolverArgs>` — Returns resolver that calls CommonMergeManyQueryRunnerService.

### group-by-resolver.factory.ts

### GroupByResolverFactory
`file:workspace-resolver-builder/factories/group-by-resolver.factory.ts:20`
Creates resolver for groupBy queries. Groups records by dimension fields, optionally includes nested records.

**Methods:**
- `create(context: WorkspaceSchemaBuilderContext): Resolver<GroupByResolverArgs>` — Returns resolver that determines if records should be included, calls CommonGroupByQueryRunnerService, formats grouped results.

## Workspace Schema Building

### workspace-graphql-schema.factory.ts

### WorkspaceGraphQLSchemaGenerator
`file:workspace-schema-builder/workspace-graphql-schema.factory.ts:15`
Factory that generates complete GraphQL schema from metadata. Uses GqlTypeGenerator to build all types, constructs Query and Mutation root types.

**Methods:**
- `generateSchema(context: SchemaGenerationContext): Promise<GraphQLSchema>` — Builds and stores all GraphQL types, retrieves Query and Mutation types, constructs and returns GraphQLSchema.

### gql-type.generator.ts

### GqlTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/gql-type.generator.ts:22`
Orchestrates generation of all GraphQL types (enums, inputs, objects, root types) for workspace schema.

**Methods:**
- `buildAndStore(context: SchemaGenerationContext): Promise<GqlTypesStorage>` — Instantiates all type generators, builds composite types, object types, Query and Mutation types, stores in GqlTypesStorage.
- `buildAndStoreCompositeFieldMetadataGqlTypes(compositeTypes: CompositeType[], generators: TypeGenerators): void` — Generates enum, object, and input types for all composite field types.
- `buildAndStoreObjectMetadataGqlTypes(context: SchemaGenerationContext, generators: TypeGenerators): void` — For each object, generates enum, object, edge, connection, and input types.
- `objectContainsRelationOrMorphField(fields: FlatFieldMetadata[]): boolean` — Returns true if any field is relation or morph relation type.

### instantiateTypeGenerators (type-generators.ts)

`file:workspace-schema-builder/graphql-type-generators/type-generators.ts:36`
Factory function that instantiates and wires all type generators. Returns TypeGenerators object with enum/input/object/root generators.

**Function:**
- `instantiateTypeGenerators(gqlTypesStorage: GqlTypesStorage, typeMapperService: TypeMapperService, workspaceResolverBuilderService: WorkspaceResolverBuilderService): TypeGenerators` — Creates 20+ generator instances with proper dependencies, returns generators object.

### orphaned-types.generator.ts

### OrphanedTypesGenerator
`file:workspace-schema-builder/graphql-type-generators/orphaned-types.generator.ts:9`
Retrieves GraphQL types not used in Query or Mutation root types (orphaned types).

**Methods:**
- `fetchOrphanedTypes(): GraphQLNamedType[]` — Returns all types from storage except Query and Mutation.

## Workspace GraphQL Schema SDL Service

### workspace-graphql-schema-sdl.service.ts

### WorkspaceGraphqlSchemaSDLService
`file:workspace-graphql-schema-sdl/workspace-graphql-schema-sdl.service.ts:31`
Generates and caches GraphQL schema SDL (Schema Definition Language) strings. Handles application-specific schema filtering.

**Methods:**
- `getOrComputeSchemaSDL(workspace: FlatWorkspace, applicationId?: string): Promise<WorkspaceGraphqlSchemaSDLResult | null>` — Retrieves metadata maps, optionally filters by applicationId, generates schema via generator, caches SDL and scalar names.
- `reconcileObjectFieldIdsWithFilteredFieldMaps(flatObjectMetadataMaps, flatFieldMetadataMaps): FlatEntityMaps<FlatObjectMetadata>` — Removes field IDs not in filtered field maps from objects.
- `filterFlatEntityMapsByApplicationIds<T>(flatEntityMaps, applicationIds): FlatEntityMaps<T>` — Filters entity maps to only include entities in specified application IDs.

## Schema Builders

### type-mapper.service.ts

### TypeMapperService
`file:workspace-schema-builder/services/type-mapper.service.ts:63`
Maps Twenty field types to GraphQL scalar/input/output types. Handles special cases for ID, number, and files.

**Methods:**
- `mapToPreBuiltGraphQLOutputType({fieldMetadataType, typeOptions}): GraphQLScalarType | GraphQLList<GraphQLOutputType> | undefined` — Maps field type to GraphQL output scalar or list type.
- `mapToPreBuiltGraphQLInputType({fieldMetadataType, typeOptions}): GraphQLScalarType | GraphQLList<GraphQLInputType> | GraphQLInputObjectType | undefined` — Maps field type to GraphQL input scalar, list, or object type.
- `mapToFilterType(fieldMetadataType, typeOptions): GraphQLInputObjectType | GraphQLScalarType | undefined` — Maps field type to appropriate filter input type.
- `mapToOrderByType(fieldMetadataType): GraphQLInputType | undefined` — Maps field type to OrderByDirection enum for sorting.
- `mapToOrderByWithGroupByType(aggregationType): GraphQLInputType | undefined` — Maps aggregate operation to OrderByDirection for group by ordering.

### gql-types.storage.ts

### GqlTypesStorage
`file:workspace-schema-builder/storages/gql-types.storage.ts:3`
Simple key-value store for GraphQL types during schema generation. Prevents regeneration of duplicate types.

**Methods:**
- `addGqlType(key: string, type: GraphQLNamedType): void` — Stores GraphQL type by key.
- `getGqlTypeByKey<T extends GraphQLNamedType>(key: string): T | undefined` — Retrieves stored type by key with type safety.
- `getAllGqlTypesExcept(keysToExclude: string[]): GraphQLNamedType[]` — Returns all types except those in exclusion list.

## Scalars Service

### scalars-explorer.service.ts

### ScalarsExplorerService
`file:services/scalars-explorer.service.ts:12`
Manages GraphQL scalar type implementations and exploration. Tracks which scalars are used in schema.

**Methods:**
- `constructor()` — Initializes scalar implementations map from scalar definitions.
- `getScalarImplementation(scalarName: string): GraphQLScalarType | undefined` — Retrieves implementation for scalar name.
- `getUsedScalarNames(schema: GraphQLSchema): string[]` — Scans schema type map, returns names of custom scalar types (excluding introspection).
- `getScalarResolvers(usedScalarNames: string[]): Record<string, GraphQLScalarType>` — Maps scalar names to implementations for used scalars only.

## Direct Execution Caching

### workspace-resolver-name-map-cache.service.ts

### WorkspaceResolverNameMapCacheService
`file:direct-execution/services/workspace-resolver-name-map-cache.service.ts:14`
Caches resolver name map for fast lookup during direct execution.

**Methods:**
- `computeForCache(workspaceId: string): Promise<Record<string, ResolverNameMapEntry>>` — Builds resolver name map from flat object metadata maps.

## Module Factories

### metadata.module-factory.ts

### metadataModuleFactory
`file:metadata.module-factory.ts:23`
Factory function that creates Yoga GraphQL configuration for metadata API endpoint.

**Function:**
- `metadataModuleFactory(...dependencies): Promise<YogaDriverConfig>` — Returns config for /metadata endpoint with error handling, introspection disabling, and query complexity validation plugins.

### admin-panel.module-factory.ts

### adminPanelModuleFactory
`file:admin-panel.module-factory.ts:19`
Factory function that creates Yoga GraphQL configuration for admin panel endpoint.

**Function:**
- `adminPanelModuleFactory(...dependencies): Promise<YogaDriverConfig>` — Returns config for /admin-panel endpoint with plugins and playground rendering.

## GraphQL Query Runner — Query Parsers

### graphql-query.parser.ts

### GraphqlQueryParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query.parser.ts:29`
Top-level orchestrator that turns GraphQL `filter`/`orderBy`/selected-fields args into TypeORM query-builder mutations. Constructs and holds child parsers (`GraphqlQueryFilterConditionParser`, `GraphqlQueryOrderFieldParser`, `GraphqlQueryOrderGroupByParser`) seeded from the object's flat metadata.

**Methods:**
- `constructor(flatObjectMetadata, flatObjectMetadataMaps, flatFieldMetadataMaps)` — Builds the three child parsers from the flat maps.
- `applyFilterToBuilder(queryBuilder, objectNameSingular, recordFilter): WorkspaceSelectQueryBuilder` — Delegates to the filter condition parser to add WHERE brackets.
- `applyDeletedAtToBuilder(queryBuilder, recordFilter): WorkspaceSelectQueryBuilder` — Calls private `checkForDeletedAtFilter`; if a `deletedAt` key exists (only recursing into `and`/`or`/`not` wrappers, never composite/relation nesting), calls `.withDeleted()` so soft-deleted rows are returned.
- `applyOrderToBuilder(queryBuilder, orderBy, objectNameSingular, isForwardPagination): Record<string, OrderByClause>` — Parses order, left-joins each relation join alias, applies `.orderBy()`, returns the parsed order map for later column addition.
- `addRelationOrderColumnsToBuilder(queryBuilder, parsedOrderBy, objectNameSingular, columnsToSelect): void` — After `setFindOptions` clears addSelect, re-adds `"alias"."column"` AS `alias_column` for ORDER BY columns not already selected (needed for DISTINCT compatibility).
- `getOrderByRawSQL(orderBy, objectNameSingular, isForwardPagination): { orderByRawSQL, relationJoins }` — Builds a literal `ORDER BY ...` SQL string, quoting identifiers and wrapping with optional `::text` cast and `LOWER()` per clause flags.
- `applyGroupByOrderToBuilder(queryBuilder, orderBy, groupByFields): WorkspaceSelectQueryBuilder` — Parses group-by order entries and applies them via `.orderBy`/`.addOrderBy` (first entry sets, rest append).
- `parseSelectedFields(graphqlSelectedFields): GraphqlQuerySelectedFieldsResult` — Spins up a `GraphqlQuerySelectedFieldsParser` and returns its select/relations/aggregate result.

### graphql-query-filter-condition.parser.ts

### GraphqlQueryFilterConditionParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query-filter/graphql-query-filter-condition.parser.ts:17`
Translates an `ObjectRecordFilter` tree into TypeORM `Brackets`/`NotBrackets` WHERE conditions, recursing for the boolean operators `and`/`or`/`not`.

**Methods:**
- `constructor(flatObjectMetadata, flatFieldMetadataMaps, flatObjectMetadataMaps?, depth=0)` — Creates a child `GraphqlQueryFilterFieldParser` at the given recursion depth.
- `parse(queryBuilder, objectNameSingular, filter): WorkspaceSelectQueryBuilder` — No-op for empty filters; otherwise wraps `applyFilterEntriesToWhereBrackets` in a top-level `Brackets` via `.where()`.
- `applyFilterEntriesToWhereBrackets(innerQB, outerQB, objectNameSingular, filter): void` — Iterates filter entries, calling `parseKeyFilter` with `isFirst=index===0`.
- `parseKeyFilter(qb, outerQB, objectNameSingular, key, value, isFirst)` (private) — Switches on `and`/`or`/`not`: `and`/`or` build nested `Brackets` joining sub-filters with where/andWhere or where/orWhere; `not` wraps in `NotBrackets`; default delegates to the field parser.

### graphql-query-filter-field.parser.ts

### GraphqlQueryFilterFieldParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query-filter/graphql-query-filter-field.parser.ts:32`
Resolves a single filter key to SQL — handling scalar, composite, and MANY_TO_ONE relation sub-filters. Module constant `ARRAY_OPERATORS = ['in','contains','notContains']`.

**Methods:**
- `constructor(flatObjectMetadata, flatFieldMetadataMaps, flatObjectMetadataMaps?, depth=0)` — Builds `fieldIdByName` and `fieldIdByJoinColumnName` maps via `buildFieldMapsFromFlatObjectMetadata`.
- `parse(queryBuilder, outerQueryBuilder, objectNameSingular, key, filterValue, isFirst, useDirectTableReference)` — Looks up the field; if a MANY_TO_ONE relation accessed by relation name → `parseRelationSubFilter`; if composite → `parseCompositeFieldForFilter`; else validates array operators have non-empty arrays, calls `computeWhereConditionParts`, applies via where/andWhere.
- `parseRelationSubFilter(...)` (private) — Throws past `MAX_RELATION_FILTER_DEPTH`; left-joins the relation alias, then recurses with a child `GraphqlQueryFilterConditionParser` (depth+1) inside a `Brackets`.
- `parseCompositeFieldForFilter(...)` (private) — For each composite sub-field builds `${fieldName}${Capitalized(sub)}` column name, validates array operators, calls `computeWhereConditionParts` with `subFieldKey`.

### graphql-query-order.parser.ts

### GraphqlQueryOrderFieldParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/graphql-query-order.parser.ts:34`
Parses `ObjectRecordOrderBy` into a `{ columnExpr: OrderByClause }` map plus the relation joins needed. Re-exports `OrderByClause`, `ParseOrderByResult`, `RelationJoinInfo` for back-compat.

**Methods:**
- `constructor(flatObjectMetadata, flatObjectMetadataMaps, flatFieldMetadataMaps)` — Builds field name/join-column maps.
- `parse(orderBy, objectNameSingular, isForwardPagination): ParseOrderByResult` — For each order entry distinguishes relation (by relation name) vs composite vs scalar; throws `FIELD_NOT_FOUND` for unknown fields, enforces nested shape for relations/composites, applies `useLower`/`castToText` flags via `shouldUseCaseInsensitiveOrder`/`shouldCastToText`, accumulates unique relation joins.
- `parseRelationFieldOrder({ fieldMetadata, orderByDirection, isForwardPagination })` (private) — Resolves the target object and nested field, supports composite nested fields and scalar nested fields, returns the order map + join alias info or null.

### graphql-query-order-group-by.parser.ts

### GraphqlQueryOrderGroupByParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/graphql-query-order-group-by.parser.ts:43`
Parses the `OrderByWithGroupBy` array used by `groupBy` queries, validating that every ordered field is either an aggregate or part of the groupBy criteria. Throws `UserInputError` on violations.

**Methods:**
- `constructor(...)` — Builds `fieldIdByName` map.
- `parse({ orderBy, groupByFields }): Record<string, OrderByClause>[]` — For each order arg dispatches to aggregate / scalar / date-granularity / relation / composite handlers; computes available aggregations once via `getAvailableAggregationsFromObjectFields`.
- `isAggregateOrderByArg`, `isObjectRecordOrderByForScalarField`, `isObjectRecordOrderByForCompositeField`, `isObjectRecordOrderByWithGroupByDateField`, `isObjectRecordOrderByForRelationField` (private type guards) — Discriminate the order-arg shape, raising `UserInputError` if more than one criterion is given at once.
- `parseAggregateOrderByArg(...)` — Resolves the aggregate field, builds the SQL expression via `ProcessAggregateHelper.getAggregateExpression`, returns `{ [expr]: direction }`.
- `parseObjectRecordOrderByForScalarField(...)` — Requires the field be in groupBy; builds expression via `getGroupByOrderExpression` with optional `getOptionalOrderByCasting`.
- `parseObjectRecordOrderByForCompositeField(...)` — Validates the composite subfield is in groupBy, delegates to `parseCompositeFieldForOrder`.
- `parseObjectRecordOrderByWithGroupByDateField(...)` — Matches the groupBy field by date granularity, builds the order expression on the formatted column.
- `parseObjectRecordOrderByForRelationField(...)` — Uses `prepareForOrderByRelationFieldParsing`; handles composite, date-granularity, and regular nested relation fields, quoting `"joinAlias"."column"`.

### graphql-query-selected-fields parsers

### GraphqlQuerySelectedFieldsParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields.parser.ts:30`
Walks the GraphQL selection set and produces a `GraphqlQuerySelectedFieldsResult` (`select`, `relations`, `aggregate`, `relationFieldsCount`, `hasAtLeastTwoNestedOneToManyRelations`).

**Methods:**
- `constructor(flatObjectMetadataMaps, flatFieldMetadataMaps)` — Builds child relation + aggregate parsers.
- `parse(graphqlSelectedFields, flatObjectMetadata, isFromOneToManyRelation?)` — If selection is a root connection (`edges` present), parses connection fields; otherwise parses aggregate fields then record fields.
- `parseRecordFields(...)` (private) — Per field: RELATION/MORPH_RELATION mark the join column and recurse via the relation parser; composite fields expand to `${name}${Sub}` columns; scalars set `select[name]=true`.
- `parseConnectionField(...)` (private) — Parses aggregates then recurses into `edges.node`.
- `isRootConnection(...)` (private) — True when selection keys include `edges`.
- `parseCompositeField(...)` (private) — Maps each composite sub-field key (excluding `__typename`) to a flattened `${name}${Capitalized(sub)}: true` select entry.

### GraphqlQuerySelectedFieldsAggregateParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields-aggregate.parser.ts:13`
- `parse(graphqlSelectedFields, flatObjectMetadata, flatFieldMetadataMaps, accumulator): void` — Computes available aggregations from object fields and copies any selected aggregation keys into `accumulator.aggregate`.

### GraphqlQuerySelectedFieldsRelationParser
`file:graphql-query-runner/graphql-query-parsers/graphql-query-selected-fields/graphql-selected-fields-relation.parser.ts:13`
- `constructor(flatObjectMetadataMaps, flatFieldMetadataMaps)`
- `parseRelationField(fieldMetadata, fieldKey, fieldValue, accumulator, isFromOneToManyRelation?): void` — Detects nested one-to-many-within-one-to-many (sets `hasAtLeastTwoNestedOneToManyRelations`), recurses into the target object with a fresh parser, merges the relation's select (always including `id`), relations, aggregate, and increments `relationFieldsCount`.

### add-relation-join-alias.util.ts

### addRelationJoinAliasToQueryBuilder
`file:graphql-query-runner/graphql-query-parsers/utils/add-relation-join-alias.util.ts:11`
`(args: { queryBuilder, parentAlias, relationName }): void` — Idempotent left-join: skips if `relationName` is already in `expressionMap.joinAttributes`, otherwise `leftJoin("${parentAlias}.${relationName}", relationName)`.

## GraphQL Query Runner — Order Utils

### build-order-by-column-expression.util.ts
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/build-order-by-column-expression.util.ts:3`
- `shouldUseCaseInsensitiveOrder(fieldType): boolean` — True for TEXT, SELECT, MULTI_SELECT (apply `LOWER()`).
- `shouldCastToText(fieldType): boolean` — True for SELECT, MULTI_SELECT (apply `::text`).
- `buildOrderByColumnExpression(prefix, columnName): string` — Returns unquoted `"${prefix}.${columnName}"` for TypeORM orderBy.

### convert-order-by-to-find-options-order.ts

### convertOrderByToFindOptionsOrder
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/convert-order-by-to-find-options-order.ts:10`
`(direction, isForwardPagination=true): OrderByClause` — Maps `OrderByDirection` enum to `{ order: 'ASC'|'DESC', nulls: 'NULLS FIRST'|'NULLS LAST' }`, flipping order direction on backward pagination; throws `INVALID_DIRECTION`.

### get-optional-order-by-casting.util.ts

### getOptionalOrderByCasting
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/get-optional-order-by-casting.util.ts:5`
`(fieldMetadata): string` — Returns `'::text'` for SELECT/MULTI_SELECT, else `''`.

### is-order-by-direction.util.ts

### isOrderByDirection
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/is-order-by-direction.util.ts:4`
`(value): value is OrderByDirection` — True when value is a non-empty string in the `OrderByDirection` enum.

### parse-composite-field-for-order.util.ts

### parseCompositeFieldForOrder
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/parse-composite-field-for-order.util.ts:15`
`(fieldMetadata, value, prefix, isForwardPagination=true): Record<string, OrderByClause>` — For each composite subfield builds the `${prefix}.${name}${Sub}` order key with `useLower`/`castToText` flags; throws if subfield or direction invalid.

### prepare-for-order-by-relation-field-parsing.util.ts

### prepareForOrderByRelationFieldParsing
`file:graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/prepare-for-order-by-relation-field-parsing.util.ts:18`
`(args): { associatedGroupByField, nestedFieldMetadata, nestedFieldOrderByValue }` — Resolves the relation's nested field and matches it against the groupBy criteria (including composite subfield matching); throws `UserInputError` when the relation field isn't part of groupBy.

## GraphQL Query Runner — Helpers

### object-records-to-graphql-connection.helper.ts

### ObjectRecordsToGraphqlConnectionHelper
`file:graphql-query-runner/helpers/object-records-to-graphql-connection.helper.ts:30`
Converts raw object records into a GraphQL Relay-style `IConnection` (edges/cursors/pageInfo/totalCount) and processes nested composite/relation field values. (To be renamed CommonRecordsToGraphqlConnectionHelper.)

**Methods:**
- `constructor(flatObjectMetadataMaps, flatFieldMetadataMaps, objectIdByNameSingular)`
- `createConnection<T>({ objectRecords, parentObjectRecord?, objectRecordsAggregatedValues, selectedAggregatedFields, objectName, take, totalCount, order, hasNextPage, hasPreviousPage, depth }): IConnection<T>` — Maps records to edges (each node via `processRecord`, cursor via `encodeCursor`), extracts aggregated field values, builds pageInfo with start/end cursors.
- `extractAggregatedFieldsValues(...)` (private) — Pulls the selected aggregated values out of the per-record aggregate map.
- `processCompositeField(...)` / `formatFieldValue(value, fieldType)` (private) — Reconstruct composite values and format scalar field output values from DB rows.

### process-aggregate.helper.ts

### ProcessAggregateHelper
`file:graphql-query-runner/helpers/process-aggregate.helper.ts:8`
Static helper building SQL aggregate expressions for the available aggregations.

**Static methods:**
- `addSelectedAggregatedFieldsQueriesToQueryBuilder({ selectedAggregatedFields, queryBuilder, objectMetadataNameSingular })` — Clears select then `addSelect(expression, alias)` for each aggregate.
- `extractColumnNamesFromAggregateExpression(selection): string[] | null` — Regex-parses `CONCAT("a","b")` and `"table"."column"` patterns out of an aggregate SQL string.
- `getAggregateExpression(aggregatedField, objectMetadataNameSingular): string | undefined` — Builds SQL per `AggregateOperations`: COUNT_EMPTY/NOT_EMPTY/UNIQUE_VALUES/PERCENTAGE_*/COUNT_TRUE/FALSE produce guarded `CASE WHEN COUNT(*)=0` expressions over `NULLIF(CONCAT(cols),'')`; numeric ops (MIN/MAX/AVG/SUM) wrap the single column.

## GraphQL Query Runner — Group By

### group-by-with-records.service.ts

### GroupByWithRecordsService
`file:graphql-query-runner/group-by/services/group-by-with-records.service.ts:35`
Injectable that resolves a groupBy query that also returns the records inside each group, using a window-function (`PARTITION BY`) subquery. Constants: `RECORDS_PER_GROUP_LIMIT=10`, `RELATIONS_PER_RECORD_LIMIT=5`, `SUB_QUERY_PREFIX='sub_query_'`.

**Methods:**
- `resolveWithRecords({ queryBuilderWithGroupBy, queryBuilderWithFiltersAndWithoutGroupBy, groupByDefinitions, selectedFieldsResult, queryRunnerContext, orderByForRecords, groupLimit?, offsetForRecords? }): Promise<CommonGroupByOutputItem[]>` — Runs the group query with `getGroupLimit`; applies row-level-permission predicates; builds a partition-by subquery to fetch per-group records; processes nested relations via `ProcessNestedRelationsHelper`; formats with `formatResultWithGroupByDimensionValues`, processing each record through `CommonResultGettersService.processRecord`.
- `addPartitionByToQueryBuilder(...)` / `applyPartitionByToBuilder(...)` / `buildGroupConditions(...)` (private) — Compose the `ROW_NUMBER() OVER (PARTITION BY ...)` subquery, select columns, and per-group WHERE conditions.

### get-group-limit.util.ts

### getGroupLimit
`file:graphql-query-runner/group-by/utils/get-group-limit.util.ts:3`
`(limit?): number` — Returns the limit if it's a positive finite integer, else `DEFAULT_NUMBER_OF_GROUPS_LIMIT`.

### compute-is-numeric-returning-aggregate.util.ts

### computeIsNumericReturningAggregate
`file:graphql-query-runner/group-by/resolvers/utils/compute-is-numeric-returning-aggregate.util.ts:3`
`(operation, fromFieldType): boolean` — True for all COUNT/PERCENTAGE ops; for MIN/MAX/AVG/SUM only when field is NUMBER/NUMERIC/CURRENCY.

### format-result-with-group-by-dimension-values.util.ts

### formatResultWithGroupByDimensionValues
`file:graphql-query-runner/group-by/resolvers/utils/format-result-with-group-by-dimension-values.util.ts:15`
`async (args): Promise<CommonGroupByOutputItem[]>` — Builds a per-group-key record map (formatting + processing each record when records are requested), then for each group emits `{ ...aggregateValues, groupByDimensionValues, records? }`. Private `createGroupKey` joins dimension aliases with `|`; private `getTranslatedValueIfApplicable` i18n-translates day-of-week / month-of-year dimension strings via Lingui `t`.

## GraphQL Query Runner — Utils

### build-columns-to-select.ts / build-columns-to-return.ts

### buildColumnsToSelect
`file:graphql-query-runner/utils/build-columns-to-select.ts:14`
`(args): Record<string, boolean>` — Collects scalar `select` columns plus required MANY_TO_ONE relation/morph join-column names (via private `getRequiredRelationColumns`), always adding `id: true`.

### buildColumnsToReturn
`file:graphql-query-runner/utils/build-columns-to-return.ts:6`
`(args): string[]` — Runs `buildColumnsToSelect` and returns only the column names whose value is `true`.

### compute-where-condition-parts.ts

### computeWhereConditionParts
`file:graphql-query-runner/utils/compute-where-condition-parts.ts:20`
`(args): { sql, params }` — Core operator→SQL translator. Generates random param suffixes (`randomBytes`), picks `"obj"."key"` vs `"key"` reference, injects Postgres null-equivalent handling (`findPostgresDefaultNullEquivalentValue`), and switches over operators: `isEmptyArray`, `eq`, `neq`, `gt/gte/lt/lte`, `in`, `is` (NULL/NOT NULL), `like`/`ilike` (`::text`), `startsWith` (`^@`), `endsWith` (`RIGHT(...)`), `contains` (`@>`), `search` (tsquery + ILIKE with `unaccent_immutable`), `notContains`, `containsAny`, `containsIlike` (unnest+ILIKE). Throws `UNSUPPORTED_OPERATOR` otherwise.

### cursors.util.ts
`file:graphql-query-runner/utils/cursors.util.ts`
- `decodeCursor<T>(cursor): T` (line 17) — Base64+JSON decode; throws `CommonQueryRunnerException` INVALID_CURSOR on failure.
- `encodeCursor<T>(objectRecord, order): string` (line 29) — Builds cursor data from the orderBy field values plus `id`, then base64-encodes.
- `encodeCursorData(cursorData): string` (line 52) — JSON+base64 encode.
- `getCursor(args): Record | undefined` (line 56) — Decodes `args.after` or `args.before`.
- `getPaginationInfo(objectRecords, limit, isForwardPagination)` (line 67) — Returns `{ hasNextPage, hasPreviousPage, hasMoreRecords }` based on whether more than `limit` rows were fetched.

### get-field-metadata-from-graphql-field.util.ts

### getFieldMetadataFromGraphQLField
`file:graphql-query-runner/utils/get-field-metadata-from-graphql-field.util.ts:20`
`(args): FlatFieldMetadata | undefined` — Looks up a field by GraphQL name; if not found, scans MORPH_RELATION fields and resolves through their target objects.

### get-target-object-metadata.util.ts

### getTargetObjectMetadataOrThrow
`file:graphql-query-runner/utils/get-target-object-metadata.util.ts:11`
`(fieldMetadata, flatObjectMetadataMaps): FlatObjectMetadata` — Resolves a relation field's target object; throws `RELATION_TARGET_OBJECT_METADATA_NOT_FOUND` if missing.

### has-record-field-value.util.ts

### hasRecordFieldValue
`file:graphql-query-runner/utils/has-record-field-value.util.ts:1`
`(value): boolean` — True if value is meaningfully present: non-blank string, non-NaN number, any boolean, non-empty array, or object with at least one present value.

### parse-additional-items.util.ts

### parseArrayOrJsonStringToArray
`file:graphql-query-runner/utils/parse-additional-items.util.ts:1`
`<T>(value): T[]` — Returns arrays as-is, parses JSON strings into arrays (empty on failure), else `[]`.

### check-string-is-database-event-action.ts

### checkStringIsDatabaseEventAction
`file:graphql-query-runner/utils/check-string-is-database-event-action.ts:3`
`(value): value is DatabaseEventAction` — Membership check against the `DatabaseEventAction` enum.

### Merge Field Value Utils (record merge for mergeMany)

### mergeFieldValues
`file:graphql-query-runner/utils/merge-field-values.util.ts:16`
`(fieldType, recordsWithValues, priorityRecordId, isDryRun, relationType?): unknown` — Dispatches by field type: ARRAY/MULTI_SELECT→`mergeArrayFieldValues`; RELATION→dry-run relation merge or default; EMAILS/PHONES/LINKS→dedicated mergers; else `defaultMergeFieldValue`.

### defaultMergeFieldValue
`file:graphql-query-runner/utils/default-merge-field-value.util.ts:5`
`<T>(recordsWithValues, priorityRecordId): T | null` — Prefers the priority record's value if present, else first record with a present value, else null.

### mergeArrayFieldValues
`file:graphql-query-runner/utils/merge-array-field-values.util.ts:5`
`<T>(recordsWithValues): T[] | null` — Flattens, filters present values, de-dupes via `Set`; null if empty. Throws on non-array values.

### mergeEmailsFieldValues
`file:graphql-query-runner/utils/merge-emails-field-values.util.ts:6`
`(recordsWithValues, priorityRecordId): EmailsMetadata` — Picks primary email from priority record (or first present), collects all unique additional emails excluding the primary.

### mergeLinksFieldValues
`file:graphql-query-runner/utils/merge-links-field-values.util.ts:8`
`(recordsWithValues, priorityRecordId): LinksMetadata` — Picks primary link url+label, merges secondary links uniquely (`uniqBy`).

### mergePhonesFieldValues
`file:graphql-query-runner/utils/merge-phones-field-values.util.ts:10`
`(recordsWithValues, priorityRecordId): PhonesMetadata` — Picks primary phone (number/country/calling code) from priority/fallback, merges additional phones uniquely.

### mergeRelationFieldValuesForDryRunRecord
`file:graphql-query-runner/utils/merge-relation-field-values-for-dry-run-record.util.ts:6`
`(recordsWithValues, relationType, priorityRecordId): ObjectRecord | ObjectRecord[] | null` — For ONE_TO_MANY merges arrays of relations de-duped by id; otherwise `defaultMergeFieldValue`.

## GraphQL Query Runner — Decorators, Enums, Errors, Constants

### OnCustomBatchEvent
`file:graphql-query-runner/decorators/on-custom-batch-event.decorator.ts:5`
`(event: CustomEventName): MethodDecorator` — Thin wrapper applying NestJS `OnEvent(event)`.

### OnDatabaseBatchEvent
`file:graphql-query-runner/decorators/on-database-batch-event.decorator.ts:5`
`(object, action: DatabaseEventAction): MethodDecorator` — Applies `OnEvent("${object}.${action}")`.

### DatabaseEventAction
`file:graphql-query-runner/enums/database-event-action.ts:3`
GraphQL-registered enum: CREATED, UPDATED, DELETED, DESTROYED, RESTORED, UPSERTED.

### GraphqlQueryRunnerException / GraphqlQueryRunnerExceptionCode
`file:graphql-query-runner/errors/graphql-query-runner.exception.ts:5`
`CustomException` subclass with codes INVALID_QUERY_INPUT, MAX_DEPTH_REACHED, INVALID_CURSOR, INVALID_DIRECTION, UNSUPPORTED_OPERATOR, ARGS_CONFLICT, FIELD_NOT_FOUND, MISSING_SYSTEM_FIELD, OBJECT_METADATA_NOT_FOUND, RECORD_NOT_FOUND, INVALID_ARGS_FIRST/LAST, RELATION_SETTINGS_NOT_FOUND, RELATION_TARGET_OBJECT_METADATA_NOT_FOUND, NOT_IMPLEMENTED, INVALID_POST_HOOK_PAYLOAD, UPSERT_MULTIPLE_MATCHING_RECORDS_CONFLICT, UPSERT_MAX_RECORDS_EXCEEDED.

### Constants
- `CONNECTION_MAX_DEPTH = 5` — `file:graphql-query-runner/constants/connection-max-depth.constant.ts:1`.
- `OBJECTS_WITH_SETTINGS_PERMISSIONS_REQUIREMENTS` — `file:graphql-query-runner/constants/objects-with-settings-permissions-requirements.ts:3` — maps `apiKey`/`webhook` objects to `PermissionFlagType.API_KEYS_AND_WEBHOOKS`.

## Workspace Schema Builder — Type Generators (orchestration)

### gql-type.generator.ts (additional internals)
`file:workspace-schema-builder/graphql-type-generators/gql-type.generator.ts:30`
`buildAndStore` order: composite field types → `groupByDateGranularityInputTypeGenerator.buildAndStore()` → per-object types → `queryTypeGenerator.buildAndStore` → `mutationTypeGenerator.buildAndStore`. (Already partially documented above.)

### ArgsTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/args-type/args-type.generator.ts:13`
- `generate({ args, objectMetadataSingularName }): GraphQLFieldConfigArgumentMap` — For each arg: scalar args wrap via `applyTypeOptionsForOutputType`; input-kind args resolve the stored input type by `computeObjectMetadataInputTypeKey` (throws if not an input object type) then wrap with array/nullable options.

## Workspace Schema Builder — Enum Type Generators

### CompositeFieldMetadataGqlEnumTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/enum-types/composite-field-metadata-gql-enum-type.generator.ts:20`
- `buildAndStore(compositeType)` — For each enum composite property, stores a `GraphQLEnumType` keyed by `computeCompositeFieldEnumTypeKey`.
- `generate(...)` (private) — Builds `${Pascal(type)}${Pascal(prop)}Enum` from the property's options.

### EnumFieldMetadataGqlEnumTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/enum-types/enum-field-metadata-gql-enum-type.generator.ts:18`
- `buildAndStore(flatObjectMetadata, fields)` — For each enum field stores a `GraphQLEnumType` keyed by `computeEnumFieldGqlTypeKey`.
- `generateEnum(...)` (private) — Uses `transformEnumValue` on the field options to build `${Pascal(object)}${Pascal(field)}Enum`.

## Workspace Schema Builder — Input Type Generators

### CompositeFieldMetadataGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/composite-field-metadata-gql-input-type.generator.ts:12`
- `buildAndStore(compositeType)` — Builds the base composite input object type.

### CompositeFieldMetadataCreateGqlInputTypeGenerator / UpdateGqlInputTypeGenerator / FilterGqlInputTypeGenerator / OrderByGqlInputTypeGenerator / GroupByGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/create-input/composite-field-metadata-create-gql-input-type.generator.ts:23`, `.../update-input/composite-field-metadata-update-gql-input-type.generator.ts:23`, `.../filter-input/composite-field-metadata-filter-gql-input-types.generator.ts:24`, `.../order-by-input/composite-field-metadata-order-by-gql-input-type.generator.ts:19`, `.../group-by-input/composite-field-metadata-group-by-gql-input-type.generator.ts:19`
Each exposes `buildAndStore(compositeType)` (stores the kind-specific composite input type) and `generateFields(...)` building the per-subfield input field map for that operation kind.

### ObjectMetadataCreateGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/create-input/object-metadata-create-gql-input-type.generator.ts:32`
- `buildAndStore(flatObjectMetadata, fields, context)` — Stores `${Pascal(name)}CreateInput`.
- `generateFields(...)` (private) — Per field: relations → simple relation create/update input + connect input; enum → enum create input; composite → composite create input; else atomic create input.
- `generateEnumFieldCreateInputType`, `generateCompositeFieldCreateInputType`, `generateAtomicFieldCreateInputType` (private).

### ObjectMetadataUpdateGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/update-input/object-metadata-update-gql-input-type.generator.ts:33`
- `buildAndStore(...)` / `generateFields(...)` — Mirrors the create generator but for `UpdateInput`.

### ObjectMetadataFilterGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/filter-input/object-metadata-filter-gql-input-type.generator.ts:30`
- `buildAndStore(...)` — Stores `${Pascal(name)}FilterInput`.
- `generateFields(...)` (private) — Forces `isNullable:true`; per field builds relation/enum/composite/atomic filter inputs; appends `and`/`or` (`GraphQLList(self)`) and `not` operators.
- `generateEnumFieldFilterInputType`, `generateCompositeFieldFilterInputType`, `generateAtomicFieldFilterInputType` (private).

### ObjectMetadataOrderByBaseGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/order-by-input/object-metadata-order-by-base.generator.ts:23`
- `generateFields({ fields, isForGroupBy, context, logger })` — Shared field generator for both order-by variants; per field builds relation/composite/atomic order-by inputs.
- `generateCompositeFieldOrderByInputType`, `generateAtomicFieldOrderByInputType` (private) — Resolve stored composite type or map atomic field to `OrderByDirection`.

### ObjectMetadataOrderByGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/order-by-input/object-metadata-order-by-gql-input-type.generator.ts:15`
- `buildAndStore({ flatObjectMetadata, fields, context })` — Stores `${Pascal(name)}OrderByInput` using the base generator.

### ObjectMetadataOrderByWithGroupByGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/order-by-input/object-metadata-order-by-with-group-by-gql-input-type.generator.ts:29`
- `buildAndStore(...)` — Stores the OrderByWithGroupBy input.
- `generateFields`, `generateOrderByOnAggregateFields`, `generateOrderByOnDimensionValuesFields`, `generateCompositeFieldOrderByInputType`, `generateAtomicFieldOrderByInputType`, `generateAggregateFieldOrderByInputType` (private) — Add both dimension-value ordering and per-aggregate ordering fields.

### ObjectMetadataGroupByGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/group-by-input/object-metadata-group-by-gql-input-type.generator.ts:29`
- `buildAndStore(...)` — Stores `${Pascal(name)}GroupByInput`.
- `generateFields(...)` (private) — Skips fields unsupported in groupBy; relations → relation group-by input; else `generateField`.
- `generateField(...)` (private) — Composite → composite group-by input; DATE/DATE_TIME → granularity input type; else `GraphQLBoolean`.
- `generateCompositeFieldGroupByInputType(...)` (private).

### GroupByDateGranularityInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/group-by-input/group-by-date-granularity-gql-input-type.generator.ts:23`
- `buildAndStore()` — Stores the shared `GroupByDateGranularityInput` type.

### ObjectMetadataGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/object-metadata-gql-input-type.generator.ts:14`
- `buildAndStore(...)` — Coordinator that triggers building of all input-type variants (create/update/filter/order-by/group-by) for an object.

### RelationConnectGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/relation-connect-gql-input-type.generator.ts:24`
- `buildAndStore(...)` — Stores `${id}-ConnectInput` keyed relation input.
- `generateRelationConnectInputType(...)` (private) — Builds `{ connect: <WhereInput>, disconnect: Boolean }` using `RELATION_NESTED_QUERY_KEYWORDS`.
- `generateRelationWhereInputType(...)` (private) — Derives the connect-by-where fields from the object's unique index constraints (`getUniqueConstraintsFields`), handling composite fields.
- `formatConstraints(...)` (private).

### RelationFieldMetadataGqlInputTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/input-types/relation-field-metadata-gql-type.generator.ts:26`
- `generateSimpleRelationFieldCreateOrUpdateInputType({ fieldMetadata, typeOptions })` — FK/join-column input field for create/update.
- `generateSimpleRelationFieldFilterInputType({ fieldMetadata, typeOptions, context })` — Nested relation filter input.
- `generateSimpleRelationFieldOrderByInputType({ fieldMetadata, isForGroupBy, context })` — Nested relation order-by input.
- `generateSimpleRelationFieldGroupByInputType(fieldMetadata, context)` — Nested relation group-by input.
- `generateConnectRelationFieldInputType({ fieldMetadata, typeOptions })` — Exposes the `<rel>` connect/disconnect input.
- `getTargetRelationInputField(...)` (private).

## Workspace Schema Builder — Object Type Generators

### AggregationObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/aggregation-type.generator.ts:12`
- `generate(flatFields): Record<string, { type, description }>` — Projects `getAvailableAggregationsFromObjectFields` down to GraphQL type+description per aggregate key.

### ConnectionGqlObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/connection-gql-object-type.generator.ts:17`
- `buildAndStore(flatObjectMetadata, flatFields)` — Stores `${Pascal(name)}Connection`.
- `generateFields(...)` (private) — Merges aggregate fields, the non-null array `edges` (from stored Edge type), and non-null `pageInfo` (`PageInfoType`).

### EdgeGqlObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/edge-gql-object-type.generator.ts:15`
- `buildAndStore(flatObjectMetadata)` — Stores `${Pascal(name)}Edge`.
- `generateFields(...)` (private) — Non-null `node` (Plain object type) + non-null `cursor` (`CursorScalarType`).

### GroupByConnectionGqlObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/group-by-connection-gql-object-type.generator.ts:15`
- `buildAndStore(flatObjectMetadata)` — Stores `${Pascal(name)}GroupByConnection`.
- `generateFields(...)` (private) — Builds the grouped-output connection fields (uses `GraphQLJSON` for dimension values).

### ObjectMetadataGqlObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/object-metadata-gql-object-type.generator.ts:27`
- `buildAndStore(flatObjectMetadata, fields, context)` — Stores the Plain (`node`) object type.
- `generateFields(...)` (private) — Maps each non-relation field to its output GraphQL type via `TypeMapperService`.

### ObjectMetadataWithRelationsGqlObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/object-metadata-with-relations-gql-object-type.generator.ts:28`
- `buildAndStore(...)` — Extends the plain object type with relation fields.
- `generateFields(...)` (private) — For each relation/morph field resolves the target object type (Connection for ONE_TO_MANY, Plain otherwise) and attaches findMany args for one-to-many.
- `fetchTargetObjectMetadataGqlObjectType(...)` (private) — Resolves the stored target type by kind; throws if missing.

### RelationFieldMetadataGqlObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/relation-field-metadata-gql-object-type.generator.ts:15`
- `generateRelationFieldObjectType({...})` — Builds the output GraphQL type for a relation field using `TypeMapperService`.

### CompositeFieldMetadataGqlObjectTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/object-types/composite-field-metadata-gql-object-type.generator.ts:18`
- `buildAndStore(compositeType)` / `generateFields(...)` — Builds the composite Plain object type from its properties.

## Workspace Schema Builder — Root Type Generators

### RootTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/root-types/root-type.generator.ts:22`
- `buildAndStore(context, workspaceResolverMethodNames, objectTypeName: GqlOperation)` — Builds the Query or Mutation root `GraphQLObjectType` by iterating all objects × resolver methods.
- `generateFields(...)` (private) — For each (object, method) where `shouldBuildResolver` is true: computes resolver `name`, `args` (`getResolverArgs`), resolves the stored object type by kind, generates the args type, wraps array output for the many/duplicates/groupBy methods, sets `resolve: undefined` (resolvers attached later).
- `getObjectTypeDefinitionKindByMethodName(...)` (private) — findMany/findDuplicates→Connection, groupBy→GroupByConnection, else Plain.

### QueryTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/root-types/query-type.generator.ts:12`
- `buildAndStore(context)` — Delegates to `RootTypeGenerator` with the query method names and `GqlOperation.Query`.
- `fetchQueryType(): GraphQLObjectType` — Retrieves the stored Query type or throws.

### MutationTypeGenerator
`file:workspace-schema-builder/graphql-type-generators/root-types/mutation-type.generator.ts:12`
- `buildAndStore(context)` — Delegates with mutation method names and `GqlOperation.Mutation`.
- `fetchMutationType(): GraphQLObjectType` — Retrieves the stored Mutation type or throws.

## Workspace Schema Builder — Utils

### applyTypeOptionsForOutputType
`file:workspace-schema-builder/utils/apply-type-options-for-output-type.util.ts:17`
`<T>(typeRef, options): T` — Wraps in list (`wrapTypeInGraphQLList`) if `isArray`, then `GraphQLNonNull` if `nullable===false` and no default value.

### applyTypeOptionsForCreateInput
`file:workspace-schema-builder/utils/apply-type-options-for-create-input.util.ts:17`
`<T>(typeRef, options): T` — Same list + non-null logic for create inputs.

### applyTypeOptionsForUpdateInput
`file:workspace-schema-builder/utils/apply-type-options-for-update-input.util.ts:11`
`<T>(typeRef, options): T` — Update inputs are always nullable; only applies list wrapping.

### wrapTypeInGraphQLList
`file:workspace-schema-builder/utils/wrap-type-in-graphql-list.util.ts:3`
`<T>(targetType, depth, nullable): GraphQLList<T>` — Recursively nests `GraphQLList` to `depth`, wrapping inner type in `GraphQLNonNull` unless nullable.

### cleanEntityName
`file:workspace-schema-builder/utils/clean-entity-name.util.ts:3`
`(entityName): string` — Strips leading digits, trims, camelCases, removes non-alphanumerics.

### computeCompositeFieldTypeOptions
`file:workspace-schema-builder/utils/compute-composite-field-type-options.util.ts:3`
`(property): { nullable, isArray }` — nullable = !isRequired; isArray for MULTI_SELECT or `property.isArray`.

### computeCompositePropertyTarget
`file:workspace-schema-builder/utils/compute-composite-property-target.util.ts:6`
`(type, compositeProperty): string` — Returns `${type}->${prop.name}`.

### computeFieldInputTypeOptions
`file:workspace-schema-builder/utils/compute-field-input-type-options.util.ts:7`
`(fieldMetadata, kind): TypeOptions` — Builds `{ nullable, defaultValue, isArray (MULTI_SELECT unless Filter kind), settings, isIdField }`.

### createGqlEnumFilterType
`file:workspace-schema-builder/utils/create-gql-enum-filter-type.util.ts:11`
`(enumType): GraphQLInputType` — Builds `${enum.name}Filter` with `eq/neq/in/containsAny/is/isEmptyArray`.

### extractGraphQLRelationFieldNames
`file:workspace-schema-builder/utils/extract-graphql-relation-field-names.util.ts:6`
`(fieldMetadata): { joinColumnName, fieldMetadataName }` — Computes the join column name for a relation/morph field.

### getAvailableAggregationsFromObjectFields
`file:workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util.ts:21`
`(fields): Record<string, AggregationField>` — For each non-relation field generates the full set of aggregate operations (`countUniqueValues*`, `countEmpty*`, `countNotEmpty*`, `percentageEmpty*`, `percentageNotEmpty*`, plus numeric MIN/MAX/AVG/SUM where applicable), capturing GraphQL type, fromField/type/subfields, and operation. Exports the `AggregationField` type.

### getFlatFieldsFromFlatObjectMetadata
`file:workspace-schema-builder/utils/get-flat-fields-for-flat-object-metadata.util.ts:6`
`(flatObjectMetadata, flatFieldMetadataMaps): FlatFieldMetadata[]` — Resolves the object's field ids to field metadata.

### getNumberFilterType
`file:workspace-schema-builder/utils/get-number-filter-type.util.ts:10`
`(subType): GraphQLInputObjectType` — FLOAT→FloatFilterType, BIGINT→BigIntFilterType, INT→IntFilterType, default FloatFilterType.

### getNumberScalarType
`file:workspace-schema-builder/utils/get-number-scalar-type.util.ts:5`
`(dataType): GraphQLScalarType` — FLOAT→GraphQLFloat, BIGINT→GraphQLBigInt, INT→GraphQLInt, default GraphQLFloat.

### getResolverArgs
`file:workspace-schema-builder/utils/get-resolver-args.util.ts:9`
`(type): { [key]: ArgMetadata }` — Returns the arg metadata per resolver method: findMany (first/last/offset/before/after/filter/orderBy[]), findOne/deleteMany (filter), createMany (data[]/upsert), createOne (data), update/destroy/restore/merge variants, etc.

### isFieldMetadataRelationOrMorphRelation
`file:workspace-schema-builder/utils/is-field-metadata-relation-or-morph-relation.utils.ts:6`
`(fieldMetadata): boolean` — True for RELATION or MORPH_RELATION types.

### compute-stored-gql-type-key utils
`file:workspace-schema-builder/utils/compute-stored-gql-type-key-utils/`
String-key builders used to store/look up generated types in `GqlTypesStorage`:
- `computeCompositeFieldEnumTypeKey(type, propName)` → `${Pascal(type)}${Pascal(prop)}Enum` (line 3).
- `computeCompositeFieldInputTypeKey(type, kind)` → `${Pascal(name)}${kind}Input` (line 6).
- `computeCompositeFieldObjectTypeKey(type)` → `${Pascal(type)}` Plain object key (line 6).
- `computeEnumFieldGqlTypeKey(objectName, fieldName)` → `${Pascal(obj)}${Pascal(field)}Enum`-style key (line 3).
- `computeObjectMetadataInputTypeKey(name, kind)` → `${Pascal(name)}${kind}Input` (line 5).
- `computeObjectMetadataObjectTypeKey(name, kind)` → `${Pascal(name)}${kind}` (line 5).
- `computeRelationConnectInputTypeKey(objectMetadataNameId)` → `${id}-ConnectInput` (line 1).

## Workspace Schema Builder — Enums & Exceptions

### GqlInputTypeDefinitionKind
`file:workspace-schema-builder/enums/gql-input-type-definition-kind.enum.ts:1`
Create, Update, Filter, OrderBy, GroupBy, OrderByWithGroupBy.

### GqlOperation
`file:workspace-schema-builder/enums/gql-operation.enum.ts:1`
Query, Mutation, Subscription.

### ObjectTypeDefinitionKind
`file:workspace-schema-builder/enums/object-type-definition-kind.enum.ts:1`
GroupByConnection, Connection, Edge, Plain (`''`).

### WorkspaceGraphQLSchemaException / WorkspaceGraphQLSchemaExceptionCode
`file:workspace-schema-builder/exceptions/workspace-graphql-schema.exception.ts:7`
`CustomException` subclass; codes include QUERY_TYPE_NOT_FOUND, MUTATION_TYPE_NOT_FOUND. Private `getWorkspaceGraphQLSchemaExceptionUserFriendlyMessage` falls back to `STANDARD_ERROR_MESSAGE`.

## Workspace Schema Builder — Pre-Built GraphQL Types

### Scalars
`file:workspace-schema-builder/graphql-types/scalars/`
Custom `GraphQLScalarType` instances: `TimeScalarType`, `CursorScalarType`, `DateScalarType`, `BigFloatScalarType`, `PositionScalarType`, `UUIDScalarType`, `BigIntScalarType`, `TSVectorScalarType`.

### Filter Input Types
`file:workspace-schema-builder/graphql-types/input/`
Pre-built `GraphQLInputObjectType` filters per scalar family: `ArrayFilterType`, `BigIntFilterType`, `BigFloatFilterType`, `BooleanFilterType`, `DateFilterType`, `DateTimeFilterType`, `FloatFilterType`, `IntFilterType`, `MultiSelectFilterType`, `RawJsonFilterType`, `RichTextFilterType`, `SelectFilterType`, `TSVectorFilterType`, `UUIDFilterType`, `StringFilterType`, plus `FilterIs` and `FilesInputType` (`GraphQLList(FileItemInputType)`).

### Object & Enum Types
`file:workspace-schema-builder/graphql-types/object/`, `.../enum/`
- `PageInfoType` (`GraphQLObjectType`) and `FilesObjectType` (`GraphQLList(FileObjectType)`).
- `OrderByDirectionType` (`GraphQLEnumType`) for sort directions.

## Residual (trivial only)

The only undocumented files are non-logic leftovers: NestJS module wiring (`graphql-query-runner.module.ts`, `workspace-schema-builder.module.ts` — pure `@Module` provider/import declarations), barrel `index.ts` re-exports under `graphql-types/`, and Jest test fixtures (`graphql-query-runner/__mocks__/mockPersonObjectMetadata.ts`, `mockPersonRecords.ts`). These contain no exported business logic.

