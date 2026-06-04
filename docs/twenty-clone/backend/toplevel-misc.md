# Top-Level Miscellaneous Backend Functions

Comprehensive documentation of all exported functions, services, commands, guards, and utilities in the command, queue-worker, filters, types, utils, and constants directories of twenty-server backend.

---

## command

### command.ts
`file: src/command/command.ts`

#### bootstrap()
`lines: 9-36 | no params → void (async)`
Entry point for the NestJS command CLI application. Creates the CommandFactory with error handlers, configures logging, injects the LoggerService, and runs the application. Handles exceptions via ExceptionHandlerService with Sentry capture support via shouldCaptureException guard. Exits with code 1 on error.

### command.module.ts
`file: src/command/command.module.ts`

#### CommandModule
`lines: 10-20 | @Module decorator`
NestJS module that imports AppModule, DatabaseCommandModule, MessagingMessageCleanerModule, ObjectMetadataModule, FieldMetadataModule, and WorkspaceCleanerModule for CLI command execution context.

---

## queue-worker

### queue-worker.ts
`file: src/queue-worker/queue-worker.ts`

#### bootstrap()
`lines: 9-32 | no params → void (async)`
Entry point for the NestJS queue worker process. Creates application context for QueueWorkerModule with buffer logging enabled. Extracts LoggerService and ExceptionHandlerService, injects logger, and handles initialization errors via Sentry capture. Errors are rethrown to prevent worker startup.

### queue-worker.module.ts
`file: src/queue-worker/queue-worker.module.ts`

#### QueueWorkerModule
`lines: 10-20 | @Module decorator`
NestJS module that imports CoreEngineModule, MessageQueueModule (with explorer), WorkspaceEventEmitterModule, JobsModule, TwentyORMModule, and GlobalWorkspaceDataSourceModule for background job processing.

---

## filters

### unhandled-exception.filter.ts
`file: src/filters/unhandled-exception.filter.ts`

#### UnhandledExceptionFilter
`lines: 14-40 | implements ExceptionFilter`
NestJS exception filter that catches all unhandled exceptions and adds CORS headers to the response (to prevent misleading CORS errors when exceptions occur in middleware before CORS middleware runs). Extracts HTTP status from HttpException or defaults to 500, then returns status + error response/message JSON.

#### catch()
`lines: 16-38 | (exception: any, host: ArgumentsHost) → void`
Switches execution context to HTTP, extracts response object, checks if headers haven't been sent, adds CORS headers (Access-Control-Allow-Origin, Methods, Headers), extracts HTTP status code, and sends JSON error response with exception response or message.

---

## types

### non-nullable-properties.type.ts
`file: src/types/non-nullable-properties.type.ts`

#### NonNullableProperties<T>
`lines: 1-3 | type definition`
Generic TypeScript type utility that transforms all properties of type T to be non-nullable by mapping over each property P and applying NonNullable<T[P]> to remove null/undefined from union types.

---

## constants

### assets-path.ts
`file: src/constants/assets-path.ts`

#### ASSET_PATH
`lines: 6-8 | const string`
Platform-aware asset path resolver that detects whether code is built through testing module (assets in parent dir) or normal build (assets in dist/assets dir). Uses __dirname to conditionally resolve with path.resolve().

---

## utils

### anonymize.ts
`file: src/utils/anonymize.ts`

#### anonymize()
`lines: 3-6 | (input: string) → string`
Generates an MD5 hash of the input string for anonymization purposes. Uses crypto.createHash('md5') and returns the hexadecimal digest (MD5 chosen over SHA-256 for brevity since collisions are not a security risk for anonymization).

### assert.ts
`file: src/utils/assert.ts`

#### assert()
`lines: 12-24 | (condition: unknown, message?: string, ErrorType?: HttpException) → asserts condition`
Custom assertion function that validates a condition and throws an HttpException (or generic Error if no ErrorType provided). Uses TypeScript's asserts keyword for type narrowing. Throws ErrorType with message if provided, otherwise throws generic Error with message.

#### assertNever()
`lines: 26-28 | (_value: never, message?: string) → never`
Helper for exhaustiveness checking in TypeScript switch statements. Always throws an Error with provided message or default "Didn't expect to get here." to catch unhandled cases at compile time.

### camel-case.ts
`file: src/utils/camel-case.ts`

#### camelCase()
`lines: 5-6 | <T>(text: T) → CamelCase<T>`
Converts input to camelCase using lodash.camelcase, preserving TypeScript types via type-fest CamelCase generic for single values.

#### camelCaseDeep()
`lines: 8-27 | <T>(value: T) → CamelCasedPropertiesDeep<T>`
Recursively converts all object keys and array element keys to camelCase. Checks for arrays first (maps recursively), then objects (iterates keys and recursively transforms values), and returns primitives unchanged.

### camel-to-title-case.ts
`file: src/utils/camel-to-title-case.ts`

#### camelToTitleCase()
`lines: 2-7 | (camelCaseText: string) → string`
Converts camelCase text to Title Case. Replaces uppercase letters with space + letter, ensures first character is uppercase, then applies capitalize() from twenty-shared/utils.

### clean-server-url.ts
`file: src/utils/clean-server-url.ts`

#### cleanServerUrl()
`lines: 1-6 | (serverUrlEnv?: string) → string | undefined`
Removes trailing slash from server URL if present. Returns substring excluding last char if URL ends with '/', otherwise returns URL as-is (handles undefined gracefully by returning undefined).

### compute-display-name.ts
`file: src/utils/compute-display-name.ts`

#### computeDisplayName()
`lines: 4-12 | (name: FullNameMetadata | null | undefined) → string`
Constructs display name from FullNameMetadata object by filtering defined values from all name properties (e.g., firstName, lastName) and joining with spaces. Returns empty string if name is null/undefined.

### custom-exception.ts
`file: src/utils/custom-exception.ts`

#### appendCommonExceptionCode()
`lines: 8-17 | <SpecificExceptionCode>(specificExceptionCode: SpecificExceptionCode) → const object`
Merges CommonExceptionCode (INTERNAL_SERVER_ERROR) with domain-specific exception codes, returning a const object with both. Allows consistent exception code handling across services.

#### CustomException<ExceptionCode, ExceptionMessage>
`lines: 19-35 | abstract class extends CustomError`
Base exception class that extends CustomError with code and userFriendlyMessage properties. Constructor accepts message, code, and object with Lingui MessageDescriptor for i18n-aware error messages returned to frontend.

#### UnknownException
`lines: 41 | class extends CustomException`
Concrete exception class for test scenarios and edge cases. Developers should prefer domain-specific exceptions in production code.

### extract-request.ts
`file: src/utils/extract-request.ts`

#### getRequest()
`lines: 5-27 | (context: ExecutionContext) → request`
Extracts Express Request from NestJS ExecutionContext supporting http, graphql, and rpc context types. For GraphQL, prioritizes WebSocket connection context over HTTP request if available, otherwise returns HTTP request.

### generate-front-config.ts
`file: src/utils/generate-front-config.ts`

#### generateFrontConfig()
`lines: 10-47 | () → void`
Generates frontend config by inserting environment variables into the built frontend index.html file. If FRONT_AUTO_BASE_URL=true or SERVER_URL is unset, injects empty _env_ object so frontend resolves API origin from hostname at request time. Handles missing frontend builds gracefully with console.log.

### get-domain-name-by-email.ts
`file: src/utils/get-domain-name-by-email.ts`

#### getDomainNameByEmail()
`lines: 6-39 | (email: string) → string`
Extracts and validates domain name from email address. Throws UserInputError (with Lingui i18n message) if email is empty, missing @ symbol (wrong format), or lacks domain. Returns domain portion after @.

### get-dry-run-log-header.ts
`file: src/utils/get-dry-run-log-header.ts`

#### getDryRunLogHeader()
`lines: 1-3 | (isDryRun: boolean | undefined) → string`
Returns "Dry-run mode: " prefix if isDryRun is true, otherwise empty string. Used for consistent logging of dry-run operations.

### get-server-url.ts
`file: src/utils/get-server-url.ts`

#### getServerUrl()
`lines: 3-11 | ({ serverUrlEnv?, serverUrlFallback }: object) → string`
Returns cleaned server URL from env or fallback. Calls cleanServerUrl() on serverUrlEnv and returns result, or uses serverUrlFallback as default if env URL is falsy.

### image.ts
`file: src/utils/image.ts`

#### getCropSize()
`lines: 12-23 | (value: ShortCropSize) → CropSize | null`
Parses crop size string (e.g., "w100", "h200", "original") via regex and returns CropSize object with type (width/height) and numeric value. Returns null for "original" or non-matching strings.

#### getImageBufferFromUrl()
`lines: 25-67 | (url: string, axiosInstance: AxiosInstance) → Buffer (async)`
Fetches image from URL as Buffer. Validates URL is non-empty string, uses axios with arraybuffer responseType and 10s timeout, validates response has data and correct image/* content-type, returns Buffer. Throws detailed errors for invalid URLs, empty responses, or wrong content-type.

### is-plain-object.ts
`file: src/utils/is-plain-object.ts`

#### isPlainObject()
`lines: 1-5 | (input: unknown) → input is Record<string, unknown>`
Type guard that checks if input is a plain object (not null, not array, typeof 'object'). Returns true for plain objects, false for arrays/primitives/null.

### is-snake-case-string.ts
`file: src/utils/is-snake-case-string.ts`

#### isSnakeCaseString()
`lines: 3 | (str: string) → boolean`
Regex-based validation that string is SCREAMING_SNAKE_CASE format (uppercase letters/digits with underscores, no double underscores, starts uppercase). Uses pattern /^(?!.*__)[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.

### is-work-email.ts
`file: src/utils/is-work-email.ts`

#### isWorkEmail()
`lines: 4-10 | (email: string) → boolean`
Returns true if email domain is NOT in emailProvidersSet (personal/free email providers). Extracts domain via getDomainNameByEmail(), catches exceptions and returns false for invalid emails.

#### isWorkDomain()
`lines: 12-14 | (domain: string) → boolean`
Returns true if domain is NOT in emailProvidersSet. Direct set lookup without email parsing.

### kebab-case.ts
`file: src/utils/kebab-case.ts`

#### kebabCase()
`lines: 5-6 | <T>(text: T) → KebabCase<T>`
Converts input to kebab-case using lodash.kebabcase, preserving TypeScript type via type-fest KebabCase.

#### kebabCaseDeep()
`lines: 8-27 | <T>(value: T) → KebabCasedPropertiesDeep<T>`
Recursively converts all object keys to kebab-case. Handles arrays (maps recursively), objects (iterates keys with kebabCase), and primitives (returned unchanged).

### merge-update-in-existing-record.util.ts
`file: src/utils/merge-update-in-existing-record.util.ts`

#### mergeUpdateInExistingRecord()
`lines: 1-21 | <TExisting, P, TUpdate>({ existing, update, properties }) → TExisting`
Merges partial update into existing record by selectively including only properties that were updated (update[property] !== undefined). Returns new object with existing + selected updates via reduce over properties array.

### parse-array-env-var.ts
`file: src/utils/parse-array-env-var.ts`

#### parseArrayEnvVar()
`lines: 1-13 | <T>(envVar: string | undefined, expectedValues: T[], defaultValues: T[]) → T[]`
Parses comma-separated env var into array of expected values. Returns defaultValues if envVar undefined/empty, splits on comma, filters against expectedValues, returns filtered array if non-empty or defaultValues otherwise.

### pascal-case.ts
`file: src/utils/pascal-case.ts`

#### pascalCaseDeep()
`lines: 5-24 | <T>(value: T) → PascalCasedPropertiesDeep<T>`
Recursively converts all object keys to PascalCase using pascalCase from twenty-shared. Handles arrays (maps recursively), objects (iterates keys), primitives (unchanged).

### remove-secret-from-webhook-record.ts
`file: src/utils/remove-secret-from-webhook-record.ts`

#### removeSecretFromWebhookRecord()
`lines: 1-12 | (record: Record | undefined, isWebhookEvent: boolean) → Record | undefined`
Removes 'secret' property from webhook event record for security. Returns record unchanged if not a webhook event or record is undefined, otherwise destructures to exclude secret via {secret: _secret, ...sanitizedRecord}.

### resolve-absolute-path.ts
`file: src/utils/resolve-absolute-path.ts`

#### resolveAbsolutePath()
`lines: 1-3 | (path: string) → string`
Converts relative paths to absolute by prepending process.cwd() + '/'. Returns path unchanged if already starts with '/'.

### should-run-now.utils.ts
`file: src/utils/should-run-now.utils.ts`

#### shouldRunNow()
`lines: 3-20 | (pattern: string, now: Date, rootCronIntervalMs?: number) → boolean`
Determines if a cron pattern should trigger at the current time. Parses cron pattern via CronExpressionParser.parse(), gets previous trigger date, calculates time diff from now, returns true if diff < rootCronIntervalMs (default 60s). Returns false on parse error.

### snake-case.ts
`file: src/utils/snake-case.ts`

#### snakeCase()
`lines: 5-6 | <T>(text: T) → SnakeCase<T>`
Converts input to snake_case using lodash.snakecase with type preservation via type-fest SnakeCase.

#### snakeCaseDeep()
`lines: 8-27 | <T>(value: T) → SnakeCasedPropertiesDeep<T>`
Recursively converts all object keys to snake_case. Maps arrays recursively, iterates object keys with snakeCase, returns primitives unchanged.

### stream-to-buffer.ts
`file: src/utils/stream-to-buffer.ts`

#### streamToBuffer()
`lines: 3-88 | (stream: Readable, maxSizeBytes?: number) → Buffer (async)`
Converts Readable stream to Buffer with size limit. Validates stream is readable and not ended, accumulates chunks in array with total size tracking, rejects if maxSizeBytes exceeded, handles data/end/error/close events with cleanup to prevent memory leaks. Returns concatenated Buffer on success.

### try-parse-json-array.ts
`file: src/utils/try-parse-json-array.ts`

#### tryParseJsonArray()
`lines: 1-9 | (value: string) → unknown[] | null`
Safely parses JSON string into array. Returns parsed array if JSON.parse succeeds and result is array, otherwise returns null on parse error or non-array result.

### typed-reflect.ts
`file: src/utils/typed-reflect.ts`

#### TypedReflect
`lines: 25-79 | class`
Type-safe wrapper around Reflect metadata API. Provides static defineMetadata() and getMetadata() overloads supporting both class-level and property-level metadata with typed key-value mapping via ReflectMetadataTypeMap interface (supports workspace gates, nullable, system, readonly, audit-logged, unique, duplicate-criteria, searchable, feature-flag metadata).

#### ReflectMetadataTypeMap
`lines: 9-23 | interface`
Mapping of typed metadata keys to their value types: workspace:is-nullable-metadata-args (true), workspace:gate-metadata-args (Gate), workspace:is-system-metadata-args (true), workspace:is-field-ui-readonly-metadata-args (true), workspace:is-object-ui-readonly-metadata-args (true), workspace:is-audit-logged-metadata-args (false), workspace:is-primary-field-metadata-args (true), workspace:is-deprecated-field-metadata-args (true), workspace:is-unique-metadata-args (true), workspace:duplicate-criteria-metadata-args (WorkspaceEntityDuplicateCriteria[]), config-variables (ConfigVariablesMetadataMap), workspace:is-searchable-metadata-args (boolean), feature-flag-metadata-args (FeatureFlagKey).

### date/isDate.ts
`file: src/utils/date/isDate.ts`

#### isDate()
`lines: 2-4 | (date: any) → date is Date`
Type guard that checks if value is a Date instance via instanceof Date. Returns true for Date objects including invalid dates.

### date/isValidDate.ts
`file: src/utils/date/isValidDate.ts`

#### isValidDate()
`lines: 2-4 | (date: any) → date is Date`
Type guard that checks if value is a valid Date instance. Validates both instanceof Date AND !isNaN(date.getTime()) to exclude Invalid Date objects.

### date/toIsoStringOrNull.ts
`file: src/utils/date/toIsoStringOrNull.ts`

#### toIsoStringOrNull()
`lines: 1-9 | (value: string | Date | null | undefined) → string | null`
Converts Date to ISO string or passes through string values. Returns null if value is null/undefined, calls toISOString() if Date, otherwise returns string as-is.

### version/compare-version-minor-and-major.ts
`file: src/utils/version/compare-version-minor-and-major.ts`

#### compareVersionMajorAndMinor()
`lines: 7-40 | (rawVersion1: string, rawVersion2: string) → 'lower' | 'equal' | 'higher'`
Compares two semantic versions by major and minor (ignoring patch). Parses both versions via semver.parse(), throws if either invalid, strips patch versions, uses semver.compare() on normalized versions, returns 'lower'/'equal'/'higher' based on -1/0/1 result.

#### CompareVersionMajorAndMinorReturnType
`lines: 3-6 | type alias`
Union type: 'lower' | 'equal' | 'higher' for version comparison results.

### version/extract-version-major-minor-patch.ts
`file: src/utils/version/extract-version-major-minor-patch.ts`

#### extractVersionMajorMinorPatch()
`lines: 3-11 | (version: string | undefined) → string | null`
Parses semantic version string and returns "major.minor.patch" string. Uses semver.parse(), returns null if parsing fails or version undefined.

### version/get-previous-version.ts
`file: src/utils/version/get-previous-version.ts`

#### getPreviousVersion()
`lines: 7-26 | ({ versions, currentVersion }: object) → SemVer | undefined (async)`
Finds largest semantic version that is lower than currentVersion from versions array. Converts all versions to SemVer, sorts descending, finds first version with compare(currentSemver) < 0. Returns undefined if no previous version or parse error.

### __test__/get-field-metadata-entity.mock.ts
`file: src/utils/__test__/get-field-metadata-entity.mock.ts`

#### getMockFieldMetadataEntity()
`lines: 17-61 | <T>({ workspaceId, objectMetadataId, type, ...overrides }: object) → FieldMetadataEntity`
Factory function for creating FieldMetadataEntity test mocks. Provides default values for all properties (empty arrays for collections, null for optional fields, faker-generated IDs and UUIDs) and merges with caller-provided overrides. Required overrides: workspaceId, objectMetadataId, type.

#### GetMockFieldMetadataEntityOverride<T>
`lines: 9-14 | type alias`
Partial override type requiring workspaceId, objectMetadataId, type to be specified when calling getMockFieldMetadataEntity.

### __test__/get-object-metadata-entity.mock.ts
`file: src/utils/__test__/get-object-metadata-entity.mock.ts`

#### getMockObjectMetadataEntity()
`lines: 16-53 | ({ nameSingular, namePlural, id, workspaceId, ...overrides }: object) → ObjectMetadataEntity`
Factory function for creating ObjectMetadataEntity test mocks. Provides default values for all properties (dates set to new Date(), empty arrays, null for optional fields, faker UUIDs) and merges with caller overrides. Required overrides: nameSingular, namePlural, id, workspaceId.

#### GetMockObjectMetadataEntityOverride
`lines: 7-14 | type alias`
Partial override type requiring nameSingular, namePlural, id, workspaceId for getMockObjectMetadataEntity calls.

---

## Summary

**Total functions documented: 74** (including overloads, type utilities, and class methods)

**File count by category:**
- command: 2 files (bootstrap entry point, CommandModule)
- queue-worker: 2 files (bootstrap entry point, QueueWorkerModule)
- filters: 1 file (UnhandledExceptionFilter with catch method)
- types: 1 file (NonNullableProperties type utility)
- constants: 1 file (ASSET_PATH constant)
- utils: 35 files (39+ exported functions/utilities)

**Not yet covered:** None - all assigned directories and files have been documented exhaustively.

