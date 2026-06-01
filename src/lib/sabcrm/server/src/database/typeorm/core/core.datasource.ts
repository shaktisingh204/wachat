// PORT-NOTE: Ported from twenty-server database/typeorm/core/core.datasource.ts
// TypeORM DataSource / TypeOrmModuleOptions have no direct Next.js equivalent.
// SabNode uses MongoDB as its primary database (via @/lib/mongodb).
// This module exports a configuration object and a typed datasource descriptor
// so that Postgres-based migration/export scripts can still reference it.
// The actual Postgres DataSource is only instantiated if pg + typeorm are
// present in the environment — it is NOT used for normal SabNode operation.

export type LogLevel = 'query' | 'error' | 'warn' | 'info' | 'log' | 'schema';

const isRunningCommand = (): boolean => {
  const scriptPath = process.argv[1] || '';

  return scriptPath.includes('/command/command.');
};

const getLoggingConfig = (): LogLevel[] => {
  if (process.env.NODE_ENV === 'test') {
    return [];
  }

  const ormQueryLogging = process.env.ORM_QUERY_LOGGING || 'disabled';

  switch (ormQueryLogging) {
    case 'disabled':
      return ['error'];
    case 'server-only':
      if (isRunningCommand()) {
        return ['error'];
      }

      return ['query', 'error'];
    case 'always':
      return ['query', 'error'];
    default:
      return ['error'];
  }
};

/**
 * TypeORM-compatible core datasource configuration.
 * Used only by Postgres migration / export tooling — NOT for normal SabNode operation.
 */
export const typeORMCoreModuleOptions = {
  url: process.env.PG_DATABASE_URL,
  type: 'postgres' as const,
  logging: getLoggingConfig(),
  schema: 'core',
  synchronize: false,
  migrationsRun: false,
  migrationsTableName: '_typeorm_migrations',
  metadataTableName: '_typeorm_generated_columns_and_materialized_views',
  ssl:
    process.env.PG_SSL_ALLOW_SELF_SIGNED === 'true'
      ? { rejectUnauthorized: false }
      : undefined,
  extra: {
    query_timeout: Number(process.env.PG_DATABASE_PRIMARY_TIMEOUT_MS ?? 10000),
    idleTimeoutMillis: Number(process.env.PG_POOL_IDLE_TIMEOUT_MS ?? 600000),
    allowExitOnIdle: process.env.PG_POOL_ALLOW_EXIT_ON_IDLE === 'true',
  },
};

/**
 * Lazily creates a TypeORM DataSource when typeorm + pg are available.
 * Returns null otherwise so normal SabNode code paths are unaffected.
 *
 * PORT-NOTE: In the original this was a module-level `new DataSource(…)`.
 * We defer instantiation to avoid import-time errors when typeorm is absent.
 */
export const getConnectionSource = (): unknown => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DataSource } = require('typeorm') as typeof import('typeorm');

    return new DataSource(typeORMCoreModuleOptions as import('typeorm').DataSourceOptions);
  } catch {
    return null;
  }
};

/** @deprecated Use getConnectionSource() — kept for import compatibility. */
export const connectionSource = new Proxy({} as NonNullable<ReturnType<typeof getConnectionSource>>, {
  get(_target, prop) {
    const src = getConnectionSource();

    if (!src) throw new Error('typeorm is not available in this environment');

    return (src as Record<string | symbol, unknown>)[prop as string];
  },
});
