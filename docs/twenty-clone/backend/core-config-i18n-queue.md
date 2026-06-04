# Twenty Backend Core Modules: Config, I18n & Message Queue

Configuration management, internationalization, and message queue processing systems.

---

## engine/core-modules/twenty-config

### Core Services

#### TwentyConfigService
**file:** `twenty-config.service.ts:22`

**Methods:**
- `get<T>(key: T): ConfigVariables[T]` — Retrieves config value from database (if active) or falls back to environment variables; respects environment-only flags.
- `set<T>(key: T, value: ConfigVariables[T]): Promise<void>` — Persists config value to database; validates database driver is active and variable exists.
- `update<T>(key: T, value: ConfigVariables[T]): Promise<void>` — Updates existing database config value; same validation as `set`.
- `delete(key): Promise<void>` — Removes config variable from database; marks as missing in cache.
- `getAll()` — Returns all config variables with metadata and source (DEFAULT/ENVIRONMENT/DATABASE); applies masking to sensitive values.
- `getVariableWithMetadata(key)` — Retrieves single config with metadata and source; returns null if key not found.
- `getMetadata(key)` — Looks up config variable metadata from ConfigVariables class reflection.
- `getCacheInfo()` — Returns cache statistics: whether database driver is active and cache hit/miss counts.
- `getLoggingConfig()` — Returns TYPEORM_LOGGING config as LoggerOptions.
- `isBillingEnabled()` — Returns boolean for IS_BILLING_ENABLED setting.

#### ConfigCacheService
**file:** `cache/config-cache.service.ts:10`

**Methods:**
- `get<T>(key: T): ConfigValue<T> | undefined` — Retrieves cached value by key; returns undefined if not cached.
- `set<T>(key: T, value: ConfigValue<T>): void` — Caches a found value; removes from missing keys set.
- `isKeyKnownMissing(key)` — Checks if key was previously looked up in DB and not found.
- `markKeyAsMissing(key)` — Marks key as definitively missing to avoid repeated DB queries.
- `clear(key)` — Removes key from both found and missing caches.
- `clearAll()` — Clears entire cache (called on module destroy).
- `getCacheInfo()` — Returns cache statistics: counts of found/missing keys and list of cached keys.
- `getAllKeys()` — Returns union of all cached and known-missing keys.
- `addToMissingKeysForTesting(key)` — Test helper to mark keys as missing.

#### ConfigValueConverterService
**file:** `conversion/config-value-converter.service.ts:15`

**Methods:**
- `convertDbValueToAppValue<T>(dbValue: unknown, key: T): ConfigVariables[T] | undefined` — Converts database-stored value to typed app value using type transformers; validates type and applies options filtering.
- `convertAppValueToDbValue<T>(appValue: ConfigVariables[T] | null | undefined, key: T): unknown` — Converts app value to database-storable format; handles JSON serialization for objects.

#### ConfigGroupHashService
**file:** `services/config-group-hash.service.ts:11`

**Methods:**
- `computeHash(group: ConfigVariablesGroup): string` — Computes SHA256 hash of all config variables in a group; useful for detecting config changes and cache invalidation.

#### ConfigStorageService
**file:** `storage/config-storage.service.ts:25`

**Methods:**
- `get<T>(key: T): Promise<ConfigVariables[T] | undefined>` — Fetches config from KeyValuePairEntity; decrypts sensitive values.
- `set<T>(key: T, value: ConfigVariables[T]): Promise<void>` — Inserts or updates config in database; encrypts sensitive values before storage.
- `delete<T>(key: T): Promise<void>` — Removes config record from database.
- `loadAll()`: Promise<Map> — Loads all config variables from database in one query; decrypts all sensitive values; returns Map of key->value.

---

### Drivers

#### DatabaseConfigDriver
**file:** `drivers/database-config.driver.ts:13`

**Lifecycle/Methods:**
- `onModuleInit()` — Asynchronously loads all config variables from database on startup; logs counts of loaded vs missing values.
- `get<T>(key: T): ConfigVariables[T] | undefined` — Returns cached value for key.
- `set<T>(key: T, value: ConfigVariables[T]): Promise<void>` — Stores to database and updates cache; prevents setting environment-only variables.
- `update<T>(key: T, value: ConfigVariables[T]): Promise<void>` — Alias for `set`; both update cache immediately.
- `delete<T>(key: T): Promise<void>` — Removes from DB and marks as missing in cache.
- `getCacheInfo()` — Delegates to ConfigCacheService for cache stats.
- `@Cron(CONFIG_VARIABLES_REFRESH_CRON_INTERVAL)` refreshAllCache() — Scheduled task (configurable interval) that reloads all DB configs to keep cache fresh; silently logs errors to avoid cron failures.

#### EnvironmentConfigDriver
**file:** `drivers/environment-config.driver.ts:8`

**Methods:**
- `get<T>(key: T): ConfigVariables[T]` — Retrieves from NestJS ConfigService with fallback to default ConfigVariables value.

---

### Decorators

#### ConfigVariablesMetadata
**file:** `decorators/config-variables-metadata.decorator.ts:27`

**Purpose:** Property decorator that registers metadata on ConfigVariables class for use by validators and config system.

**Function:**
- Stores ConfigVariablesMetadataOptions (group, description, type, sensitivity) on class reflection metadata.
- Applies IsOptional if property has no default value.
- Applies basic type validators and transformers.
- Registers custom validator decorator on property.

#### IsDuration
**file:** `decorators/is-duration.decorator.ts:18`

**Purpose:** Validates duration string format (e.g., "1h", "30m", "5s", "2d").

**Validation:** Regex pattern matching: `-?[0-9]+(.[0-9]+)?(m|s|h|d|w|M|y)?` (optional time unit).

#### IsAWSRegion
**file:** `decorators/is-aws-region.decorator.ts:17`

**Purpose:** Validates AWS region format (e.g., "us-east-1").

**Validation:** Regex pattern: `[a-z]{2}-[a-z]+-\d{1}` (two lowercase letters, hyphen, lowercase letters, hyphen, single digit).

#### CastToLogLevelArray
**file:** `decorators/cast-to-log-level-array.decorator.ts:5`

**Purpose:** Transforms comma-separated string into validated array of log levels.

**Function:** Splits on comma, validates each level is in ['log', 'error', 'warn', 'debug', 'verbose'], throws on invalid levels.

#### CastToMeterDriverArray
**file:** `decorators/cast-to-meter-driver.decorator.ts:6`

**Purpose:** Transforms comma-separated string into array of valid MeterDriver values.

**Function:** Splits on comma, validates each driver value exists in MeterDriver enum, returns undefined if invalid.

#### CastToUpperSnakeCase
**file:** `decorators/cast-to-upper-snake-case.decorator.ts:4`

**Purpose:** Transforms input string to UPPER_SNAKE_CASE format.

**Function:** Uses lodash snakeCase then toUpperCase; trims input first.

#### CastToPositiveNumber
**file:** `decorators/cast-to-positive-number.decorator.ts:3`

**Purpose:** Transforms input to non-negative number.

**Function:** Converts string to number and returns undefined if NaN or negative; passes through positive numbers.

#### CastToTypeORMLogLevelArray
**file:** `decorators/cast-to-typeorm-log-level-array.decorator.ts` — (requires reading file)

**Purpose:** Similar to CastToLogLevelArray but for TypeORM-specific log levels.

#### AssertOrWarn
**file:** `decorators/assert-or-warn.decorator.ts:7`

**Purpose:** Conditional validation decorator that validates condition as a warning (doesn't fail validation).

**Function:** Registers validator that evaluates condition function; marks validation as warning group.

#### IsOptionalOrEmptyString
**file:** `decorators/is-optional-or-empty-string.decorator.ts:4`

**Purpose:** Validates that field is either undefined or non-empty string.

**Function:** Uses ValidateIf to skip validation if value is undefined or empty string.

#### IsStrictlyLowerThan
**file:** `decorators/is-strictly-lower-than.decorator.ts:7`

**Purpose:** Validates that a numeric property is strictly less than another property.

**Function:** Compares two numeric properties; returns true only if value < related property value.

#### IsTwentySemVer
**file:** `decorators/is-twenty-semver.decorator.ts` — (requires reading file)

**Purpose:** Validates Twenty-specific semantic versioning format.

---

### Utilities

#### applyBasicValidators
**file:** `utils/apply-basic-validators.util.ts:9`

**Purpose:** Applies type-specific validators and transformers to a property based on ConfigVariableType.

**Function:** Looks up transformer for type in typeTransformers registry; applies all getValidators() and getTransformers() decorators to target property.

#### configTransformers
**file:** `utils/config-transformers.util.ts:1`

**Object with three transformer functions:**
- `boolean(value)` — Converts string/number/boolean to boolean; "true"/"on"/"yes"/"1" → true, "false"/"off"/"no"/"0" → false.
- `number(value)` — Parses string to number; converts boolean to 0/1; handles string parseFloat.
- `string(value)` — Converts any value to string; JSON.stringify for objects/arrays.

#### typeTransformers
**file:** `utils/type-transformers.registry.ts:32`

**Object mapping ConfigVariableType to TypeTransformer implementations:**

Each transformer has:
- `toApp(value, options)` — DB → typed app value; applies enum filtering if options provided.
- `toStorage(value, options)` — App value → storable format; validates type and enum membership.
- `getValidators(options)` — Returns class-validator decorators to apply.
- `getTransformers()` — Returns class-transformer Transform decorators.

**Types:**
- BOOLEAN: uses configTransformers.boolean; IsBoolean validator.
- NUMBER: uses configTransformers.number; IsNumber validator.
- STRING: uses configTransformers.string; IsString validator; no transformers.
- ARRAY: splits comma-separated strings; filters to allowed options if provided; IsArray validator; tryParseJsonArray transformer.
- ENUM: validates against options array; IsEnum validator if options provided.
- JSON: parses JSON strings; validates object type; IsObject validator; JSON.parse transformer.

#### configVariableMaskSensitiveData
**file:** `utils/config-variable-mask-sensitive-data.util.ts:3`

**Purpose:** Masks sensitive config values for safe display.

**Function:**
- LAST_N_CHARS strategy: replaces all but last N chars with asterisks (default 5).
- HIDE_PASSWORD strategy: parses URL and replaces username/password with asterisks; throws on invalid URL.

#### isEnvOnlyConfigVar
**file:** `utils/is-env-only-config-var.util.ts:4`

**Purpose:** Checks if a config variable is marked as environment-only (cannot be set in database).

**Function:** Looks up metadata on ConfigVariables class; returns metadata.isEnvOnly boolean.

---

### Filters & Exceptions

#### ConfigVariableGraphqlApiExceptionFilter
**file:** `filters/config-variable-graphql-api-exception.filter.ts:16`

**Purpose:** NestJS ExceptionFilter that converts ConfigVariableException to GraphQL errors.

**Mapping:**
- VARIABLE_NOT_FOUND → NotFoundError
- ENVIRONMENT_ONLY_VARIABLE → ForbiddenError
- DATABASE_CONFIG_DISABLED, VALIDATION_FAILED → UserInputError
- INTERNAL_ERROR, UNSUPPORTED_CONFIG_TYPE → re-throw as-is
- Other codes invoke assertUnreachable.

#### ConfigVariableException
**file:** `twenty-config.exception.ts:37`

**Constructor:** `(message: string, code: ConfigVariableExceptionCode, options?: {userFriendlyMessage: MessageDescriptor})`

**Purpose:** Custom exception with user-friendly messages for config-related errors.

**Function:** Extends CustomException; maps exception codes to i18n message descriptors; includes localized error messages.

---

### Modules & Configuration

#### TwentyConfigModule
**file:** `twenty-config.module.ts:12`

**Static forRoot()** — Configurable module that:
- Checks IS_CONFIG_VARIABLES_IN_DB_ENABLED env var.
- Conditionally imports DatabaseConfigModule if enabled.
- Provides TwentyConfigService, ConfigGroupHashService, and CONFIG_VARIABLES_INSTANCE_TOKEN.
- Global scope (all modules can inject TwentyConfigService).

#### DatabaseConfigModule
**file:** `drivers/database-config.module.ts` — (requires reading)

**Purpose:** Provides database config driver and related services (ConfigCacheService, ConfigStorageService).

#### DriverFactoryBase
**file:** `dynamic-factory.base.ts:4`

**Purpose:** Base class for driver factories that manage driver lifecycle and config key changes.

**Methods:**
- `getCurrentDriver(): TDriver` — Returns current driver instance; recreates if config key has changed.
- `protected abstract buildConfigKey(): string` — Subclasses override to compute config key.
- `protected abstract createDriver(): TDriver` — Subclasses override to instantiate driver.

---

## engine/core-modules/i18n

### Core Service

#### I18nService
**file:** `i18n.service.ts:44`

**Lifecycle/Methods:**
- `async loadTranslations()` — Loads all locale message catalogs from generated locale files; sets up Lingui i18n instance for each locale.
- `getI18nInstance(locale)` — Returns Lingui I18n instance for specified locale.
- `translateMessage({messageId, values, locale, options})` — Translates message ID in given locale with optional variable substitution.
- `async onModuleInit()` — Called by NestJS; triggers loadTranslations().

**Supported Locales:** en, pseudo-en, af-ZA, ar-SA, ca-ES, cs-CZ, da-DK, de-DE, el-GR, es-ES, fi-FI, fr-FR, he-IL, hu-HU, it-IT, ja-JP, ko-KR, nl-NL, no-NO, pl-PL, pt-BR, pt-PT, ro-RO, ru-RU, sr-Cyrl, sv-SE, tr-TR, uk-UA, vi-VN, zh-CN, zh-TW

---

### Utilities

#### generateMessageId
**file:** `utils/generateMessageId.ts:5`

**Purpose:** Generates stable 6-character hash ID for message strings (used by Lingui).

**Function:** SHA256 hashes message + context separator + context string; takes base64 digest first 6 chars.

#### translateUserFriendlyMessageDescriptors
**file:** `utils/translate-user-friendly-message-descriptors.util.ts:36`

**Purpose:** Recursively traverses object payload and translates any `userFriendlyMessage` MessageDescriptor fields.

**Function:**
- If key is 'userFriendlyMessage' and value is MessageDescriptor, translate it using i18n.
- For arrays, recursively process each element.
- For objects, recursively process all properties.
- Returns fully translated payload object.

---

### Module

#### I18nModule
**file:** `i18n.module.ts:6`

**Configuration:** Global module providing I18nService; auto-exports for all modules.

---

## engine/core-modules/message-queue

### Core Service

#### MessageQueueService
**file:** `services/message-queue.service.ts:20`

**Constructor:** `(driver: MessageQueueDriver, queueName: MessageQueue)`

**Methods:**
- `add<T>(jobName: string, data: T, options?: QueueJobOptions): Promise<void>` — Adds job to queue; delegates to driver.
- `addCron<T>({jobName, data, options, jobId}): Promise<void>` — Schedules recurring job with cron pattern; delegates to driver.
- `removeCron({jobName, jobId}): Promise<void>` — Removes scheduled cron job.
- `work<T>(handler, options?: MessageQueueWorkerOptions): void` — Registers job processor for queue; delegates to driver.

---

### Drivers

#### BullMQDriver
**file:** `drivers/bullmq.driver.ts:38`

**Lifecycle/Implementation:**
- `onModuleInit()` — Registers observable gauge metric for queue waiting jobs count.
- `register(queueName)` — Creates BullMQ Queue instance for queue name.
- `onModuleDestroy()` — Closes all queues and workers gracefully.
- `async add<T>(queueName, jobName, data, options?)` — Adds job to queue; prevents duplicate waiting jobs with same id; uses retry limits and queue retention settings.
- `async addCron<T>({queueName, jobName, data, options, jobId})` — Creates or updates recurring job schedule using BullMQ job scheduler.
- `async removeCron({queueName, jobName, jobId})` — Removes job scheduler for cron job.
- `work<T>(queueName, handler, options?)` — Registers worker; wraps handler with Sentry isolation scope for error tracking; logs job start/finish with execution time; increments metrics on completion/failure.

**Metrics:**
- Gauges: 'twenty_queue_jobs_waiting_total' — current waiting jobs count.
- Counters: JobCompleted, JobFailed with queue name and job name attributes.

#### SyncDriver
**file:** `drivers/sync.driver.ts:12`

**Purpose:** Synchronous driver for testing and development; executes jobs immediately without queue.

**Methods:**
- `async add<T>(queueName, jobName, data)` — Synchronously processes job via processJob.
- `async addCron<T>({queueName, jobName, data})` — Logs cron message and processes job immediately.
- `async removeCron({queueName})` — Logs removal message.
- `work<T>(queueName, handler)` — Registers handler in workersMap by queue name.
- `private async processJob<T>(queueName, job)` — Finds registered worker for queue and executes handler; logs error if no worker found (unless NODE_ENV=test).

---

### Decorators

#### Processor
**file:** `decorators/processor.decorator.ts:24`

**Purpose:** Class decorator marking a class as a message queue job processor.

**Function:**
- Takes queueName or MessageQueueProcessorOptions.
- Sets SCOPE_OPTIONS_METADATA and PROCESSOR_METADATA on class.
- Allows optional scope (DEFAULT, TRANSIENT, REQUEST).

#### Process
**file:** `decorators/process.decorator.ts:9`

**Purpose:** Method decorator marking a method as handler for a specific job name.

**Function:** Sets PROCESS_METADATA with jobName on method; discovered by MessageQueueExplorer.

#### InjectMessageQueue
**file:** `decorators/message-queue.decorator.ts:6`

**Purpose:** Constructor parameter decorator for injecting a MessageQueueService for specific queue.

**Function:** Injects using getQueueToken(queueName).

---

### Metadata & Discovery

#### MessageQueueMetadataAccessor
**file:** `message-queue-metadata.accessor.ts:12`

**Methods:**
- `isProcessor(target)` — Checks if target has PROCESSOR_METADATA (is a @Processor class).
- `isProcess(target)` — Checks if target has PROCESS_METADATA (is a @Process method).
- `getProcessorMetadata(target)` — Returns processor options (queueName, scope).
- `getProcessMetadata(target)` — Returns process options (jobName).

#### MessageQueueExplorer
**file:** `message-queue.explorer.ts:34`

**Purpose:** Discovers and initializes all @Processor classes and @Process methods on module load.

**Lifecycle:**
- `onModuleInit()` — Calls explore().
- `explore()` — Discovers all processor providers; groups by queue name; creates workers for each queue.

**Private Methods:**
- `private groupProcessorsByQueueName(processors)` — Groups processors and their process methods by queue name.
- `private getQueueService(queueToken)` — Retrieves MessageQueueService from module ref.
- `private handleProcessorGroupCollection(processorGroupCollection, queue, options?)` — Registers queue.work() handler that invokes all processor groups.
- `private handleProcessor(processorGroup, job)` — Finds matching @Process methods and invokes them; creates request scope if processor is request-scoped.
- `private invokeProcessMethods(instance, processMethodNames, job)` — Sequentially invokes each process method with job data; captures exceptions via ExceptionHandlerService.

---

### Modules

#### MessageQueueModule
**file:** `message-queue.module.ts:14`

**Static Methods:**
- `register(options)` — Registers module with options; imports MessageQueueCoreModule.register().
- `registerExplorer()` — Registers MessageQueueExplorer and MetadataAccessor for discovery.
- `registerAsync(options)` — Registers module asynchronously; imports MessageQueueCoreModule.registerAsync().

#### MessageQueueCoreModule
**file:** `message-queue-core.module.ts:29`

**Purpose:** Core module that creates driver and queue service providers.

**Static Methods:**
- `register(options)` — Creates QUEUE_DRIVER and MessageQueueService providers for all queues.
- `registerAsync(options)` — Async version; useFactory receives config and returns driver.
- `static async createDriver(config)` — Factory that instantiates BullMQDriver (if BullMQ type) or SyncDriver.
- `static createQueueProviders()` — Creates MessageQueueService provider for each queue in MessageQueue enum.

**Exports:** Queue service tokens for all queues (MESSAGE_QUEUE_<QUEUE_NAME>).

#### JobsModule
**file:** `jobs.module.ts:47`

**Purpose:** Imports and provides all application background job processors.

**Job Providers:**
- CleanSuspendedWorkspacesJob, CleanOnboardingWorkspacesJob, EmailSenderJob, UpdateSubscriptionQuantityJob, HandleWorkspaceMemberDeletedJob, CleanWorkspaceDeletionWarningUserVarsJob, UpdateWorkspaceMemberEmailJob, GenerateSdkClientJob.

**Static Ref:** JobsModule.moduleRef stores ModuleRef for runtime job access.

---

### Utilities

#### getQueueToken
**file:** `utils/get-queue-token.util.ts:1`

**Purpose:** Generates DI token string for a queue service.

**Function:** Returns `MESSAGE_QUEUE_<queueName>`.

#### getJobKey
**file:** `utils/get-job-key.util.ts:1`

**Purpose:** Generates unique key for scheduled cron jobs.

**Function:** Returns `<jobName>` or `<jobName>.<jobId>` if jobId provided.

---

### Factories & Configuration

#### messageQueueModuleFactory
**file:** `message-queue.module-factory.ts:17`

**Purpose:** Factory function for async MessageQueueModule setup.

**Input:** (twentyConfigService, redisClientService, metricsService)

**Output:** MessageQueueModuleOptions with BullMQ driver and Redis connection.

**Function:** Hardcoded to BullMQ driver; gets Redis client from redisClientService; includes metricsService reference.

---

### Interfaces & Constants

#### MessageQueueDriverType
**file:** `interfaces/index.ts` — (enumerates BullMQ, Sync driver types)

#### MessageQueueJobData
**file:** `interfaces/message-queue-job.interface.ts` — (base job data type with workspaceId)

#### MessageQueue
**file:** `message-queue.constants.ts` — (enum of queue names: DEFAULT, WEBHOOKS, etc.)

#### QUEUE_RETENTION
**file:** `constants/queue-retention.constants.ts` — (config for completed/failed job retention: maxAge, maxCount)

#### MESSAGE_QUEUE_PRIORITY
**file:** `message-queue-priority.constant.ts` — (priority mappings by queue name)

#### QUEUE_WORKER_OPTIONS
**file:** `message-queue-worker-options.constant.ts` — (concurrency and other worker options by queue)

---

## Remaining Decorators & Validators

### IsTwentySemVer / IsTwentySemVerValidator
**file:** `decorators/is-twenty-semver.decorator.ts:11`

`IsTwentySemVer(validationOptions?)` — Property decorator registering `IsTwentySemVerValidator`. The validator's `validate(version)` calls `semver.parse(version)` and returns true only when parse is non-null; `defaultMessage()` says the property must be a valid semantic version (e.g., 1.0.0).

### CastToTypeORMLogLevelArray
**file:** `decorators/cast-to-typeorm-log-level-array.decorator.ts:4`

`CastToTypeORMLogLevelArray()` — class-transformer `Transform` wrapper around `toTypeORMLogLevelArray`. Splits a comma-separated string, trims each level, validates every level against `['query','schema','error','warn','info','log','migration']`; returns the array only if all are valid, otherwise `undefined`.

---

## Drivers — Database Config Module

### DatabaseConfigModule
**file:** `drivers/database-config.module.ts:14`

`static forRoot(): DynamicModule` — Builds the DB-backed config DynamicModule. Imports `TypeOrmModule.forFeature([KeyValuePairEntity])`, `ScheduleModule.forRoot()` (enables the refresh cron), and `SecretEncryptionModule`. Providers: `DatabaseConfigDriver`, `ConfigCacheService`, `ConfigStorageService`, `ConfigValueConverterService`, and a `CONFIG_VARIABLES_INSTANCE_TOKEN` bound to `new ConfigVariables()`. Exports only `DatabaseConfigDriver`.

---

## Module Definition & Tokens (twenty-config)

### TwentyConfig ConfigurableModuleClass
**file:** `twenty-config.module-definition.ts:3`

Built via NestJS `ConfigurableModuleBuilder` with moduleName `'TwentyConfig'` and `setClassMethodName('forRoot')`. Exports `ConfigurableModuleClass` and `MODULE_OPTIONS_TOKEN` consumed by `TwentyConfigModule`.

### CONFIG_VARIABLES_INSTANCE_TOKEN
**file:** `constants/config-variables-instance-tokens.constants.ts:1`

`Symbol('CONFIG_VARIABLES_INSTANCE_TOKEN')` — DI token for the shared singleton `ConfigVariables` instance.

### CONFIG_VARIABLES_METADATA_DECORATOR_KEY / NAMES_KEY
**file:** `constants/config-variables-metadata-decorator-key.ts:1`, `constants/config-variables-metadata-decorator-names-key.ts:1`

String literal reflection-metadata keys: `'config-variables-metadata'` (per-property metadata) and `'config-variable-names'` (registry of decorated property names).

### CONFIG_VARIABLES_REFRESH_CRON_INTERVAL
**file:** `constants/config-variables-refresh-cron-interval.constants.ts:1`

`'*/15 * * * * *'` — every 15 seconds; drives `DatabaseConfigDriver.refreshAllCache()`'s `@Cron`.

### CONFIG_VARIABLES_GROUP_METADATA
**file:** `constants/config-variables-group-metadata.ts:14`

`Record<ConfigVariablesGroup, {position, description, isHiddenOnLoad, isHiddenInAdminPanel}>` — Drives ordering and visibility of config groups in the admin panel. Notable: BILLING/CLOUDFLARE/SUPPORT_CHAT/ANALYTICS/AWS_SES are `isHiddenInAdminPanel: true`; most non-server groups are `isHiddenOnLoad: true`. Positions step by ~100 (SERVER_CONFIG=100 … AWS_SES_SETTINGS=2100).

### CONFIG_VARIABLES_MASKING_CONFIG
**file:** `constants/config-variables-masking-config.ts:18`

Maps the three sensitive keys to masking strategies: `APP_SECRET` → LAST_N_CHARS (5 chars), `PG_DATABASE_URL` and `REDIS_URL` → HIDE_PASSWORD. Consumed by `configVariableMaskSensitiveData`.

---

## Enums, Interfaces & Types (twenty-config)

### ConfigSource
**file:** `enums/config-source.enum.ts:1` — `ENVIRONMENT | DATABASE | DEFAULT`; identifies where a resolved value came from (surfaced by `getAll`/`getVariableWithMetadata`).

### ConfigVariableType
**file:** `enums/config-variable-type.enum.ts:1` — `boolean | number | array | string | enum | json`; selects the `typeTransformers` entry.

### ConfigVariablesGroup
**file:** `enums/config-variables-group.enum.ts:1` — 19 groups (SERVER_CONFIG, RATE_LIMITING, STORAGE_CONFIG, GOOGLE_AUTH, MICROSOFT_AUTH, EMAIL_SETTINGS, LOGGING, ADVANCED_SETTINGS, BILLING_CONFIG, CAPTCHA_CONFIG, CLOUDFLARE_CONFIG, LLM, LOGIC_FUNCTION_CONFIG, CODE_INTERPRETER_CONFIG, SSL, SUPPORT_CHAT_CONFIG, ANALYTICS_CONFIG, TOKENS_DURATION, AWS_SES_SETTINGS).

### ConfigVariablesMaskingStrategies
**file:** `enums/config-variables-masking-strategies.enum.ts:1` — `LAST_N_CHARS | HIDE_PASSWORD`.

### AwsRegion
**file:** `interfaces/aws-region.interface.ts:1` — template-literal type `` `${string}-${string}-${number}` ``.

### NodeEnvironment
**file:** `interfaces/node-environment.interface.ts:1` — `TEST='test' | DEVELOPMENT='development' | PRODUCTION='production'`.

### SupportDriver
**file:** `interfaces/support.interface.ts:3` — GraphQL-registered enum `NONE | FRONT` (support-chat provider selection).

### ConfigVariableOptions
**file:** `types/config-variable-options.type.ts:1` — `readonly (string|number|boolean)[] | Record<string,string>`; allowed-values list for ENUM/ARRAY transformers.

### ConfigKey / ConfigValue / ConfigCacheEntry
**file:** `cache/interfaces/config-cache-entry.interface.ts:3` — `ConfigKey = keyof ConfigVariables`, `ConfigValue<T> = ConfigVariables[T]`, and `ConfigCacheEntry<T> = { value: ConfigValue<T> }` (cache record shape).

### DatabaseConfigDriverInterface
**file:** `drivers/interfaces/database-config-driver.interface.ts:7` — Contract for DB-backed drivers: `get` (cache-only, may return undefined), `update`, `refreshAllCache`, and `getCacheInfo` returning `{foundConfigValues, knownMissingKeys, cacheKeys}`.

### ConfigStorageInterface
**file:** `storage/interfaces/config-storage.interface.ts:3` — Contract for persistence layer: `get`, `set`, `delete`, and `loadAll(): Promise<Map<key,value>>`.

---

## Message Queue — Module Definition, Interfaces & Constants

### MessageQueue ConfigurableModuleClass
**file:** `message-queue.module-definition.ts:5`

`ConfigurableModuleBuilder<MessageQueueModuleOptions>` with `setExtras({isGlobal:true}, …)` that maps the extra onto `definition.global`. Exports `ConfigurableModuleClass`, `OPTIONS_TYPE`, `ASYNC_OPTIONS_TYPE`, `MODULE_OPTIONS_TOKEN` — making the queue module global by default.

### MessageQueueDriver (interface)
**file:** `drivers/interfaces/message-queue-driver.interface.ts:11`

Driver contract: `add(queueName, jobName, data, options?)`, `work(queueName, handler, options?)`, `addCron({queueName, jobName, data, options, jobId?})`, `removeCron({queueName, jobName, jobId?})`, and optional `register(queueName)`. Implemented by `BullMQDriver` and `SyncDriver`.

### QueueJobOptions / QueueCronJobOptions
**file:** `drivers/interfaces/job-options.interface.ts:1`

`QueueJobOptions` = `{id?, priority?, retryLimit?, delay?}`. `QueueCronJobOptions` extends it with `repeat: {every?, pattern?, limit?}` for recurring schedules.

### MessageQueueJob / MessageQueueJobData / MessageQueueCronJobData
**file:** `interfaces/message-queue-job.interface.ts:2`

`MessageQueueJob<T>` = `{id, name, data}`; `MessageQueueJobData` = open `[key:string]: any` base; `MessageQueueCronJobData<T>` declares the `handle(data): Promise<void>|void` shape job processors implement.

### MessageQueueDriverType & MessageQueueModuleOptions
**file:** `interfaces/message-queue-module-options.interface.ts:4`

Enum `MessageQueueDriverType` = `BullMQ='bull-mq' | Sync='sync'`. `BullMQDriverFactoryOptions` carries `{type, options: BullMQDriverOptions, metricsService}`; `SyncDriverFactoryOptions` carries `{type, options}`. `MessageQueueModuleOptions` is the union of both — consumed by `MessageQueueCoreModule.createDriver`.

### MessageQueueWorkerOptions
**file:** `interfaces/message-queue-worker-options.interface.ts:1` — `{concurrency?: number}`.

### interfaces/index barrel
**file:** `interfaces/index.ts:1` — Re-exports `message-queue-module-options.interface`.

### Metadata Symbols & MessageQueue enum
**file:** `message-queue.constants.ts:1`

Reflection symbols `PROCESSOR_METADATA`, `PROCESS_METADATA`, `QUEUE_DRIVER`, plus the `MessageQueue` enum of 17 queue names (taskAssignedQueue, messagingQueue, webhookQueue, cronQueue, emailQueue, calendarQueue, contactCreationQueue, billingQueue, workspaceQueue, entityEventsToDbQueue, workflowQueue, delayedJobsQueue, deleteCascadeQueue, logicFunctionQueue, triggerQueue, aiQueue, aiStreamQueue).

### QUEUE_RETENTION
**file:** `constants/queue-retention.constants.ts:1`

`{completedMaxAge: 14400 (4h), completedMaxCount: 1000, failedMaxAge: 604800 (7d), failedMaxCount: 1000}` — BullMQ job retention applied by `BullMQDriver.add`.

### MESSAGE_QUEUE_PRIORITY
**file:** `message-queue-priority.constant.ts:3`

Per-queue numeric priority (lower = higher priority): billing/entityEvents/email=1, workflow/webhook/messaging/aiStream=2, delayedJobs=3, calendar/contactCreation/taskAssigned/logicFunction=4, workspace/trigger/ai=5, deleteCascade=6, cron=7.

### QUEUE_WORKER_OPTIONS
**file:** `message-queue-worker-options.constant.ts:3`

Partial per-queue worker overrides; currently only `aiStreamQueue: {concurrency: 20}`.

### BullMQDriverOptions
**file:** `drivers/bullmq.driver.ts:34` — Type alias `= QueueOptions` (BullMQ's connection/queue config passed through the factory).

---

## I18n — Types

### I18nContext
**file:** `i18n/types/i18n-context.type.ts:2`

`{ req: { locale: keyof typeof APP_LOCALES } }` — request-scoped context shape carrying the resolved locale into resolvers/services for translation.



