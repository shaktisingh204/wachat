# API REST, Common, and MCP Modules Backend

Comprehensive documentation for engine/api/(rest|common|mcp|utils|clickhouse-query-runners) modules. Every exported function, NestJS service, GraphQL resolver, and utility is documented with location, signature, and business logic.

## REST

### rest-api-exception.filter.ts
`file:rest/rest-api-exception.filter.ts:1`

**RestApiExceptionFilter** (Class)
`file:rest/rest-api-exception.filter.ts:13`
Exported service/class providing core functionality.

### rest-api.module.ts
`file:rest/rest-api.module.ts:1`

**RestApiModule** (Class)
`file:rest/rest-api.module.ts:8`
Exported service/class providing core functionality.

### rest-api-core.module.ts
`file:rest/core/rest-api-core.module.ts:1`

**RestApiCoreModule** (Class)
`file:rest/core/rest-api-core.module.ts:75`
Exported service/class providing core functionality.

### rest-api-core.controller.ts
`file:rest/core/controllers/rest-api-core.controller.ts:1`

**RestApiCoreController** (Class)
`file:rest/core/controllers/rest-api-core.controller.ts:27`
Exported service/class providing core functionality.

### rest-api-base.handler.ts
`file:rest/core/handlers/rest-api-base.handler.ts:1`

**PageInfo** (Class)
`file:rest/core/handlers/rest-api-base.handler.ts:43`
Exported service/class providing core functionality.

**FormatResult** (Class)
`file:rest/core/handlers/rest-api-base.handler.ts:50`
Exported service/class providing core functionality.

**RestApiBaseHandler** (Class)
`file:rest/core/handlers/rest-api-base.handler.ts:58`
Exported service/class providing core functionality.

### rest-api-create-many.handler.ts
`file:rest/core/handlers/rest-api-create-many.handler.ts:1`

**RestApiCreateManyHandler** (Class)
`file:rest/core/handlers/rest-api-create-many.handler.ts:13`
Exported service/class providing core functionality.

### rest-api-create-one.handler.ts
`file:rest/core/handlers/rest-api-create-one.handler.ts:1`

**RestApiCreateOneHandler** (Class)
`file:rest/core/handlers/rest-api-create-one.handler.ts:14`
Exported service/class providing core functionality.

### rest-api-delete-many.handler.ts
`file:rest/core/handlers/rest-api-delete-many.handler.ts:1`

**RestApiDeleteManyHandler** (Class)
`file:rest/core/handlers/rest-api-delete-many.handler.ts:14`
Exported service/class providing core functionality.

### rest-api-delete-one.handler.ts
`file:rest/core/handlers/rest-api-delete-one.handler.ts:1`

**RestApiDeleteOneHandler** (Class)
`file:rest/core/handlers/rest-api-delete-one.handler.ts:13`
Exported service/class providing core functionality.

### rest-api-destroy-many.handler.ts
`file:rest/core/handlers/rest-api-destroy-many.handler.ts:1`

**RestApiDestroyManyHandler** (Class)
`file:rest/core/handlers/rest-api-destroy-many.handler.ts:14`
Exported service/class providing core functionality.

### rest-api-destroy-one.handler.ts
`file:rest/core/handlers/rest-api-destroy-one.handler.ts:1`

**RestApiDestroyOneHandler** (Class)
`file:rest/core/handlers/rest-api-destroy-one.handler.ts:13`
Exported service/class providing core functionality.

### rest-api-find-duplicates.handler.ts
`file:rest/core/handlers/rest-api-find-duplicates.handler.ts:1`

**RestApiFindDuplicatesHandler** (Class)
`file:rest/core/handlers/rest-api-find-duplicates.handler.ts:12`
Exported service/class providing core functionality.

### rest-api-find-many.handler.ts
`file:rest/core/handlers/rest-api-find-many.handler.ts:1`

**RestApiFindManyHandler** (Class)
`file:rest/core/handlers/rest-api-find-many.handler.ts:20`
Exported service/class providing core functionality.

### rest-api-find-one.handler.ts
`file:rest/core/handlers/rest-api-find-one.handler.ts:1`

**RestApiFindOneHandler** (Class)
`file:rest/core/handlers/rest-api-find-one.handler.ts:13`
Exported service/class providing core functionality.

### rest-api-group-by.handler.ts
`file:rest/core/handlers/rest-api-group-by.handler.ts:1`

**RestApiGroupByHandler** (Class)
`file:rest/core/handlers/rest-api-group-by.handler.ts:20`
Exported service/class providing core functionality.

### rest-api-merge-many.handler.ts
`file:rest/core/handlers/rest-api-merge-many.handler.ts:1`

**RestApiMergeManyHandler** (Class)
`file:rest/core/handlers/rest-api-merge-many.handler.ts:13`
Exported service/class providing core functionality.

### rest-api-restore-many.handler.ts
`file:rest/core/handlers/rest-api-restore-many.handler.ts:1`

**RestApiRestoreManyHandler** (Class)
`file:rest/core/handlers/rest-api-restore-many.handler.ts:14`
Exported service/class providing core functionality.

### rest-api-restore-one.handler.ts
`file:rest/core/handlers/rest-api-restore-one.handler.ts:1`

**RestApiRestoreOneHandler** (Class)
`file:rest/core/handlers/rest-api-restore-one.handler.ts:14`
Exported service/class providing core functionality.

### rest-api-update-many.handler.ts
`file:rest/core/handlers/rest-api-update-many.handler.ts:1`

**RestApiUpdateManyHandler** (Class)
`file:rest/core/handlers/rest-api-update-many.handler.ts:14`
Exported service/class providing core functionality.

### rest-api-update-one.handler.ts
`file:rest/core/handlers/rest-api-update-one.handler.ts:1`

**RestApiUpdateOneHandler** (Class)
`file:rest/core/handlers/rest-api-update-one.handler.ts:14`
Exported service/class providing core functionality.

### rest-api-core.service.ts
`file:rest/core/services/rest-api-core.service.ts:1`

**RestApiCoreService** (NestJS Service)
`file:rest/core/services/rest-api-core.service.ts:25`
Exported service/class providing core functionality.

### rest-input-request-parser.exception.ts
`file:rest/input-request-parsers/rest-input-request-parser.exception.ts:1`

**RestInputRequestParserException** (Class)
`file:rest/input-request-parsers/rest-input-request-parser.exception.ts:40`
Exported service/class providing core functionality.

### parse-aggregate-fields-rest-request.util.ts
`file:rest/input-request-parsers/aggregate-fields-parser-utils/parse-aggregate-fields-rest-request.util.ts:1`

**parseAggregateFieldsRestRequest** utility function
`file:rest/input-request-parsers/aggregate-fields-parser-utils/parse-aggregate-fields-rest-request.util.ts:11`
Logic: ): CommonSelectedFields => { → const aggregateFieldsQuery = request.query.aggregate

### parse-depth-rest-request.util.ts
`file:rest/input-request-parsers/depth-parser-utils/parse-depth-rest-request.util.ts:1`

**parseDepthRestRequest** utility function
`file:rest/input-request-parsers/depth-parser-utils/parse-depth-rest-request.util.ts:9`
Logic: if (!request.query.depth) { → return 0

### parse-ending-before-rest-request.util.ts
`file:rest/input-request-parsers/ending-before-parser-utils/parse-ending-before-rest-request.util.ts:1`

**parseEndingBeforeRestRequest** utility function
`file:rest/input-request-parsers/ending-before-parser-utils/parse-ending-before-rest-request.util.ts:4`
Logic: ): string | undefined => { → const cursorQuery = request.query?.ending_before

### add-default-conjunction.util.ts
`file:rest/input-request-parsers/filter-parser-utils/add-default-conjunction.util.ts:1`

**addDefaultConjunctionIfMissing** utility function
`file:rest/input-request-parsers/filter-parser-utils/add-default-conjunction.util.ts:8`
Logic: if (!ROOT_FILTER_CONJUNCTION_REGEX.test(filterQuery)) { → return `${DEFAULT_CONJUNCTION}(${filterQuery})`

### check-filter-query.util.ts
`file:rest/input-request-parsers/filter-parser-utils/check-filter-query.util.ts:1`

**checkFilterQuery** utility function
`file:rest/input-request-parsers/filter-parser-utils/check-filter-query.util.ts:8`
Logic: const countOpenedBrackets = (filterQuery.match(/\(/g) || []).length → const countClosedBrackets = (filterQuery.match(/\)/g) || []).length

### format-field-values.util.ts
`file:rest/input-request-parsers/filter-parser-utils/format-field-values.util.ts:1`

**formatFieldValue** utility function
`file:rest/input-request-parsers/filter-parser-utils/format-field-values.util.ts:8`
Logic: ): FieldValue => { → if (isDefined(comparator) && ['in', 'containsAny'].includes(comparator)) {

### parse-base-filter.util.ts
`file:rest/input-request-parsers/filter-parser-utils/parse-base-filter.util.ts:1`

**parseBaseFilter** utility function
`file:rest/input-request-parsers/filter-parser-utils/parse-base-filter.util.ts:23`
Logic: ): { → fields: string[]

### parse-filter-content.util.ts
`file:rest/input-request-parsers/filter-parser-utils/parse-filter-content.util.ts:1`

**parseFilterContent** utility function
`file:rest/input-request-parsers/filter-parser-utils/parse-filter-content.util.ts:1`
Logic: let isWithinBrackets = false → let isWithinDoubleQuotes = false

### parse-filter-rest-request.util.ts
`file:rest/input-request-parsers/filter-parser-utils/parse-filter-rest-request.util.ts:1`

**parseFilterRestRequest** utility function
`file:rest/input-request-parsers/filter-parser-utils/parse-filter-rest-request.util.ts:7`
Logic: ): Record<string, FieldValue> => { → let filterQuery = request.query.filter

### parse-filter.util.ts
`file:rest/input-request-parsers/filter-parser-utils/parse-filter.util.ts:1`

**parseFilter** utility function
`file:rest/input-request-parsers/filter-parser-utils/parse-filter.util.ts:24`
Logic: ): Record<string, FieldValue> => { → const result = {}

### parse-group-by-rest-request.util.ts
`file:rest/input-request-parsers/group-by-parser-utils/parse-group-by-rest-request.util.ts:1`

**parseGroupByRestRequest** utility function
`file:rest/input-request-parsers/group-by-parser-utils/parse-group-by-rest-request.util.ts:9`
Logic: ): ObjectRecordGroupBy => { → const groupByQuery = request.query.group_by

### parse-include-records-sample-rest-request.util.ts
`file:rest/input-request-parsers/group-by-with-records/parse-include-records-sample-rest-request.util.ts:1`

**parseIncludeRecordsSampleRestRequest** utility function
`file:rest/input-request-parsers/group-by-with-records/parse-include-records-sample-rest-request.util.ts:5`
Logic: ): boolean => { → if (!isDefined(request.query.include_records_sample)) {

### parse-limit-rest-request.util.ts
`file:rest/input-request-parsers/limit-parser-utils/parse-limit-rest-request.util.ts:1`

**parseLimitRestRequest** utility function
`file:rest/input-request-parsers/limit-parser-utils/parse-limit-rest-request.util.ts:13`
Logic: ): number => { → if (!request.query?.limit) {

### parse-omit-null-values-rest-request.util.ts
`file:rest/input-request-parsers/omit-null-values-parser-utils/parse-omit-null-values-rest-request.util.ts:1`

**parseOmitNullValuesRestRequest** utility function
`file:rest/input-request-parsers/omit-null-values-parser-utils/parse-omit-null-values-rest-request.util.ts:5`
Logic: ): boolean => { → if (!isDefined(request.query.omit_null_values)) {

### add-default-order-by-id.util.ts
`file:rest/input-request-parsers/order-by-parser-utils/add-default-order-by-id.util.ts:1`

**addDefaultOrderById** utility function
`file:rest/input-request-parsers/order-by-parser-utils/add-default-order-by-id.util.ts:5`
Logic: const hasIdOrder = orderBy.some((o) => Object.keys(o).includes('id')) → return hasIdOrder

### parse-order-by-rest-request.util.ts
`file:rest/input-request-parsers/order-by-parser-utils/parse-order-by-rest-request.util.ts:1`

**parseOrderByRestRequest** utility function
`file:rest/input-request-parsers/order-by-parser-utils/parse-order-by-rest-request.util.ts:6`
Logic: ): ObjectRecordOrderBy => { → const orderByQuery = request.query.order_by

### parse-order-by-rest-request-common.util.ts
`file:rest/input-request-parsers/order-by-parser-utils/utils/parse-order-by-rest-request-common.util.ts:1`

**parseOrderBy** utility function
`file:rest/input-request-parsers/order-by-parser-utils/utils/parse-order-by-rest-request-common.util.ts:15`
Logic: ): ObjectRecordOrderBy => { → if (typeof orderByQuery !== 'string') {

### parse-order-by-for-records-rest-request.util.ts
`file:rest/input-request-parsers/order-by-with-group-by-parser-utils/parse-order-by-for-records-rest-request.util.ts:1`

**parseOrderByForRecordsWithGroupByRestRequest** utility function
`file:rest/input-request-parsers/order-by-with-group-by-parser-utils/parse-order-by-for-records-rest-request.util.ts:6`
Logic: ): ObjectRecordOrderBy | undefined => { → const orderByForRecordsWithGroupByQuery = request.query.order_by_for_records

### parse-order-by-with-group-by-rest-request.util.ts
`file:rest/input-request-parsers/order-by-with-group-by-parser-utils/parse-order-by-with-group-by-rest-request.util.ts:1`

**parseOrderByWithGroupByRestRequest** utility function
`file:rest/input-request-parsers/order-by-with-group-by-parser-utils/parse-order-by-with-group-by-rest-request.util.ts:8`
Logic: ): OrderByWithGroupBy | undefined => { → const orderByWithGroupByQuery = request.query.order_by

### parse-core-path.utils.ts
`file:rest/input-request-parsers/path-parser-utils/parse-core-path.utils.ts:1`

**parseCorePath** utility function
`file:rest/input-request-parsers/path-parser-utils/parse-core-path.utils.ts:6`

### parse-soft-delete-rest-request.util.ts
`file:rest/input-request-parsers/soft-delete-parser-utils/parse-soft-delete-rest-request.util.ts:1`

**parseSoftDeleteRestRequest** utility function
`file:rest/input-request-parsers/soft-delete-parser-utils/parse-soft-delete-rest-request.util.ts:5`
Logic: ): boolean => { → if (!isDefined(request.query.soft_delete)) {

### parse-starting-after-rest-request.util.ts
`file:rest/input-request-parsers/starting-after-parser-utils/parse-starting-after-rest-request.util.ts:1`

**parseStartingAfterRestRequest** utility function
`file:rest/input-request-parsers/starting-after-parser-utils/parse-starting-after-rest-request.util.ts:4`
Logic: ): string | undefined => { → const cursorQuery = request.query?.starting_after

### parse-upsert-rest-request.util.ts
`file:rest/input-request-parsers/upsert-parser-utils/parse-upsert-rest-request.util.ts:1`

**parseUpsertRestRequest** utility function
`file:rest/input-request-parsers/upsert-parser-utils/parse-upsert-rest-request.util.ts:5`
Logic: ): boolean => { → if (!isDefined(request.query.upsert)) {

### parse-view-id-rest-request.util.ts
`file:rest/input-request-parsers/view-id-parser-utils/parse-view-id-rest-request.util.ts:1`

**parseViewIdRestRequest** utility function
`file:rest/input-request-parsers/view-id-parser-utils/parse-view-id-rest-request.util.ts:5`
Logic: ): string | undefined => { → if (

### workspace-query-runner-rest-api-exception-handler.util.ts
`file:rest/utils/workspace-query-runner-rest-api-exception-handler.util.ts:1`

**workspaceQueryRunnerRestApiExceptionHandler** utility function
`file:rest/utils/workspace-query-runner-rest-api-exception-handler.util.ts:19`
Logic: ): never => { → switch (true) {


## COMMON

### core-common-api.module.ts
`file:common/core-common-api.module.ts:1`

**CoreCommonApiModule** (Class)
`file:common/core-common-api.module.ts:59`
Exported service/class providing core functionality.

### query-runner-args.factory.ts
`file:common/common-args-processors/query-runner-args.factory.ts:1`

**QueryRunnerArgsFactory** (Class)
`file:common/common-args-processors/query-runner-args.factory.ts:10`
Exported service/class providing core functionality.

### data-arg-processor.service.ts
`file:common/common-args-processors/data-arg-processor/data-arg-processor.service.ts:1`

**DataArgProcessorService** (NestJS Service)
`file:common/common-args-processors/data-arg-processor/data-arg-processor.service.ts:67`
Exported service/class providing core functionality.

### transform-actor-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-actor-field.util.ts:1`

**transformActorField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-actor-field.util.ts:7`
Logic: value: { → source?: FieldActorSource | null

### transform-address-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-address-field.util.ts:1`

**transformAddressField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-address-field.util.ts:6`
Logic: value: { → addressStreet1?: string | null

### transform-array-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-array-field.util.ts:1`

**transformArrayField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-array-field.util.ts:4`
Logic: ): string[] | null => { → return [value]

### transform-currency-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-currency-field.util.ts:1`

**transformCurrencyField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-currency-field.util.ts:6`
Logic: value: { → amountMicros?: number | string | null

### transform-full-name-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-full-name-field.util.ts:1`

**transformFullNameField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-full-name-field.util.ts:5`
Logic: value: { → firstName?: string | null

### transform-numeric-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-numeric-field.util.ts:1`

**transformNumericField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-numeric-field.util.ts:3`
Logic: ): number | null => { → return isNull(value) ? null : Number(value)

### transform-raw-json-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-raw-json-field.util.ts:1`

**transformRawJsonField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-raw-json-field.util.ts:4`
Logic: ): object | string | null => { → return isNullEquivalentRawJsonFieldValue(value) ? null : value

### transform-text-field.util.ts
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-text-field.util.ts:1`

**transformTextField** utility function
`file:common/common-args-processors/data-arg-processor/transformer-utils/transform-text-field.util.ts:3`
Logic: return isNullEquivalentTextFieldValue(value) ? null : value

### file-item.guard.ts
`file:common/common-args-processors/data-arg-processor/types/file-item.guard.ts:1`

**isFileOutputArray** utility function
`file:common/common-args-processors/data-arg-processor/types/file-item.guard.ts:5`
Logic: return ( → Array.isArray(value) &&

### find-postgres-default-null-equivalent-value.util.ts
`file:common/common-args-processors/data-arg-processor/utils/find-postgres-default-null-equivalent-value.util.ts:1`

**findPostgresDefaultNullEquivalentValue** utility function
`file:common/common-args-processors/data-arg-processor/utils/find-postgres-default-null-equivalent-value.util.ts:10`
Logic: ) => { → switch (fieldMetadataType) {

### is-null-equivalent-array-field-value.util.ts
`file:common/common-args-processors/data-arg-processor/utils/is-null-equivalent-array-field-value.util.ts:1`

**isNullEquivalentArrayFieldValue** utility function
`file:common/common-args-processors/data-arg-processor/utils/is-null-equivalent-array-field-value.util.ts:1`
Logic: return (Array.isArray(value) && value.length === 0) || value === null

### is-null-equivalent-raw-json-field-value.util.ts
`file:common/common-args-processors/data-arg-processor/utils/is-null-equivalent-raw-json-field-value.util.ts:1`

**isNullEquivalentRawJsonFieldValue** utility function
`file:common/common-args-processors/data-arg-processor/utils/is-null-equivalent-raw-json-field-value.util.ts:4`
Logic: return true → return isEmptyObject(value)

### is-null-equivalent-text-field-value.util.ts
`file:common/common-args-processors/data-arg-processor/utils/is-null-equivalent-text-field-value.util.ts:1`

**isNullEquivalentTextFieldValue** utility function
`file:common/common-args-processors/data-arg-processor/utils/is-null-equivalent-text-field-value.util.ts:5`
Logic: return true → return isString(value) && value === DEFAULT_TEXT_FIELD_NULL_EQUIVALENT_VALUE

### is-relation-nested-operation.util.ts
`file:common/common-args-processors/data-arg-processor/utils/is-relation-nested-operation.util.ts:1`

**isRelationNestedOperation** utility function
`file:common/common-args-processors/data-arg-processor/utils/is-relation-nested-operation.util.ts:7`
Logic: if (!isObject(value)) { → return false

### validate-actor-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-actor-field-or-throw.util.ts:1`

**validateActorFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-actor-field-or-throw.util.ts:14`

### validate-address-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-address-field-or-throw.util.ts:1`

**validateAddressFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-address-field-or-throw.util.ts:12`
Logic: ): { → addressStreet1?: string | null

### validate-array-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-array-field-or-throw.util.ts:1`

**validateArrayFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-array-field-or-throw.util.ts:11`
Logic: ): string | string[] | null => { → return null

### validate-boolean-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-boolean-field-or-throw.util.ts:1`

**validateBooleanFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-boolean-field-or-throw.util.ts:11`
Logic: ): boolean | null => { → if (!isBoolean(value) && !isNull(value)) {

### validate-currency-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-currency-field-or-throw.util.ts:1`

**validateCurrencyFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-currency-field-or-throw.util.ts:12`
Logic: ): { → amountMicros?: number | string | null

### validate-date-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-date-field-or-throw.util.ts:1`

**validateDateFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-date-field-or-throw.util.ts:46`
Logic: ): unknown => { → return null

### validate-date-time-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-date-time-field-or-throw.util.ts:1`

**validateDateTimeFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-date-time-field-or-throw.util.ts:49`
Logic: ): unknown => { → return null

### validate-emails-additional-emails-subfield-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-emails-additional-emails-subfield-or-throw.util.ts:1`

**validateEmailsAdditionalEmailsSubfieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-emails-additional-emails-subfield-or-throw.util.ts:12`
Logic: ): string | string[] | null => { → return null

### validate-emails-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-emails-field-or-throw.util.ts:1`

**validateEmailsFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-emails-field-or-throw.util.ts:12`
Logic: ): { → primaryEmail?: string | null

### validate-emails-primary-email-subfield-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-emails-primary-email-subfield-or-throw.util.ts:1`

**validateEmailsPrimaryEmailSubfieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-emails-primary-email-subfield-or-throw.util.ts:12`
Logic: ): string | null => { → return null

### validate-files-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-files-field-or-throw.util.ts:1`

**validateFilesFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-files-field-or-throw.util.ts:26`
Logic: ): FileInput[] | null => { → return null

### validate-full-name-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-full-name-field-or-throw.util.ts:1`

**validateFullNameFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-full-name-field-or-throw.util.ts:11`
Logic: ): { → firstName?: string | null

### validate-links-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-links-field-or-throw.util.ts:1`

**validateLinksFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-links-field-or-throw.util.ts:12`
Logic: ): LinksFieldGraphQLInput | null => { → const preValidatedValue = validateRawJsonFieldOrThrow(value, fieldName)

### validate-multi-select-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-multi-select-field-or-throw.util.ts:1`

**validateMultiSelectFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-multi-select-field-or-throw.util.ts:14`
Logic: ): string | string[] | null => { → const preValidatedValue = validateArrayFieldOrThrow(value, fieldName)

### validate-number-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-number-field-or-throw.util.ts:1`

**validateNumberFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-number-field-or-throw.util.ts:11`
Logic: ): number | null => { → if (

### validate-numeric-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-numeric-field-or-throw.util.ts:1`

**validateNumericFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-numeric-field-or-throw.util.ts:7`
Logic: ): number | string | null => { → return null

### validate-overridden-position-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-overridden-position-field-or-throw.util.ts:1`

**validateOverriddenPositionFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-overridden-position-field-or-throw.util.ts:10`
Logic: ): number | null => { → if (

### validate-phones-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-phones-field-or-throw.util.ts:1`

**validatePhonesFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-phones-field-or-throw.util.ts:12`
Logic: ): PhonesFieldGraphQLInput => { → const preValidatedValue = validateRawJsonFieldOrThrow(value, fieldName)

### validate-rating-and-select-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-rating-and-select-field-or-throw.util.ts:1`

**validateRatingAndSelectFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-rating-and-select-field-or-throw.util.ts:12`
Logic: ): string | null => { → const preValidatedValue = validateTextFieldOrThrow(value, fieldName)

### validate-raw-json-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-raw-json-field-or-throw.util.ts:1`

**validateRawJsonFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-raw-json-field-or-throw.util.ts:11`
Logic: ): object | string | null => { → return null

### validate-rich-text-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-rich-text-field-or-throw.util.ts:1`

**validateRichTextFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-rich-text-field-or-throw.util.ts:73`
Logic: ): { → blocknote?: string | null

### validate-text-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-text-field-or-throw.util.ts:1`

**validateTextFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-text-field-or-throw.util.ts:11`
Logic: ): string | null => { → if (typeof value !== 'string' && !isNull(value)) {

### validate-uuid-field-or-throw.util.ts
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-uuid-field-or-throw.util.ts:1`

**validateUUIDFieldOrThrow** utility function
`file:common/common-args-processors/data-arg-processor/validator-utils/validate-uuid-field-or-throw.util.ts:12`
Logic: ): string | null => { → if (

### filter-arg-processor.service.ts
`file:common/common-args-processors/filter-arg-processor/filter-arg-processor.service.ts:1`

**FilterArgProcessorService** (NestJS Service)
`file:common/common-args-processors/filter-arg-processor/filter-arg-processor.service.ts:45`
Exported service/class providing core functionality.

### get-operators-for-field-type.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/get-operators-for-field-type.util.ts:1`

**getOperatorsForFieldType** utility function
`file:common/common-args-processors/filter-arg-processor/utils/get-operators-for-field-type.util.ts:18`
Logic: ): FilterOperator[] => { → switch (fieldType) {

### parse-number-value.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/parse-number-value.util.ts:1`

**parseNumberValue** utility function
`file:common/common-args-processors/filter-arg-processor/utils/parse-number-value.util.ts:4`
Logic: ): unknown => { → if (typeof value !== 'string') {

### validate-and-transform-array-items.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-array-items.util.ts:1`

**validateAndTransformArrayItems** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-array-items.util.ts:5`
Logic: ): unknown[] => { → return values.map((item) => {

### validate-and-transform-operator-and-value.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-operator-and-value.util.ts:1`

**validateAndTransformOperatorAndValue** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-operator-and-value.util.ts:13`
Logic: ): Record<string, unknown> => { → if (filterValue === null || typeof filterValue !== 'object') {

### validate-and-transform-value-by-field-type.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-value-by-field-type.util.ts:1`

**validateAndTransformValueByFieldType** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-value-by-field-type.util.ts:13`
Logic: ): unknown => { → const fieldType = fieldMetadata.type

### validate-and-transform-value-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-value-or-throw.util.ts:1`

**validateAndTransformValueOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-and-transform-value-or-throw.util.ts:11`
Logic: ): unknown => { → switch (operator) {

### validate-array-operator-value-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-array-operator-value-or-throw.util.ts:1`

**validateArrayOperatorValueOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-array-operator-value-or-throw.util.ts:9`
Logic: ): void => { → if (!Array.isArray(value)) {

### validate-is-empty-array-operator-value-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-is-empty-array-operator-value-or-throw.util.ts:1`

**validateIsEmptyArrayOperatorValueOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-is-empty-array-operator-value-or-throw.util.ts:9`
Logic: ): void => { → if (!isBoolean(value)) {

### validate-is-operator-filter-value-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-is-operator-filter-value-or-throw.util.ts:1`

**validateIsOperatorFilterValueOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-is-operator-filter-value-or-throw.util.ts:8`
Logic: if (value !== 'NULL' && value !== 'NOT_NULL') { → throw new CommonQueryRunnerException(

### validate-operator-for-field-type-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-operator-for-field-type-or-throw.util.ts:1`

**validateOperatorForFieldTypeOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-operator-for-field-type-or-throw.util.ts:11`
Logic: ): void => { → const allowedOperators = getOperatorsForFieldType(fieldMetadata.type)

### validate-string-operator-value-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/utils/validate-string-operator-value-or-throw.util.ts:1`

**validateStringOperatorValueOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/utils/validate-string-operator-value-or-throw.util.ts:10`
Logic: ): void => { → if (!isString(value)) {

### validate-boolean-field-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-boolean-field-or-throw.util.ts:1`

**validateBooleanFieldOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-boolean-field-or-throw.util.ts:11`
Logic: ): boolean | null => { → if (!isBoolean(value) && !isNull(value)) {

### validate-date-field-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-date-field-or-throw.util.ts:1`

**validateDateFieldOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-date-field-or-throw.util.ts:46`
Logic: ): unknown => { → return null

### validate-date-time-field-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-date-time-field-or-throw.util.ts:1`

**validateDateTimeFieldOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-date-time-field-or-throw.util.ts:49`
Logic: ): unknown => { → return null

### validate-number-field-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-number-field-or-throw.util.ts:1`

**validateNumberFieldOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-number-field-or-throw.util.ts:11`
Logic: ): number | null => { → if (

### validate-uuid-field-or-throw.util.ts
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-uuid-field-or-throw.util.ts:1`

**validateUUIDFieldOrThrow** utility function
`file:common/common-args-processors/filter-arg-processor/validator-utils/validate-uuid-field-or-throw.util.ts:12`
Logic: ): string | null => { → if (

### group-by-arg-processor.service.ts
`file:common/common-args-processors/group-by-arg-processor/group-by-arg-processor.service.ts:1`

**GroupByArgProcessorService** (NestJS Service)
`file:common/common-args-processors/group-by-arg-processor/group-by-arg-processor.service.ts:31`
Exported service/class providing core functionality.

### is-group-by-date-field-definition.util.ts
`file:common/common-args-processors/group-by-arg-processor/utils/is-group-by-date-field-definition.util.ts:1`

**isGroupByDateFieldDefinition** utility function
`file:common/common-args-processors/group-by-arg-processor/utils/is-group-by-date-field-definition.util.ts:10`
Logic: ): fieldGroupByDefinition is DateFieldGroupByDefinition => { → if (!isPlainObject(fieldGroupByDefinition)) {

### is-relation-nested-field-supported-in-group-by.util.ts
`file:common/common-args-processors/group-by-arg-processor/utils/is-relation-nested-field-supported-in-group-by.util.ts:1`

**isRelationNestedFieldSupportedInGroupBy** utility function
`file:common/common-args-processors/group-by-arg-processor/utils/is-relation-nested-field-supported-in-group-by.util.ts:4`
Logic: nestedFieldName, → nestedFieldMetadata,

### validate-and-transform-group-by-fields-or-throw.util.ts
`file:common/common-args-processors/group-by-arg-processor/utils/validate-and-transform-group-by-fields-or-throw.util.ts:1`

**validateAndTransformGroupByFieldsOrThrow** utility function
`file:common/common-args-processors/group-by-arg-processor/utils/validate-and-transform-group-by-fields-or-throw.util.ts:227`
Logic: groupBy, → flatObjectMetadata,

### validate-and-transform-relation-group-by-field-or-throw.util.ts
`file:common/common-args-processors/group-by-arg-processor/utils/validate-and-transform-relation-group-by-field-or-throw.util.ts:1`

**validateAndTransformRelationGroupByFieldOrThrow** utility function
`file:common/common-args-processors/group-by-arg-processor/utils/validate-and-transform-relation-group-by-field-or-throw.util.ts:176`
Logic: fieldNames, → fieldName,

### validate-single-key-for-group-by-or-throw.util.ts
`file:common/common-args-processors/group-by-arg-processor/utils/validate-single-key-for-group-by-or-throw.util.ts:1`

**validateSingleKeyForGroupByOrThrow** utility function
`file:common/common-args-processors/group-by-arg-processor/utils/validate-single-key-for-group-by-or-throw.util.ts:7`
Logic: groupByKeys, → errorMessage,

### order-by-arg-processor.service.ts
`file:common/common-args-processors/order-by-arg-processor/order-by-arg-processor.service.ts:1`

**OrderByArgProcessorService** (NestJS Service)
`file:common/common-args-processors/order-by-arg-processor/order-by-arg-processor.service.ts:10`
Exported service/class providing core functionality.

### order-by-with-group-by-arg-processor.service.ts
`file:common/common-args-processors/order-by-with-group-by-arg-processor/order-by-with-group-by-arg-processor.service.ts:1`

**OrderByWithGroupByArgProcessorService** (NestJS Service)
`file:common/common-args-processors/order-by-with-group-by-arg-processor/order-by-with-group-by-arg-processor.service.ts:13`
Exported service/class providing core functionality.

### process-nested-relations-v2.helper.ts
`file:common/common-nested-relations-processor/process-nested-relations-v2.helper.ts:1`

**ProcessNestedRelationsV2Helper** (Class)
`file:common/common-nested-relations-processor/process-nested-relations-v2.helper.ts:34`
Exported service/class providing core functionality.

### process-nested-relations.helper.ts
`file:common/common-nested-relations-processor/process-nested-relations.helper.ts:1`

**ProcessNestedRelationsHelper** (Class)
`file:common/common-nested-relations-processor/process-nested-relations.helper.ts:16`
Exported service/class providing core functionality.

### common-base-query-runner.service.ts
`file:common/common-query-runners/common-base-query-runner.service.ts:1`

**CommonBaseQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-base-query-runner.service.ts:60`
Exported service/class providing core functionality.

### common-create-one-query-runner.service.ts
`file:common/common-query-runners/common-create-one-query-runner.service.ts:1`

**CommonCreateOneQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-create-one-query-runner.service.ts:24`
Exported service/class providing core functionality.

### common-delete-many-query-runner.service.ts
`file:common/common-query-runners/common-delete-many-query-runner.service.ts:1`

**CommonDeleteManyQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-delete-many-query-runner.service.ts:32`
Exported service/class providing core functionality.

### common-delete-one-query-runner.service.ts
`file:common/common-query-runners/common-delete-one-query-runner.service.ts:1`

**CommonDeleteOneQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-delete-one-query-runner.service.ts:29`
Exported service/class providing core functionality.

### common-destroy-many-query-runner.service.ts
`file:common/common-query-runners/common-destroy-many-query-runner.service.ts:1`

**CommonDestroyManyQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-destroy-many-query-runner.service.ts:32`
Exported service/class providing core functionality.

### common-destroy-one-query-runner.service.ts
`file:common/common-query-runners/common-destroy-one-query-runner.service.ts:1`

**CommonDestroyOneQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-destroy-one-query-runner.service.ts:28`
Exported service/class providing core functionality.

### common-find-duplicates-query-runner.service.ts
`file:common/common-query-runners/common-find-duplicates-query-runner.service.ts:1`

**CommonFindDuplicatesQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-find-duplicates-query-runner.service.ts:37`
Exported service/class providing core functionality.

### common-find-many-query-runner.service.ts
`file:common/common-query-runners/common-find-many-query-runner.service.ts:1`

**CommonFindManyQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-find-many-query-runner.service.ts:48`
Exported service/class providing core functionality.

### common-find-one-query-runner.service.ts
`file:common/common-query-runners/common-find-one-query-runner.service.ts:1`

**CommonFindOneQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-find-one-query-runner.service.ts:32`
Exported service/class providing core functionality.

### common-group-by-query-runner.service.ts
`file:common/common-query-runners/common-group-by-query-runner.service.ts:1`

**CommonGroupByQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-group-by-query-runner.service.ts:61`
Exported service/class providing core functionality.

### common-merge-many-query-runner.service.ts
`file:common/common-query-runners/common-merge-many-query-runner.service.ts:1`

**CommonMergeManyQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-merge-many-query-runner.service.ts:47`
Exported service/class providing core functionality.

### common-restore-many-query-runner.service.ts
`file:common/common-query-runners/common-restore-many-query-runner.service.ts:1`

**CommonRestoreManyQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-restore-many-query-runner.service.ts:32`
Exported service/class providing core functionality.

### common-restore-one-query-runner.service.ts
`file:common/common-query-runners/common-restore-one-query-runner.service.ts:1`

**CommonRestoreOneQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-restore-one-query-runner.service.ts:29`
Exported service/class providing core functionality.

### common-update-many-query-runner.service.ts
`file:common/common-query-runners/common-update-many-query-runner.service.ts:1`

**CommonUpdateManyQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-update-many-query-runner.service.ts:32`
Exported service/class providing core functionality.

### common-update-one-query-runner.service.ts
`file:common/common-query-runners/common-update-one-query-runner.service.ts:1`

**CommonUpdateOneQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-update-one-query-runner.service.ts:28`
Exported service/class providing core functionality.

### common-create-many-query-runner.service.ts
`file:common/common-query-runners/common-create-many-query-runner/common-create-many-query-runner.service.ts:1`

**CommonCreateManyQueryRunnerService** (NestJS Service)
`file:common/common-query-runners/common-create-many-query-runner/common-create-many-query-runner.service.ts:45`
Exported service/class providing core functionality.

### build-where-conditions.util.ts
`file:common/common-query-runners/common-create-many-query-runner/utils/build-where-conditions.util.ts:1`

**buildWhereConditions** utility function
`file:common/common-query-runners/common-create-many-query-runner/utils/build-where-conditions.util.ts:8`
Logic: ): Record<string, FindOperator<string>>[] => { → const whereConditions: Record<string, FindOperator<string>>[] = []

### categorize-records.util.ts
`file:common/common-query-runners/common-create-many-query-runner/utils/categorize-records.util.ts:1`

**categorizeRecords** utility function
`file:common/common-query-runners/common-create-many-query-runner/utils/categorize-records.util.ts:8`
Logic: ): { → recordsToUpdate: PartialObjectRecordWithId[]

### get-conflicting-fields.util.ts
`file:common/common-query-runners/common-create-many-query-runner/utils/get-conflicting-fields.util.ts:1`

**getConflictingFields** utility function
`file:common/common-query-runners/common-create-many-query-runner/utils/get-conflicting-fields.util.ts:10`
Logic: ): ConflictingFieldGroup[] => { → return getFlatFieldsFromFlatObjectMetadata(

### get-matching-record-id.util.ts
`file:common/common-query-runners/common-create-many-query-runner/utils/get-matching-record-id.util.ts:1`

**getMatchingRecordId** utility function
`file:common/common-query-runners/common-create-many-query-runner/utils/get-matching-record-id.util.ts:13`
Logic: ): string | undefined => { → const matchingRecordIds = conflictingFieldGroups.reduce<string[]>(

### get-value-from-path.util.ts
`file:common/common-query-runners/common-create-many-query-runner/utils/get-value-from-path.util.ts:1`

**getValueFromPath** utility function
`file:common/common-query-runners/common-create-many-query-runner/utils/get-value-from-path.util.ts:3`
Logic: ): string | undefined => { → const pathParts = path.split('.')

### common-query-runner.exception.ts
`file:common/common-query-runners/errors/common-query-runner.exception.ts:1`

**CommonQueryRunnerException** (Class)
`file:common/common-query-runners/errors/common-query-runner.exception.ts:25`
Exported service/class providing core functionality.

### build-mutation-query-builder.util.ts
`file:common/common-query-runners/utils/build-mutation-query-builder.util.ts:1`

**buildMutationQueryBuilder** utility function
`file:common/common-query-runners/utils/build-mutation-query-builder.util.ts:21`
Logic: repository, → alias,

### common-query-runner-to-graphql-api-exception-handler.util.ts
`file:common/common-query-runners/utils/common-query-runner-to-graphql-api-exception-handler.util.ts:1`

**commonQueryRunnerToGraphqlApiExceptionHandler** utility function
`file:common/common-query-runners/utils/common-query-runner-to-graphql-api-exception-handler.util.ts:14`
Logic: ) => { → switch (error.code) {

### common-query-runner-to-rest-api-exception-handler.util.ts
`file:common/common-query-runners/utils/common-query-runner-to-rest-api-exception-handler.util.ts:1`

**commonQueryRunnerToRestApiExceptionHandler** utility function
`file:common/common-query-runners/utils/common-query-runner-to-rest-api-exception-handler.util.ts:15`
Logic: ): never => { → switch (error.code) {

### get-group-by-definitions.util.ts
`file:common/common-query-runners/utils/get-group-by-definitions.util.ts:1`

**getGroupByDefinitions** utility function
`file:common/common-query-runners/utils/get-group-by-definitions.util.ts:9`
Logic: groupByFields, → objectMetadataNameSingular,

### get-group-by-expression.util.ts
`file:common/common-query-runners/utils/get-group-by-expression.util.ts:1`

**getGroupByExpression** utility function
`file:common/common-query-runners/utils/get-group-by-expression.util.ts:23`
Logic: groupByField, → columnNameWithQuotes,

### get-group-by-order-expression.util.ts
`file:common/common-query-runners/utils/get-group-by-order-expression.util.ts:1`

**getGroupByOrderExpression** utility function
`file:common/common-query-runners/utils/get-group-by-order-expression.util.ts:47`
Logic: groupByField, → columnNameWithQuotes,

### get-object-alias-for-group-by.util.ts
`file:common/common-query-runners/utils/get-object-alias-for-group-by.util.ts:1`

**getObjectAlias** utility function
`file:common/common-query-runners/utils/get-object-alias-for-group-by.util.ts:3`
Logic: ): string => { → return flatObjectMetadata.nameSingular

### is-group-by-date-field.util.ts
`file:common/common-query-runners/utils/is-group-by-date-field.util.ts:1`

**isGroupByDateField** utility function
`file:common/common-query-runners/utils/is-group-by-date-field.util.ts:6`
Logic: ): groupByField is GroupByDateField => { → return (

### is-group-by-relation-field.util.ts
`file:common/common-query-runners/utils/is-group-by-relation-field.util.ts:1`

**isGroupByRelationField** utility function
`file:common/common-query-runners/utils/is-group-by-relation-field.util.ts:6`
Logic: ): groupByField is GroupByRelationField => { → return 'nestedFieldMetadata' in groupByField

### remove-quote.util.ts
`file:common/common-query-runners/utils/remove-quote.util.ts:1`

**formatColumnNameAsAlias** utility function
`file:common/common-query-runners/utils/remove-quote.util.ts:5`
Logic: ): string => { → return removeQuotes(columnNameWithQuotes).replace(/\./g, '_')

### common-result-getters.service.ts
`file:common/common-result-getters/common-result-getters.service.ts:1`

**CommonResultGettersService** (NestJS Service)
`file:common/common-result-getters/common-result-getters.service.ts:32`
Exported service/class providing core functionality.

### files-field-query-result-getter.handler.ts
`file:common/common-result-getters/handlers/field-handlers/files-field-query-result-getter.handler.ts:1`

**FilesFieldQueryResultGetterHandler** (Class)
`file:common/common-result-getters/handlers/field-handlers/files-field-query-result-getter.handler.ts:14`
Exported service/class providing core functionality.

### rich-text-field-query-result-getter.handler.ts
`file:common/common-result-getters/handlers/field-handlers/rich-text-field-query-result-getter.handler.ts:1`

**RichTextFieldQueryResultGetterHandler** (Class)
`file:common/common-result-getters/handlers/field-handlers/rich-text-field-query-result-getter.handler.ts:33`
Exported service/class providing core functionality.

### common-select-fields-helper.ts
`file:common/common-select-fields/common-select-fields-helper.ts:1`

**CommonSelectFieldsHelper** (Class)
`file:common/common-select-fields/common-select-fields-helper.ts:23`
Exported service/class providing core functionality.

### get-all-selectable-fields.util.ts
`file:common/common-select-fields/utils/get-all-selectable-fields.util.ts:1`

**getAllSelectableFields** utility function
`file:common/common-select-fields/utils/get-all-selectable-fields.util.ts:25`
Logic: restrictedFields, → flatObjectMetadata,

### get-is-flat-field-a-join-column.util.ts
`file:common/common-select-fields/utils/get-is-flat-field-a-join-column.util.ts:1`

**getIsFlatFieldAJoinColumn** utility function
`file:common/common-select-fields/utils/get-is-flat-field-a-join-column.util.ts:5`
Logic: flatField,

### get-is-flat-field-a-junction-relation-field.ts
`file:common/common-select-fields/utils/get-is-flat-field-a-junction-relation-field.ts:1`

**getIsFlatFieldAJunctionRelationField** utility function
`file:common/common-select-fields/utils/get-is-flat-field-a-junction-relation-field.ts:6`
Logic: flatField,

### get-should-recurse-into-relation.ts
`file:common/common-select-fields/utils/get-should-recurse-into-relation.ts:1`

**getShouldRecurseIntoRelation** utility function
`file:common/common-select-fields/utils/get-should-recurse-into-relation.ts:7`
Logic: depth, → flatField,

### common-query-args.type.ts
`file:common/types/common-query-args.type.ts:1`

**FindOneQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:42`
Exported service/class providing core functionality.

**FindManyQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:46`
Exported service/class providing core functionality.

**CreateManyQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:56`
Exported service/class providing core functionality.

**CreateOneQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:61`
Exported service/class providing core functionality.

**GroupByQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:65`
Exported service/class providing core functionality.

**DestroyOneQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:76`
Exported service/class providing core functionality.

**DestroyManyQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:80`
Exported service/class providing core functionality.

**DeleteOneQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:84`
Exported service/class providing core functionality.

**DeleteManyQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:88`
Exported service/class providing core functionality.

**UpdateOneQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:92`
Exported service/class providing core functionality.

**UpdateManyQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:97`
Exported service/class providing core functionality.

**FindDuplicatesQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:102`
Exported service/class providing core functionality.

**RestoreManyQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:107`
Exported service/class providing core functionality.

**RestoreOneQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:111`
Exported service/class providing core functionality.

**MergeManyQueryArgs** (Class)
`file:common/types/common-query-args.type.ts:115`
Exported service/class providing core functionality.

### common-selected-fields-result.type.ts
`file:common/types/common-selected-fields-result.type.ts:1`

**CommonSelectedFields** (Class)
`file:common/types/common-selected-fields-result.type.ts:3`
Exported service/class providing core functionality.

### get-page-info.util.ts
`file:common/utils/get-page-info.util.ts:1`

**getPageInfo** utility function
`file:common/utils/get-page-info.util.ts:11`
Logic: ): CommonPageInfo => { → const { hasNextPage, hasPreviousPage, hasMoreRecords } = getPaginationInfo(


## MCP

### mcp.module.ts
`file:mcp/mcp.module.ts:1`

**McpModule** (Class)
`file:mcp/mcp.module.ts:39`
Exported service/class providing core functionality.

### mcp-core.controller.ts
`file:mcp/controllers/mcp-core.controller.ts:1`

**McpCoreController** (Class)
`file:mcp/controllers/mcp-core.controller.ts:36`
Exported service/class providing core functionality.

### string-or-number.ts
`file:mcp/decorators/string-or-number.ts:1`

**IsNumberOrString** (Class)
`file:mcp/decorators/string-or-number.ts:7`
Exported service/class providing core functionality.

### json-rpc.ts
`file:mcp/dtos/json-rpc.ts:1`

**JsonRpc** (Class)
`file:mcp/dtos/json-rpc.ts:13`
Exported service/class providing core functionality.

### mcp-auth.guard.ts
`file:mcp/guards/mcp-auth.guard.ts:1`

**McpAuthGuard** (Class)
`file:mcp/guards/mcp-auth.guard.ts:18`
Exported service/class providing core functionality.

### mcp-method-guard.middleware.ts
`file:mcp/middlewares/mcp-method-guard.middleware.ts:1`

**McpMethodGuardMiddleware** (Class)
`file:mcp/middlewares/mcp-method-guard.middleware.ts:12`
Exported service/class providing core functionality.

### mcp-protocol.service.ts
`file:mcp/services/mcp-protocol.service.ts:1`

**McpProtocolService** (NestJS Service)
`file:mcp/services/mcp-protocol.service.ts:76`
Exported service/class providing core functionality.

### mcp-tool-executor.service.ts
`file:mcp/services/mcp-tool-executor.service.ts:1`

**McpToolExecutorService** (NestJS Service)
`file:mcp/services/mcp-tool-executor.service.ts:27`
Exported service/class providing core functionality.

### wrap-jsonrpc-response.util.ts
`file:mcp/utils/wrap-jsonrpc-response.util.ts:1`

**wrapJsonRpcResponse** utility function
`file:mcp/utils/wrap-jsonrpc-response.util.ts:1`
Logic: ) => { → return {

### write-sse-event.util.ts
`file:mcp/utils/write-sse-event.util.ts:1`

**writeSseEvent** utility function
`file:mcp/utils/write-sse-event.util.ts:3`
Logic: ): void => { → if (!response.headersSent) {


## UTILS

### assert-create-many-args.util.ts
`file:graphql/direct-execution/utils/assert-create-many-args.util.ts:1`

**assertCreateManyArgs** utility function
`file:graphql/direct-execution/utils/assert-create-many-args.util.ts:12`
Logic: ): asserts args is CreateManyResolverArgs { → if (!isObject(args)) {

### assert-create-one-args.util.ts
`file:graphql/direct-execution/utils/assert-create-one-args.util.ts:1`

**assertCreateOneArgs** utility function
`file:graphql/direct-execution/utils/assert-create-one-args.util.ts:12`
Logic: ): asserts args is CreateOneResolverArgs { → if (!isObject(args)) {

### assert-delete-many-args.util.ts
`file:graphql/direct-execution/utils/assert-delete-many-args.util.ts:1`

**assertDeleteManyArgs** utility function
`file:graphql/direct-execution/utils/assert-delete-many-args.util.ts:10`
Logic: ): asserts args is DeleteManyResolverArgs { → if (!isObject(args)) {

### assert-delete-one-args.util.ts
`file:graphql/direct-execution/utils/assert-delete-one-args.util.ts:1`

**assertDeleteOneArgs** utility function
`file:graphql/direct-execution/utils/assert-delete-one-args.util.ts:12`
Logic: ): asserts args is DeleteOneResolverArgs { → if (!isObject(args)) {

### assert-destroy-many-args.util.ts
`file:graphql/direct-execution/utils/assert-destroy-many-args.util.ts:1`

**assertDestroyManyArgs** utility function
`file:graphql/direct-execution/utils/assert-destroy-many-args.util.ts:10`
Logic: ): asserts args is DestroyManyResolverArgs { → if (!isObject(args)) {

### assert-destroy-one-args.util.ts
`file:graphql/direct-execution/utils/assert-destroy-one-args.util.ts:1`

**assertDestroyOneArgs** utility function
`file:graphql/direct-execution/utils/assert-destroy-one-args.util.ts:12`
Logic: ): asserts args is DestroyOneResolverArgs { → if (!isObject(args)) {

### assert-find-duplicates-args.util.ts
`file:graphql/direct-execution/utils/assert-find-duplicates-args.util.ts:1`

**assertFindDuplicatesArgs** utility function
`file:graphql/direct-execution/utils/assert-find-duplicates-args.util.ts:12`
Logic: ): asserts args is FindDuplicatesResolverArgs { → if (!isObject(args)) {

### assert-find-many-args.util.ts
`file:graphql/direct-execution/utils/assert-find-many-args.util.ts:1`

**assertFindManyArgs** utility function
`file:graphql/direct-execution/utils/assert-find-many-args.util.ts:12`
Logic: ): asserts args is FindManyResolverArgs { → if (!isObject(args)) {

### assert-find-one-args.util.ts
`file:graphql/direct-execution/utils/assert-find-one-args.util.ts:1`

**assertFindOneArgs** utility function
`file:graphql/direct-execution/utils/assert-find-one-args.util.ts:12`
Logic: ): asserts args is FindOneResolverArgs { → if (!isObject(args)) {

### assert-group-by-args.util.ts
`file:graphql/direct-execution/utils/assert-group-by-args.util.ts:1`

**assertGroupByArgs** utility function
`file:graphql/direct-execution/utils/assert-group-by-args.util.ts:18`
Logic: ): asserts args is GroupByResolverArgs { → if (!isObject(args)) {

### assert-merge-many-args.util.ts
`file:graphql/direct-execution/utils/assert-merge-many-args.util.ts:1`

**assertMergeManyArgs** utility function
`file:graphql/direct-execution/utils/assert-merge-many-args.util.ts:12`
Logic: ): asserts args is MergeManyResolverArgs { → if (!isObject(args)) {

### assert-restore-many-args.util.ts
`file:graphql/direct-execution/utils/assert-restore-many-args.util.ts:1`

**assertRestoreManyArgs** utility function
`file:graphql/direct-execution/utils/assert-restore-many-args.util.ts:10`
Logic: ): asserts args is RestoreManyResolverArgs { → if (!isObject(args)) {

### assert-restore-one-args.util.ts
`file:graphql/direct-execution/utils/assert-restore-one-args.util.ts:1`

**assertRestoreOneArgs** utility function
`file:graphql/direct-execution/utils/assert-restore-one-args.util.ts:11`
Logic: ): asserts args is RestoreOneResolverArgs { → if (!isObject(args)) {

### assert-update-many-args.util.ts
`file:graphql/direct-execution/utils/assert-update-many-args.util.ts:1`

**assertUpdateManyArgs** utility function
`file:graphql/direct-execution/utils/assert-update-many-args.util.ts:10`
Logic: ): asserts args is UpdateManyResolverArgs { → if (!isObject(args)) {

### assert-update-one-args.util.ts
`file:graphql/direct-execution/utils/assert-update-one-args.util.ts:1`

**assertUpdateOneArgs** utility function
`file:graphql/direct-execution/utils/assert-update-one-args.util.ts:12`
Logic: ): asserts args is UpdateOneResolverArgs { → if (!isObject(args)) {

### build-resolver-name-map.util.ts
`file:graphql/direct-execution/utils/build-resolver-name-map.util.ts:1`

**buildResolverNameMap** utility function
`file:graphql/direct-execution/utils/build-resolver-name-map.util.ts:15`
Logic: ): Record<string, ResolverNameMapEntry> => { → const map: Record<string, ResolverNameMapEntry> = {}

### build-workspace-schema-builder-context.util.ts
`file:graphql/direct-execution/utils/build-workspace-schema-builder-context.util.ts:1`

**buildWorkspaceSchemaBuilderContext** utility function
`file:graphql/direct-execution/utils/build-workspace-schema-builder-context.util.ts:7`
Logic: ): WorkspaceSchemaBuilderContext => { → const flatObjectMetadata =

### classify-top-level-fields.util.ts
`file:graphql/direct-execution/utils/classify-top-level-fields.util.ts:1`

**classifyTopLevelFields** utility function
`file:graphql/direct-execution/utils/classify-top-level-fields.util.ts:13`
Logic: ): TopLevelFieldsClassification => { → const topLevelFields = graphQLExtractTopLevelFields(document, operationName)

### extract-arguments-from-ast.util.ts
`file:graphql/direct-execution/utils/extract-arguments-from-ast.util.ts:1`

**extractArgumentsFromAst** utility function
`file:graphql/direct-execution/utils/extract-arguments-from-ast.util.ts:6`
Logic: ): Record<string, unknown> => { → if (!argumentNodes || argumentNodes.length === 0) {

### find-operation-definition.util.ts
`file:graphql/direct-execution/utils/find-operation-definition.util.ts:1`

**findOperationDefinition** utility function
`file:graphql/direct-execution/utils/find-operation-definition.util.ts:8`
Logic: ): OperationDefinitionNode | undefined => { → const operations = document.definitions.filter(

### graphql-build-fragment-map.util.ts
`file:graphql/direct-execution/utils/graphql-build-fragment-map.util.ts:1`

**graphQLBuildFragmentMap** utility function
`file:graphql/direct-execution/utils/graphql-build-fragment-map.util.ts:3`
Logic: ): Map<string, FragmentDefinitionNode> => { → const map = new Map<string, FragmentDefinitionNode>()

### graphql-build-partial-resolve-info.util.ts
`file:graphql/direct-execution/utils/graphql-build-partial-resolve-info.util.ts:1`

**graphQLBuildPartialResolveInfo** utility function
`file:graphql/direct-execution/utils/graphql-build-partial-resolve-info.util.ts:7`
Logic: ): Pick<GraphQLResolveInfo, 'fieldNodes' | 'fragments'> => ({ → fieldNodes: [field],

### graphql-direct-execution-to-graphql-api-exception-handler.util.ts
`file:graphql/direct-execution/utils/graphql-direct-execution-to-graphql-api-exception-handler.util.ts:1`

**graphqlDirectExecutionToGraphqlApiExceptionHandler** utility function
`file:graphql/direct-execution/utils/graphql-direct-execution-to-graphql-api-exception-handler.util.ts:12`
Logic: ) => { → switch (error.code) {

### graphql-extract-top-level-fields.util.ts
`file:graphql/direct-execution/utils/graphql-extract-top-level-fields.util.ts:1`

**graphQLExtractTopLevelFields** utility function
`file:graphql/direct-execution/utils/graphql-extract-top-level-fields.util.ts:6`
Logic: ): FieldNode[] => { → const operationDefinition = findOperationDefinition(document, operationName)

### graphql-format-result-from-selected-fields.util.ts
`file:graphql/direct-execution/utils/graphql-format-result-from-selected-fields.util.ts:1`

**graphQLFormatResultFromSelectedFields** utility function
`file:graphql/direct-execution/utils/graphql-format-result-from-selected-fields.util.ts:52`
Logic: ): unknown => { → const context: GraphQLFormatContext = {

### graphql-is-resolver-output-type.util.ts
`file:graphql/direct-execution/utils/graphql-is-resolver-output-type.util.ts:1`

**isObjectRecord** utility function
`file:graphql/direct-execution/utils/graphql-is-resolver-output-type.util.ts:9`
Logic: ): result is ObjectRecord => { → return !Array.isArray(result) && isObject(result) && 'id' in result

**isObjectRecordArray** utility function
`file:graphql/direct-execution/utils/graphql-is-resolver-output-type.util.ts:15`
Logic: ): result is ObjectRecord[] => { → return Array.isArray(result) && result.every((item) => isObjectRecord(item))

**isConnection** utility function
`file:graphql/direct-execution/utils/graphql-is-resolver-output-type.util.ts:21`
Logic: ): result is IConnection<ObjectRecord, IEdge<ObjectRecord>> => { → return isObject(result) && 'edges' in result && 'pageInfo' in result

**isConnectionArray** utility function
`file:graphql/direct-execution/utils/graphql-is-resolver-output-type.util.ts:27`
Logic: ): result is IConnection<ObjectRecord, IEdge<ObjectRecord>>[] => { → return Array.isArray(result) && result.every((item) => isConnection(item))

**isGroupByConnection** utility function
`file:graphql/direct-execution/utils/graphql-is-resolver-output-type.util.ts:33`
Logic: ): result is IGroupByConnection<ObjectRecord, IEdge<ObjectRecord>> => { → return isConnection(result) && 'groupByDimensionValues' in result

### is-subscription-operation.util.ts
`file:graphql/direct-execution/utils/is-subscription-operation.util.ts:1`

**isSubscriptionOperation** utility function
`file:graphql/direct-execution/utils/is-subscription-operation.util.ts:5`
Logic: ): boolean => { → const operation = findOperationDefinition(document, operationName)

### build-order-by-column-expression.util.ts
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/build-order-by-column-expression.util.ts:1`

**shouldUseCaseInsensitiveOrder** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/build-order-by-column-expression.util.ts:3`
Logic: ): boolean => { → return (

**shouldCastToText** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/build-order-by-column-expression.util.ts:13`
Logic: return ( → fieldType === FieldMetadataType.SELECT ||

**buildOrderByColumnExpression** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/build-order-by-column-expression.util.ts:22`
Logic: ): string => { → return `${prefix}.${columnName}`

### convert-order-by-to-find-options-order.ts
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/convert-order-by-to-find-options-order.ts:1`

**convertOrderByToFindOptionsOrder** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/convert-order-by-to-find-options-order.ts:10`
Logic: ): OrderByClause => { → switch (direction) {

### get-optional-order-by-casting.util.ts
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/get-optional-order-by-casting.util.ts:1`

**getOptionalOrderByCasting** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/get-optional-order-by-casting.util.ts:5`
Logic: ): string => { → if (

### is-order-by-direction.util.ts
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/is-order-by-direction.util.ts:1`

**isOrderByDirection** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/is-order-by-direction.util.ts:4`
Logic: ): value is OrderByDirection => { → return (

### parse-composite-field-for-order.util.ts
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/parse-composite-field-for-order.util.ts:1`

**parseCompositeFieldForOrder** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/parse-composite-field-for-order.util.ts:15`
Logic: ): Record<string, OrderByClause> => { → const compositeType = compositeTypeDefinitions.get(

### prepare-for-order-by-relation-field-parsing.util.ts
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/prepare-for-order-by-relation-field-parsing.util.ts:1`

**prepareForOrderByRelationFieldParsing** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/graphql-query-order/utils/prepare-for-order-by-relation-field-parsing.util.ts:18`
Logic: orderByArg, → fieldMetadata,

### add-relation-join-alias.util.ts
`file:graphql/graphql-query-runner/graphql-query-parsers/utils/add-relation-join-alias.util.ts:1`

**addRelationJoinAliasToQueryBuilder** utility function
`file:graphql/graphql-query-runner/graphql-query-parsers/utils/add-relation-join-alias.util.ts:11`
Logic: queryBuilder, → parentAlias,

### compute-is-numeric-returning-aggregate.util.ts
`file:graphql/graphql-query-runner/group-by/resolvers/utils/compute-is-numeric-returning-aggregate.util.ts:1`

**computeIsNumericReturningAggregate** utility function
`file:graphql/graphql-query-runner/group-by/resolvers/utils/compute-is-numeric-returning-aggregate.util.ts:3`
Logic: ): boolean => { → if (

### format-result-with-group-by-dimension-values.util.ts
`file:graphql/graphql-query-runner/group-by/resolvers/utils/format-result-with-group-by-dimension-values.util.ts:1`

**formatResultWithGroupByDimensionValues** (async) utility function
`file:graphql/graphql-query-runner/group-by/resolvers/utils/format-result-with-group-by-dimension-values.util.ts:15`
Logic: groupsResult, → groupByDefinitions,

### get-group-limit.util.ts
`file:graphql/graphql-query-runner/group-by/utils/get-group-limit.util.ts:1`

**getGroupLimit** utility function
`file:graphql/graphql-query-runner/group-by/utils/get-group-limit.util.ts:3`
Logic: if ( → typeof limit === 'number' &&

### build-columns-to-return.ts
`file:graphql/graphql-query-runner/utils/build-columns-to-return.ts:1`

**buildColumnsToReturn** utility function
`file:graphql/graphql-query-runner/utils/build-columns-to-return.ts:6`
Logic: select, → relations,

### build-columns-to-select.ts
`file:graphql/graphql-query-runner/utils/build-columns-to-select.ts:1`

**buildColumnsToSelect** utility function
`file:graphql/graphql-query-runner/utils/build-columns-to-select.ts:14`
Logic: select, → relations,

### check-string-is-database-event-action.ts
`file:graphql/graphql-query-runner/utils/check-string-is-database-event-action.ts:1`

**checkStringIsDatabaseEventAction** utility function
`file:graphql/graphql-query-runner/utils/check-string-is-database-event-action.ts:3`
Logic: ): value is DatabaseEventAction => { → return Object.values(DatabaseEventAction).includes(

### compute-where-condition-parts.ts
`file:graphql/graphql-query-runner/utils/compute-where-condition-parts.ts:1`

**computeWhereConditionParts** utility function
`file:graphql/graphql-query-runner/utils/compute-where-condition-parts.ts:20`
Logic: operator, → objectNameSingular,

### cursors.util.ts
`file:graphql/graphql-query-runner/utils/cursors.util.ts:1`

**CursorData** (Class)
`file:graphql/graphql-query-runner/utils/cursors.util.ts:12`
Exported service/class providing core functionality.

**encodeCursorData** utility function
`file:graphql/graphql-query-runner/utils/cursors.util.ts:52`
Logic: return Buffer.from(JSON.stringify(cursorData)).toString('base64')

**getCursor** utility function
`file:graphql/graphql-query-runner/utils/cursors.util.ts:56`
Logic: ): Record<string, any> | undefined => { → return decodeCursor(args.after)

**getPaginationInfo** utility function
`file:graphql/graphql-query-runner/utils/cursors.util.ts:67`
Logic: ) => { → const hasMoreRecords = objectRecords.length > limit

### get-field-metadata-from-graphql-field.util.ts
`file:graphql/graphql-query-runner/utils/get-field-metadata-from-graphql-field.util.ts:1`

**getFieldMetadataFromGraphQLField** utility function
`file:graphql/graphql-query-runner/utils/get-field-metadata-from-graphql-field.util.ts:20`
Logic: flatObjectMetadata, → graphQLField,

### get-target-object-metadata.util.ts
`file:graphql/graphql-query-runner/utils/get-target-object-metadata.util.ts:1`

**getTargetObjectMetadataOrThrow** utility function
`file:graphql/graphql-query-runner/utils/get-target-object-metadata.util.ts:11`
Logic: ): FlatObjectMetadata => { → if (!fieldMetadata.relationTargetObjectMetadataId) {

### has-record-field-value.util.ts
`file:graphql/graphql-query-runner/utils/has-record-field-value.util.ts:1`

**hasRecordFieldValue** utility function
`file:graphql/graphql-query-runner/utils/has-record-field-value.util.ts:1`
Logic: if (value === null || value === undefined) { → return false

### merge-emails-field-values.util.ts
`file:graphql/graphql-query-runner/utils/merge-emails-field-values.util.ts:1`

**mergeEmailsFieldValues** utility function
`file:graphql/graphql-query-runner/utils/merge-emails-field-values.util.ts:6`

### merge-field-values.util.ts
`file:graphql/graphql-query-runner/utils/merge-field-values.util.ts:1`

**mergeFieldValues** utility function
`file:graphql/graphql-query-runner/utils/merge-field-values.util.ts:16`

### merge-links-field-values.util.ts
`file:graphql/graphql-query-runner/utils/merge-links-field-values.util.ts:1`

**mergeLinksFieldValues** utility function
`file:graphql/graphql-query-runner/utils/merge-links-field-values.util.ts:8`

### merge-phones-field-values.util.ts
`file:graphql/graphql-query-runner/utils/merge-phones-field-values.util.ts:1`

**mergePhonesFieldValues** utility function
`file:graphql/graphql-query-runner/utils/merge-phones-field-values.util.ts:10`

### merge-relation-field-values-for-dry-run-record.util.ts
`file:graphql/graphql-query-runner/utils/merge-relation-field-values-for-dry-run-record.util.ts:1`

**mergeRelationFieldValuesForDryRunRecord** utility function
`file:graphql/graphql-query-runner/utils/merge-relation-field-values-for-dry-run-record.util.ts:6`

### composite-field-metadata.util.ts
`file:graphql/workspace-query-builder/utils/composite-field-metadata.util.ts:1`

**createCompositeFieldKey** utility function
`file:graphql/workspace-query-builder/utils/composite-field-metadata.util.ts:9`
Logic: ): string => { → return `${compositeFieldPrefix}${fieldName}_${propertyName}`

**isPrefixedCompositeField** utility function
`file:graphql/workspace-query-builder/utils/composite-field-metadata.util.ts:16`
Logic: return key.startsWith(compositeFieldPrefix)

**parseCompositeFieldKey** utility function
`file:graphql/workspace-query-builder/utils/composite-field-metadata.util.ts:20`
Logic: ): { → parentFieldName: string

### get-field-arguments-by-key.util.ts
`file:graphql/workspace-query-builder/utils/get-field-arguments-by-key.util.ts:1`

**getFieldArgumentsByKey** utility function
`file:graphql/workspace-query-builder/utils/get-field-arguments-by-key.util.ts:77`
Logic: ): Record<string, any> => { → const targetField = findFieldNode(info.fieldNodes[0].selectionSet, fieldKey)

### stringify-without-key-quote.util.ts
`file:graphql/workspace-query-builder/utils/stringify-without-key-quote.util.ts:1`

**stringifyWithoutKeyQuote** utility function
`file:graphql/workspace-query-builder/utils/stringify-without-key-quote.util.ts:2`
Logic: const jsonString = JSON.stringify(obj) → const jsonWithoutQuotes = jsonString?.replace(/"(\w+)"\s*:/g, '$1:')

### assert-is-valid-uuid.util.ts
`file:graphql/workspace-query-runner/utils/assert-is-valid-uuid.util.ts:1`

**assertIsValidUuid** utility function
`file:graphql/workspace-query-runner/utils/assert-is-valid-uuid.util.ts:9`
Logic: if (!isValidUuid(value)) { → throw new WorkspaceQueryRunnerException(

### compute-pg-graphql-error.util.ts
`file:graphql/workspace-query-runner/utils/compute-pg-graphql-error.util.ts:1`

**computePgGraphQLError** utility function
`file:graphql/workspace-query-runner/utils/compute-pg-graphql-error.util.ts:53`
Logic: ) => { → const error = errors[0]

### find-conflicting-record.util.ts
`file:graphql/workspace-query-runner/utils/find-conflicting-record.util.ts:1`

**findConflictingRecord** (async) utility function
`file:graphql/workspace-query-runner/utils/find-conflicting-record.util.ts:10`

### graphql-query-runner-exception-handler.util.ts
`file:graphql/workspace-query-runner/utils/graphql-query-runner-exception-handler.util.ts:1`

**graphqlQueryRunnerExceptionHandler** utility function
`file:graphql/workspace-query-runner/utils/graphql-query-runner-exception-handler.util.ts:12`
Logic: ) => { → switch (error.code) {

### handle-duplicate-key-error.util.ts
`file:graphql/workspace-query-runner/utils/handle-duplicate-key-error.util.ts:1`

**handleDuplicateKeyError** (async) utility function
`file:graphql/workspace-query-runner/utils/handle-duplicate-key-error.util.ts:23`
Logic: ): Promise<DuplicateKeyErrorWithMetadata> => { → const parsedError = parsePostgresConstraintError(error)

### is-query-canceled-error.util.ts
`file:graphql/workspace-query-runner/utils/is-query-canceled-error.util.ts:1`

**isQueryCanceledError** utility function
`file:graphql/workspace-query-runner/utils/is-query-canceled-error.util.ts:5`
Logic: if (!isDefined(error) || typeof error !== 'object' || !('code' in error)) { → return false

### parse-postgres-constraint-error.util.ts
`file:graphql/workspace-query-runner/utils/parse-postgres-constraint-error.util.ts:1`

**parsePostgresConstraintError** utility function
`file:graphql/workspace-query-runner/utils/parse-postgres-constraint-error.util.ts:15`
Logic: ): ParsedConstraintError | null => { → const errorDetail = error.detail

### parse-result.util.ts
`file:graphql/workspace-query-runner/utils/parse-result.util.ts:1`

**handleCompositeKey** utility function
`file:graphql/workspace-query-runner/utils/parse-result.util.ts:6`
Logic: ): void => { → const parsedFieldKey = parseCompositeFieldKey(key)

**parseResult** utility function
`file:graphql/workspace-query-runner/utils/parse-result.util.ts:28`
Logic: if (obj === null || typeof obj !== 'object' || typeof obj === 'function') { → return obj

### postgres-exception.ts
`file:graphql/workspace-query-runner/utils/postgres-exception.ts:1`

**PostgresException** (Class)
`file:graphql/workspace-query-runner/utils/postgres-exception.ts:1`
Exported service/class providing core functionality.

### workspace-exception-handler.util.ts
`file:graphql/workspace-query-runner/utils/workspace-exception-handler.util.ts:1`

**workspaceExceptionHandler** utility function
`file:graphql/workspace-query-runner/utils/workspace-exception-handler.util.ts:14`
Logic: ) => { → switch (error.code) {

### workspace-query-runner-graphql-api-exception-handler.util.ts
`file:graphql/workspace-query-runner/utils/workspace-query-runner-graphql-api-exception-handler.util.ts:1`

**QueryFailedErrorWithCode** (Class)
`file:graphql/workspace-query-runner/utils/workspace-query-runner-graphql-api-exception-handler.util.ts:26`
Exported service/class providing core functionality.

**workspaceQueryRunnerGraphqlApiExceptionHandler** utility function
`file:graphql/workspace-query-runner/utils/workspace-query-runner-graphql-api-exception-handler.util.ts:30`
Logic: ) => { → switch (true) {

### create-query-runner-context.util.ts
`file:graphql/workspace-resolver-builder/utils/create-query-runner-context.util.ts:1`

**createQueryRunnerContext** utility function
`file:graphql/workspace-resolver-builder/utils/create-query-runner-context.util.ts:6`
Logic: workspaceSchemaBuilderContext,

### clean-entity-name.util.ts
`file:graphql/workspace-schema-builder/utils/clean-entity-name.util.ts:1`

**cleanEntityName** utility function
`file:graphql/workspace-schema-builder/utils/clean-entity-name.util.ts:3`
Logic: let camelCasedEntityName = entityName.replace(/^[0-9]+/, '') → camelCasedEntityName = camelCasedEntityName.trim()

### compute-composite-field-type-options.util.ts
`file:graphql/workspace-schema-builder/utils/compute-composite-field-type-options.util.ts:1`

**computeCompositeFieldTypeOptions** utility function
`file:graphql/workspace-schema-builder/utils/compute-composite-field-type-options.util.ts:3`
Logic: ) { → return {

### compute-composite-property-target.util.ts
`file:graphql/workspace-schema-builder/utils/compute-composite-property-target.util.ts:1`

**computeCompositePropertyTarget** utility function
`file:graphql/workspace-schema-builder/utils/compute-composite-property-target.util.ts:6`
Logic: ): string => { → return `${type.toString()}->${compositeProperty.name}`

### compute-field-input-type-options.util.ts
`file:graphql/workspace-schema-builder/utils/compute-field-input-type-options.util.ts:1`

**computeFieldInputTypeOptions** utility function
`file:graphql/workspace-schema-builder/utils/compute-field-input-type-options.util.ts:7`
Logic: ): TypeOptions => { → return {

### create-gql-enum-filter-type.util.ts
`file:graphql/workspace-schema-builder/utils/create-gql-enum-filter-type.util.ts:1`

**createGqlEnumFilterType** utility function
`file:graphql/workspace-schema-builder/utils/create-gql-enum-filter-type.util.ts:11`
Logic: ): GraphQLInputType => { → return new GraphQLInputObjectType({

### extract-graphql-relation-field-names.util.ts
`file:graphql/workspace-schema-builder/utils/extract-graphql-relation-field-names.util.ts:1`

**extractGraphQLRelationFieldNames** utility function
`file:graphql/workspace-schema-builder/utils/extract-graphql-relation-field-names.util.ts:6`
Logic: ) => { → const fieldMetadataName = fieldMetadata.name

### get-available-aggregations-from-object-fields.util.ts
`file:graphql/workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util.ts:1`

**getAvailableAggregationsFromObjectFields** utility function
`file:graphql/workspace-schema-builder/utils/get-available-aggregations-from-object-fields.util.ts:21`
Logic: ): Record<string, AggregationField> => { → return fields.reduce<Record<string, AggregationField>>(

### get-flat-fields-for-flat-object-metadata.util.ts
`file:graphql/workspace-schema-builder/utils/get-flat-fields-for-flat-object-metadata.util.ts:1`

**getFlatFieldsFromFlatObjectMetadata** utility function
`file:graphql/workspace-schema-builder/utils/get-flat-fields-for-flat-object-metadata.util.ts:6`
Logic: ): FlatFieldMetadata[] => { → return findManyFlatEntityByIdInFlatEntityMaps({

### get-number-filter-type.util.ts
`file:graphql/workspace-schema-builder/utils/get-number-filter-type.util.ts:1`

**getNumberFilterType** utility function
`file:graphql/workspace-schema-builder/utils/get-number-filter-type.util.ts:10`
Logic: ): GraphQLInputObjectType => { → switch (subType) {

### get-number-scalar-type.util.ts
`file:graphql/workspace-schema-builder/utils/get-number-scalar-type.util.ts:1`

**getNumberScalarType** utility function
`file:graphql/workspace-schema-builder/utils/get-number-scalar-type.util.ts:5`
Logic: ): GraphQLScalarType => { → switch (dataType) {

### get-resolver-args.util.ts
`file:graphql/workspace-schema-builder/utils/get-resolver-args.util.ts:1`

**getResolverArgs** utility function
`file:graphql/workspace-schema-builder/utils/get-resolver-args.util.ts:9`

### is-field-metadata-relation-or-morph-relation.utils.ts
`file:graphql/workspace-schema-builder/utils/is-field-metadata-relation-or-morph-relation.utils.ts:1`

**isFieldMetadataRelationOrMorphRelation** utility function
`file:graphql/workspace-schema-builder/utils/is-field-metadata-relation-or-morph-relation.utils.ts:6`
Logic: ) => { → return (

### compute-composite-field-enum-type-key.util.ts
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-composite-field-enum-type-key.util.ts:1`

**computeCompositeFieldEnumTypeKey** utility function
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-composite-field-enum-type-key.util.ts:3`
Logic: ): string => { → return `${pascalCase(fieldMetadataType)}${pascalCase(

### compute-composite-field-input-type-key.util.ts
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-composite-field-input-type-key.util.ts:1`

**computeCompositeFieldInputTypeKey** utility function
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-composite-field-input-type-key.util.ts:6`
Logic: ): string => { → const name = pascalCase(fieldType.toString().toLowerCase())

### compute-composite-field-object-type-key.util.ts
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-composite-field-object-type-key.util.ts:1`

**computeCompositeFieldObjectTypeKey** utility function
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-composite-field-object-type-key.util.ts:6`
Logic: ): string => { → return `${pascalCase(compositeFieldMetadataType)}${ObjectTypeDefinitionKind.Plai

### compute-enum-field-gql-type-key.util.ts
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-enum-field-gql-type-key.util.ts:1`

**computeEnumFieldGqlTypeKey** utility function
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-enum-field-gql-type-key.util.ts:3`
Logic: ): string => { → return `${pascalCase(objectMetadataName)}${pascalCase(

### compute-object-metadata-input-type.util.ts
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-object-metadata-input-type.util.ts:1`

**computeObjectMetadataInputTypeKey** utility function
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-object-metadata-input-type.util.ts:5`
Logic: ) => { → return `${pascalCase(objectMetadataNameSingular)}${kind.toString()}Input`

### compute-object-metadata-object-type-key.util.ts
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-object-metadata-object-type-key.util.ts:1`

**computeObjectMetadataObjectTypeKey** utility function
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-object-metadata-object-type-key.util.ts:5`
Logic: ) => { → return `${pascalCase(objectMetadataNameSingular)}${kind.toString()}`

### compute-relation-connect-input-type-key.util.ts
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-relation-connect-input-type-key.util.ts:1`

**computeRelationConnectInputTypeKey** utility function
`file:graphql/workspace-schema-builder/utils/compute-stored-gql-type-key-utils/compute-relation-connect-input-type-key.util.ts:1`

### build-cursor-composite-field-where-condition.utils.ts
`file:utils/build-cursor-composite-field-where-condition.utils.ts:1`

**buildCursorCompositeFieldWhereCondition** utility function
`file:utils/build-cursor-composite-field-where-condition.utils.ts:33`
Logic: fieldType, → fieldKey,

### build-cursor-where-condition.utils.ts
`file:utils/build-cursor-where-condition.utils.ts:1`

**buildCursorWhereCondition** utility function
`file:utils/build-cursor-where-condition.utils.ts:38`
Logic: cursorKey, → cursorValue,

### build-duplicate-conditions.utils.ts
`file:utils/build-duplicate-conditions.utils.ts:1`

**buildDuplicateConditions** utility function
`file:utils/build-duplicate-conditions.utils.ts:13`
Logic: ): Partial<ObjectRecordFilter> => { → if (!records || records.length === 0) {

### compute-cursor-arg-filter.utils.ts
`file:utils/compute-cursor-arg-filter.utils.ts:1`

**computeCursorArgFilter** utility function
`file:utils/compute-cursor-arg-filter.utils.ts:17`
Logic: ): ObjectRecordFilter[] => { → const cursorEntries = Object.entries(cursor)

### compute-operator.utils.ts
`file:utils/compute-operator.utils.ts:1`

**computeOperator** utility function
`file:utils/compute-operator.utils.ts:1`
Logic: ): string => { → return isAscending

### get-all-selectable-column-names.utils.ts
`file:utils/get-all-selectable-column-names.utils.ts:1`

**getAllSelectableColumnNames** utility function
`file:utils/get-all-selectable-column-names.utils.ts:17`
Logic: restrictedFields, → objectMetadata,

### is-ascending-order.utils.ts
`file:utils/is-ascending-order.utils.ts:1`

**isAscendingOrder** utility function
`file:utils/is-ascending-order.utils.ts:3`

### validate-and-get-order-by.utils.ts
`file:utils/validate-and-get-order-by.utils.ts:1`

**validateAndGetOrderByForScalarField** utility function
`file:utils/validate-and-get-order-by.utils.ts:49`
Logic: ): ObjectRecordOrderByForScalarField => { → const keyOrderBy = orderBy.find((order) => key in order)

**validateAndGetOrderByForCompositeField** utility function
`file:utils/validate-and-get-order-by.utils.ts:74`
Logic: ): ObjectRecordOrderByForCompositeField => { → const keyOrderBy = orderBy.find((order) => key in order)

**countRelationFieldsInOrderBy** utility function
`file:utils/validate-and-get-order-by.utils.ts:99`
Logic: ): number => { → return orderBy.filter((orderByItem) => {

**hasRelationFieldInOrderBy** utility function
`file:utils/validate-and-get-order-by.utils.ts:116`
Logic: ): boolean => { → return (


## CLICKHOUSE-QUERY-RUNNERS

### parse-clickhouse-filter.util.ts
`file:clickhouse-query-runners/utils/parse-clickhouse-filter.util.ts:1`

**parseClickHouseFilter** utility function
`file:clickhouse-query-runners/utils/parse-clickhouse-filter.util.ts:126`
Logic: ): ClickHouseFilterResult => { → if (!isDefined(filter) || Object.keys(filter).length === 0) {

### parse-clickhouse-order-by.util.ts
`file:clickhouse-query-runners/utils/parse-clickhouse-order-by.util.ts:1`

**parseClickHouseOrderBy** utility function
`file:clickhouse-query-runners/utils/parse-clickhouse-order-by.util.ts:3`
Logic: ): string => { → if (!isDefined(orderBy) || orderBy.length === 0) {


---
## Summary
- **Total exported items: 293**
- **Total files processed: 312**
- **Documented areas: REST API, Common Query Runners, MCP Protocol, Utils, ClickHouse Runners**

## Files without exports or skipped (49)

- rest/core/rest-to-common-args-handlers/rest-to-common-args-handlers.ts
- rest/core/types/field-value.type.ts
- rest/input-request-parsers/constants/max-depth.constant.ts
- rest/input-request-parsers/types/depth.type.ts
- rest/metadata/utils/paginate-by-id-cursor.util.ts
- rest/types/RequestContext.ts
- rest/types/authenticated-request.ts
- common/common-args-processors/common-args-processors.ts
- common/common-args-processors/data-arg-processor/constants/null-equivalent-values.constant.ts
- common/common-args-processors/data-arg-processor/types/file-item.type.ts
- common/common-args-processors/filter-arg-processor/constants/filter-operators.constant.ts
- common/common-args-processors/filter-arg-processor/constants/max-relation-filter-depth.constant.ts
- common/common-args-processors/filter-arg-processor/types/filter-operator.type.ts
- common/common-args-processors/group-by-arg-processor/types/composite-field-group-by-definition.type.ts
- common/common-args-processors/group-by-arg-processor/types/date-field-group-by-definition.type.ts
- common/common-args-processors/group-by-arg-processor/types/field-group-by-definition.type.ts
- common/common-query-runners/common-query-runners.ts
- common/common-query-runners/common-create-many-query-runner/types/conflicting-field-group.type.ts
- common/common-query-runners/common-create-many-query-runner/types/partial-object-record-with-id.type.ts
- common/common-query-runners/errors/standard-error-message.constant.ts
- ... and 29 more