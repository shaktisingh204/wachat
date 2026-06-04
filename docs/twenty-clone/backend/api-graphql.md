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

## NOT YET COVERED

The following subdirectories and files have not been fully documented due to the large scope (270 total files). These areas would require additional passes:

1. **workspace-resolver-builder/utils/** — 10+ utility functions for context creation, argument extraction
2. **direct-execution/utils/** — 15+ assertion and formatting utilities
3. **workspace-schema-builder/utils/** — 15+ GraphQL type generation utilities
4. **workspace-schema-builder/graphql-type-generators/input-types/** — 10+ input type generators
5. **workspace-schema-builder/graphql-type-generators/object-types/** — 8+ object type generators
6. **workspace-schema-builder/graphql-type-generators/root-types/** — Query and Mutation type generators
7. **workspace-schema-builder/graphql-type-generators/enum-types/** — Enum type generators
8. **workspace-schema-builder/graphql-type-generators/args-type/** — Arguments type generator
9. **graphql-query-runner/** — 100+ files for query execution, filtering, sorting, grouping, aggregation
10. **workspace-query-runner/** — Query runner interfaces, exceptions, and utilities
11. **direct-execution/hooks/** — useDirectExecution plugin hook
12. **graphql-config/hooks/** — useCachedMetadata plugin hook
13. **workspace-schema-builder/types/** — Type definitions for schema generation context
14. **workspace-schema-builder/enums/** — GQL operation and kind enums
15. **workspace-schema-builder/exceptions/** — Schema generation exceptions
16. **graphql-query-runner/group-by/** — Group-by resolution logic (15+ files)
17. **workspace-resolver-builder/interfaces/** — Type definitions and interfaces

