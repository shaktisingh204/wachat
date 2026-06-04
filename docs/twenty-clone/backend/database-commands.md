# Database Commands, ClickHouse, Scripts, and PostgreSQL

Database-related functionality: CLI commands for migrations, upgrades, workspace management, secret encryption rotation, and data export; ClickHouse integration for analytics; PostgreSQL utilities and scripts.

---

## database/commands (Main Commands)

### RebuildApplicationDefaultDepsCommand
`file: rebuild-application-default-deps.command.ts:20`

`run(passedParams, options) → Promise<void>`

Rebuilds and re-uploads default package.json and yarn.lock files to file storage for all applications in specified or all active/suspended workspaces. Uses WorkspaceIteratorService to iterate over workspace IDs with optional filtering and calls ApplicationService.uploadDefaultPackageFilesAndSetFileIds for each application.

### DataSeedWorkspaceCommand
`file: data-seed-dev-workspace.command.ts:24`

`run(passedParams, options) → Promise<void>`

Seeds workspace with initial development data. With --light flag, seeds only the Apple workspace with limited records (5 per object); without it, seeds Apple, YCombinator, and Empty3/Empty4 test fixtures. Calls DevSeederService.seedDev() and seedEmptyWorkspace() methods.

### RunInstanceCommandsCommand
`file: run-instance-commands.command.ts:26`

`run(passedParams, options) → Promise<void>`

Runs legacy TypeORM migrations and all registered instance (fast and optionally slow) upgrade commands for the instance. Checks workspace version safety unless --force flag is used, runs pending TypeORM migrations, then iterates upgrade sequence executing fast commands and conditionally slow commands.

### CronRegisterAllCommand
`file: cron-register-all.command.ts:36`

`run() → Promise<void>`

Registers all background sync cron jobs for messaging, calendar, workflow, and domain validation. Calls run() on 24+ cron command instances, tracking successes, failures, and skipped jobs (disabled by config). Logs comprehensive summary of all cron jobs.

### ListOrphanedWorkspaceEntitiesCommand
`file: list-and-delete-orphaned-workspace-entities.command.ts:123`

`runMigrationCommand(passedParams, options) → Promise<void>`

Lists and optionally deletes records from workspace-related entities (90+ entity types) that reference a workspaceId not present in the workspace table. Uses subquery to identify orphans, batches deletes by entity type, handles field metadata relations specially, logs detailed deletion summary.

### GenerateInstanceCommandCommand
`file: generate-instance-command.command.ts:32`

`run(passedParams, options) → Promise<void>`

Generates a new instance command (fast or slow) with @RegisteredInstanceCommand decorator from current schema differences detected by TypeORM. Uses InstanceCommandGenerationService to build file template with up/down SQL, writes to version directory, appends import to instance-commands.constant.ts.

### InstallPreInstalledAppsCommand
`file: install-pre-installed-apps.command.ts:15`

`runOnWorkspace(args) → Promise<void>`

Installs all application registrations flagged with isPreInstalled on every active and suspended workspace. Idempotent backfill that rolls out pre-installed app registrations to workspaces created before the flag existed.

### UpgradeCommand
`file: upgrade-version-command/upgrade.command.ts:29`

`run(passedParams, options) → Promise<void>`

Upgrades all active/suspended workspaces to the latest version by executing the full upgrade sequence. Reads sequence, validates options, runs UpgradeSequenceRunnerService.run() with parsed options, logs detailed upgrade logs with structured fields for each step and summary.

---

## database/commands/command-runners

### WorkspaceIteratorService
`file: command-runners/workspace-iterator.service.ts:48`

`iterate(args) → Promise<WorkspaceIteratorReport>`

Core service that iterates over workspaces with flexible filtering by IDs, activation status, or range. For each workspace, builds system auth context, sets up GlobalWorkspaceDataSource if databaseSchema exists, executes callback, and returns report with success/failure lists. Handles WorkspaceMigrationRunnerException with nested error logging.

`fetchWorkspaceIds(options) → Promise<string[]>` (private)

Queries workspace repository with filters for activation status, start ID, and limit, returns sorted workspace IDs.

### MigrationCommandRunner
`file: command-runners/migration.command-runner.ts:13`

Abstract base class for migration commands. Handles --dry-run and --verbose options, constructs CommandLogger with verbosity, wraps runMigrationCommand() with error handling and completion logging.

`parseVerbose() → boolean`

Option parser for --verbose flag, enables verbose logging.

`parseDryRun() → boolean`

Option parser for --dry-run flag, simulates without changes.

### WorkspaceCommandRunner
`file: command-runners/workspace.command-runner.ts:25`

Abstract base class extending CommandRunner for commands that operate on workspaces. Orchestrates workspace iteration with options for --workspace-id, --start-from-workspace-id, --workspace-count-limit, --dry-run, --verbose. Calls abstract runOnWorkspace() for each.

`parseWorkspaceId(val, previous) → Set<string>`

Accumulates workspace IDs from repeated -w/--workspace-id flags into a Set.

`parseStartFromWorkspaceId(val) → string`

Option parser for starting workspace ID in ascending order traversal.

`parseWorkspaceCountLimit(val) → number`

Parses and validates workspace count limit, ensures positive integer.

### ActiveOrSuspendedWorkspaceCommandRunner
`file: command-runners/active-or-suspended-workspace.command-runner.ts:11`

Concrete base class extending WorkspaceCommandRunner that filters to only ACTIVE and SUSPENDED workspaces, pre-configured activation statuses for subclasses.

---

## database/commands/instance-command-generation

### InstanceCommandGenerationService
`file: instance-command-generation.service.ts:24`

`generateInstanceCommand(args) → Promise<GeneratedMigrationResult | null>`

Uses TypeORM's schema builder to detect pending migrations, generates up/down SQL statements, builds fast or slow migration file template with @RegisteredInstanceCommand decorator, returns fileName/fileTemplate/className or null if no changes. Escapes SQL and formats query parameters.

`buildFastMigrationFileContent({...}) → string` (private)

Constructs TypeScript file for fast instance command implementing FastInstanceCommand interface with up/down QueryRunner methods.

`buildSlowMigrationFileContent({...}) → string` (private)

Constructs TypeScript file for slow instance command implementing SlowInstanceCommand interface with async runDataMigration(dataSource) placeholder and up/down methods.

`buildClassName({name, type}) → string` (private)

Formats class name: PascalCase(name) + PascalCase(type) + "InstanceCommand", e.g., "AddFooFastInstanceCommand".

---

## database/commands/workspace-export

### WorkspaceExportService
`file: workspace-export/workspace-export.service.ts:49`

`exportWorkspace({workspaceId, outputPath, tableFilter}) → Promise<string>`

Exports entire workspace as SQL (INSERT/COPY statements + DDL). Validates workspace exists, fetches ObjectMetadata and FieldMetadata, creates output directory, writes schema setup, core entity rows (workspace, related entities, users), workspace schema DDL from metadata, then workspace data rows using COPY format. Handles batch processing, JSON/TSVECTOR columns, and relational field pairs.

`writeCoreEntityRows(workspaceId, queryRunner, stream) → Promise<void>` (private)

Writes SQL for workspace record, core entities with workspaceId foreign key, and workspace users. Handles JSON column formatting.

`writeRows({schemaName, tableName, ...}) → Promise<void>` (private)

Batches INSERT statements for a table in 10k-row chunks. Builds INSERT prefix, formats values with formatSqlValue(), writes statements with backpressure handling.

`writeCopyRows({...}) → Promise<void>` (private)

Uses PostgreSQL COPY format for more efficient bulk export. Writes COPY header, formats rows with formatPgCopyField(), sends COPY terminator.

`writeWorkspaceSchemaDdl(...) → void` (private)

Generates and writes CREATE ENUM and CREATE TABLE statements from metadata via generateWorkspaceSchemaDdl util.

`buildJsonColumnSet(entityMetadata) → Set<string>` (private)

Returns column names with jsonb/json database type.

### WorkspaceExportCommand
`file: workspace-export/workspace-export.command.ts:17`

`run(passedParams, options) → Promise<void>`

CLI command to export a workspace as SQL. Requires --workspace-id, optional --output-path (default /tmp/exports), --tables (comma-separated nameSingular filters). Calls WorkspaceExportService.exportWorkspace(), logs file path.

### build-insert-prefix.util.ts
`file: workspace-export/utils/build-insert-prefix.util.ts:3`

`buildInsertPrefix(schemaName, tableName, columnNames) → string`

Returns escaped INSERT statement prefix: `INSERT INTO schema.table (cols...) VALUES `

### format-sql-value.util.ts
`file: workspace-export/utils/format-sql-value.util.ts:5`

`formatSqlValue(value, isJsonColumn) → string`

Formats values for SQL INSERT: NULL for undefined, JSON stringify for JSON columns, boolean as TRUE/FALSE, numbers/bigints as-is, dates as ISO strings, arrays as PostgreSQL array literals, objects as escaped JSON. Uses escapeLiteral for string escaping.

### format-pg-copy-value.util.ts
`file: workspace-export/utils/format-pg-copy-value.util.ts:11`

`formatPgCopyField(value, isJsonColumn) → string`

Formats values for PostgreSQL COPY: \\N for NULL, json for JSON columns, t/f for booleans, ISO dates, PostgreSQL array format with escaped tabs/newlines. Different escaping than INSERT (COPY uses \\t \\n \\r).

### build-workspace-table-column-sets.util.ts
`file: workspace-export/utils/build-workspace-table-column-sets.util.ts:14`

`buildWorkspaceTableColumnSets(workspaceId, objectMetadata, fieldMetadatas) → WorkspaceTableColumnSets`

Analyzes field metadata to identify JSON/JSONB columns (excluded from COPY data export) and generated tsvector columns (excluded since they're computed). Returns {jsonColumns, generatedColumns} Sets.

### generate-workspace-schema-ddl.util.ts
`file: workspace-export/utils/generate-workspace-schema-ddl.util.ts:18`

`generateWorkspaceSchemaDdl(workspaceId, schemaName, objectMetadatas, fieldsByObjectId) → string[]`

Generates CREATE TYPE (for enums) and CREATE TABLE statements for all active objects from metadata. Uses generateColumnDefinitions and buildSqlColumnDefinition utils, returns array of DDL statements.

### generate-insert-statement.util.ts
`file: workspace-export/utils/generate-insert-statement.util.ts:1`

`generateInsertStatement(insertPrefix, formattedValues) → string`

Helper that wraps values in parentheses with semicolon: `(val1, val2, ...);\n`

### get-core-entity-metadatas-with-workspace-id.util.ts
`file: workspace-export/utils/get-core-entity-metadatas-with-workspace-id.util.ts:3`

`getCoreEntityMetadatasWithWorkspaceId(dataSource) → EntityMetadata[]`

Filters DataSource.entityMetadatas to those with a workspaceId column property.

---

## database/commands/secret-encryption-rotation

### RotateSecretEncryptionCommand
`file: secret-encryption-rotation/rotate-secret-encryption.command.ts:25`

`run(passedParams, options) → Promise<void>`

CLI command to re-encrypt all at-rest secrets stored in enc:v2 envelopes using current ENCRYPTION_KEY. Validates --site (optional, known site names), --batch-size (default 200, max 5000), --dry-run (decrypt/re-encrypt in memory only). Calls SecretEncryptionRotationRunnerService.run(), throws if any errors occur.

### SecretEncryptionRotationRunnerService
`file: secret-encryption-rotation/services/secret-encryption-rotation-runner.service.ts:43`

`run(options) → Promise<RotationRunSummary>`

Orchestrates rotation across all (or single site) secret storage sites. Resolves current and fallback encryption keys, iterates handlers, calls countRemaining() and rotate() for each, tracks rotated/skipped/errors, logs detailed summary with timing.

`listSiteNames() → SecretEncryptionRotationSiteName[]`

Returns all registered site names.

`resolveHandlersToRun(site) → SecretEncryptionRotationHandler[]` (private)

Returns all handlers or single handler if site specified, validates site exists.

`logSummary(summary) → void` (private)

Logs per-site and total statistics with formatted output.

### ColumnRotationSiteHandler
`file: secret-encryption-rotation/handlers/column-rotation-site.handler.ts:33`

Generic handler for rotating a single encrypted column across an entity. Supports workspace-scoped encryption and extra WHERE conditions.

`countRemaining({currentEncryptionKeyId}) → Promise<number>`

Counts rows where encrypted column doesn't match current key envelope pattern using LIKE query.

`rotate({currentEncryptionKeyId, batchSize, dryRun}) → Promise<SecretEncryptionRotationOutcome>`

Batches rows (cursor-based pagination), calls rotateRow() for each, returns outcome. Skips rows already on current key.

`rotateRow({row, dryRun}) → Promise<SecretEncryptionRotationOutcome>` (private)

Decrypts with versioned decryption, re-encrypts with current key, updates row if not dryRun (with CAS check). Logs errors for non-versioned envelopes.

### ConnectionParametersRotationHandler
`file: secret-encryption-rotation/handlers/connection-parameters-rotation.handler.ts:31`

Specialized handler for rotating IMAP/SMTP/CALDAV passwords nested in ConnectedAccount.connectionParameters JSONB column. Validates non-empty encrypted parameters, decrypts/re-encrypts each protocol password separately, uses IS NOT DISTINCT FROM for safe updates.

`reEncryptConnectionParametersOrThrow({...}) → EncryptedImapSmtpCaldavParams` (private)

Iterates ACCOUNT_TYPES (IMAP, SMTP, CALDAV), validates v2 envelope prefix, decrypts plaintext, re-encrypts with current key. Throws if non-versioned envelope detected.

`buildRowToSelectQuery({currentEncryptionKeyId}) → SelectQueryBuilder` (private)

Builds query filtering connected_account rows where any protocol password isn't on current key.

### SensitiveConfigStorageRotationHandler
`file: secret-encryption-rotation/handlers/sensitive-config-storage-rotation.handler.ts:28`

Rotates sensitive config variables stored in KeyValuePairEntity (type=CONFIG_VARIABLE) identified via TypedReflect metadata on ConfigVariables class. Filters to isSensitive=true and type=STRING.

`countRemaining({currentEncryptionKeyId}) → Promise<number>`

Collects sensitive string config keys via metadata, counts KVP rows needing rotation.

`rotate({currentEncryptionKeyId, batchSize, dryRun}) → Promise<SecretEncryptionRotationOutcome>`

Returns zero outcome if no sensitive config keys exist, else batches and rotates KVP rows.

`collectSensitiveStringConfigKeys() → string[]` (private)

Uses TypedReflect to extract metadata from ConfigVariables, filters to sensitive strings, returns config key names.

### SecretEncryptionRotationHandler (Interface)
`file: secret-encryption-rotation/interfaces/secret-encryption-rotation-handler.interface.ts:22`

Abstract base class defining rotation handler contract.

`abstract readonly siteName: SecretEncryptionRotationSiteName`

Unique site identifier.

`abstract countRemaining(args) → Promise<number>`

Returns count of rows needing rotation.

`abstract rotate(context) → Promise<SecretEncryptionRotationOutcome>`

Performs rotation, returns rotated/skipped/errors counts.

### build-current-encryption-key-id-envelope-like-pattern.util.ts
`file: secret-encryption-rotation/utils/build-current-encryption-key-id-envelope-like-pattern.util.ts:3`

`buildCurrentEncryptionKeyIdEnvelopeLikePattern(currentEncryptionKeyId) → string`

Returns SQL LIKE pattern: `enc:v2|<keyId>:%` for filtering rows on current key.

### build-rotation-error-message.util.ts
`file: secret-encryption-rotation/utils/build-rotation-error-message.util.ts:6`

`buildRotationErrorMessage(siteName, rowId, error) → string`

Formats error message. If UNKNOWN_KEY_ID error, instructs user to set FALLBACK_ENCRYPTION_KEY. Otherwise logs decryption/re-encryption failure.

### SECRET_ENCRYPTION_ROTATION_SITE_NAME constant
`file: secret-encryption-rotation/constants/secret-encryption-rotation-site-name.constant.ts:1`

Object with 8 site name constants:
- CONNECTED_ACCOUNT_ACCESS_TOKEN, CONNECTED_ACCOUNT_REFRESH_TOKEN, CONNECTED_ACCOUNT_CONNECTION_PARAMETERS
- APPLICATION_VARIABLE, APPLICATION_REGISTRATION_VARIABLE
- SIGNING_KEY_PRIVATE_KEY
- SENSITIVE_CONFIG_STORAGE, TOTP_SECRET

---

## database/commands (Supporting)

### CommandLogger
`file: commands/logger.ts:15`

Custom logger wrapper extending NestJS Logger with verbose mode flag.

`log(message, optionalParams) → void`

Logs message at INFO level.

`error(message, stack, context) → void`

Logs error with optional stack trace and context.

`warn(message, optionalParams) → void`

Logs warning.

`debug(message, optionalParams) → void`

Logs debug.

`verbose(message, optionalParams) → void`

Logs only if verboseFlag is true.

`setVerbose(flag) → void`

Toggles verbose flag.

### ConfirmationQuestion
`file: commands/questions/confirmation.question.ts:6`

@QuestionSet for nest-commander confirming destructive operations (database deletion). Shows prompt "You are about to delete data from database. Are you sure to continue? Consider the '--dry-run' option first".

---

## database/clickHouse

### ClickHouseService
`file: clickHouse/clickHouse.service.ts:17`

Injectable service managing ClickHouse client connections (main and per-workspace clients). Initializes with URL from config, creates clients with compression and async insert settings.

`getMainClient() → ClickHouseClient | undefined`

Returns main client if CLICKHOUSE_URL configured.

`connectToClient(clientId, url) → Promise<ClickHouseClient | undefined>`

Gets or creates and caches workspace-specific client. Uses locking mechanism to prevent duplicate initialization. Returns undefined if CLICKHOUSE_URL not set.

`disconnectFromClient(clientId) → Promise<void>`

Closes and removes client from cache.

`onModuleInit() → Promise<void>`

Pings main client on module init to verify connection.

`onModuleDestroy() → Promise<void>`

Closes main client and all cached clients on shutdown.

`insert<T>(table, values, clientId) → Promise<{success: boolean}>`

Inserts values into table using specified (or main) client. Batches inserts by 1000 rows or 4MB chunks. Catches errors and returns success flag.

`select<T>(query, params, clientId) → Promise<T[]>`

Executes SELECT query with optional params, returns JSONEachRow results or empty array on error.

`createDatabase(databaseName) → Promise<boolean>`

Creates database IF NOT EXISTS. Returns false on error or if no main client.

`dropDatabase(databaseName) → Promise<boolean>`

Drops database IF EXISTS.

`executeCommand(query, params, clientId) → Promise<boolean>`

Executes non-SELECT command (like CREATE TABLE).

`insertInChunks<T>(client, table, values, options) → Promise<void>` (private)

Batches and inserts values by chunkSize (1000) or maxMemoryMB (4). Flushes when limits exceeded.

### clickHouse.util.ts
`file: clickHouse/clickHouse.util.ts:6`

`formatDateTimeForClickHouse(date: Date | string) → string`

Converts Date or ISO string to ClickHouse DateTime64(3) format: YYYY-MM-DD HH:mm:ss.SSS (removes T and Z).

`formatDateForClickHouse(date: Date) → string`

Converts Date to ClickHouse Date format: YYYY-MM-DD.

### ClickHouseModule
`file: clickHouse/clickHouse.module.ts:7`

NestJS module exporting ClickHouseService with TwentyConfigModule dependency.

---

## database/clickHouse/migrations & seeds

### run-migrations.ts
`file: clickHouse/migrations/run-migrations.ts:79`

Standalone script for ClickHouse schema migrations. Ensures database exists, creates _migration tracking table, reads .sql files from directory, checks if already applied, parses statements (splits by semicolon, filters comments), executes each, records execution. Handles environment variables (CLICKHOUSE_URL, NODE_ENV).

`ensureDatabaseExists() → Promise<void>` (async function)

Parses CLICKHOUSE_URL, creates database on main connection, silently ignores permission errors.

`ensureMigrationTable(client) → Promise<void>`

Creates _migration MergeTree table tracking filename and applied_at timestamp.

`hasMigrationBeenRun(filename, client) → Promise<boolean>`

Queries _migration table for filename, returns true if found.

`recordMigration(filename, client) → Promise<void>`

Inserts migration record with current timestamp.

### run-seeds.ts
`file: clickHouse/seeds/run-seeds.ts:21`

Standalone script seeding test event data. Imports fixtures (workspaceEventFixtures, objectEventFixtures, usageEventFixtures), inserts via client.insert() into respective tables.

`seedEvents() → Promise<void>` (async function)

Logs count, inserts each event type, logs success, closes client on completion or error.

---

## database/pg

### set-pg-date-type-parser.ts
`file: pg/set-pg-date-type-parser.ts:5`

`setPgDateTypeParser() → void`

Sets PostgreSQL date type parser for OID 1082 (DATE type) to return raw string value instead of Date object. Called during app initialization.

### PG_DATE_TYPE_OID constant
`file: pg/constants/PG_DATE_TYPE_OID.ts:1`

Constant: 1082 (PostgreSQL DATE type OID).

---

## database/scripts

### setup-db.ts
`file: scripts/setup-db.ts:1`

Initialization script creating PostgreSQL schemas and extensions. Initializes rawDataSource, creates public/core schemas, enables uuid-ossp and unaccent extensions, creates unaccent_immutable wrapper function. Conditionally enables FDW (Foreign Data Wrapper) if IS_FDW_ENABLED=true: postgres_fdw, wrappers, mysql_fdw, and Supabase wrappers (airtable, bigQuery, clickHouse, firebase, logflare, s3, stripe).

`checkForeignDataWrapperExists(wrapperName) → Promise<boolean>` (async function)

Queries pg_foreign_data_wrapper to check if wrapper already exists.

### setup-db-utils.ts
`file: scripts/setup-db-utils.ts:3`

Utility functions for database setup.

`camelToSnakeCase(str) → string`

Converts camelCase to snake_case (e.g., "airtable" → "airtable_fdw_handler").

`performQuery<T>(query, consoleDescription, withLog, ignoreAlreadyExistsError) → Promise<T | undefined>`

Executes query, logs result or error. If ignoreAlreadyExistsError and error contains "already exists", treats as success. Returns undefined on error.

### truncate-db.ts
`file: scripts/truncate-db.ts:5`

Cleanup script dropping all non-system schemas. Initializes rawDataSource, queries pg_catalog.pg_namespace to find all non-system schemas, batches drops in groups of 10 (to avoid lock contention), logs completion.

`dropSchemasSequentially() → Promise<void>` (async function)

Filters schemas (excludes pg_*, information_schema, metric_helpers, user_management, public), drops each with CASCADE.

---

## database/typeorm

### database-gauge.service.ts
`file: typeorm/database-gauge.service.ts`

Service for monitoring database metrics. Located in typeorm module but likely used for health checks/metrics.

### typeorm.module.ts
`file: typeorm/typeorm.module.ts`

Core TypeORM module providing data source configuration and initialization for the application.

### core.datasource.ts & raw.datasource.ts
`file: typeorm/core/core.datasource.ts`
`file: typeorm/raw/raw.datasource.ts`

TypeORM DataSource instances: core for main application queries, raw for direct SQL operations during setup/migrations.

---

## Summary Statistics

- **Total Functions/Methods Documented**: ~95+ exported functions, service methods, CLI commands, and utilities
- **Command Classes**: 10 (NestJS CLI commands extending CommandRunner)
- **Service Classes**: 5+ (WorkspaceIteratorService, ClickHouseService, WorkspaceExportService, SecretEncryptionRotationRunnerService, etc.)
- **Handler Classes**: 3 (ColumnRotationSiteHandler, ConnectionParametersRotationHandler, SensitiveConfigStorageRotationHandler)
- **Utility Functions**: 15+ (formatting, pattern building, schema generation, data conversion)
- **Abstract Base Classes**: 3 (MigrationCommandRunner, WorkspaceCommandRunner, SecretEncryptionRotationHandler)

### Key Patterns

1. **Command Runners**: Commands extend CommandRunner, use @Option decorators for CLI flags, call service methods, handle errors/logging
2. **Workspace Iteration**: WorkspaceIteratorService with flexible filtering (IDs, activation status, pagination)
3. **Batch Processing**: Large data operations chunked (10k rows for export, 1000 for ClickHouse inserts)
4. **Encryption Rotation**: Generic handler pattern with site-specific implementations (column, connection parameters, config storage)
5. **Export**: Multi-format support (INSERT statements, PostgreSQL COPY, DDL generation from metadata)

