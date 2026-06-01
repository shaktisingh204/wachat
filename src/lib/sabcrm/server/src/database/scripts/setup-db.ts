// PORT-NOTE: Ported from twenty-server database/scripts/setup-db.ts
// The original bootstraps a Postgres database with schemas / extensions /
// foreign data wrappers. SabNode uses MongoDB as its primary store, so this
// script is preserved as a Postgres-only utility for CRM export/migration
// tooling. It requires a pg DataSource to be initialized externally.
//
// Usage (Node script):
//   import { setupDb } from '@/lib/sabcrm/server/src/database/scripts/setup-db';
//   await setupDb(myPgDataSource);

import { camelToSnakeCase, performQuery } from './setup-db-utils';

type PgDataSource = {
  initialize: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
};

async function checkForeignDataWrapperExists(
  dataSource: PgDataSource,
  wrapperName: string,
): Promise<boolean> {
  const result = await dataSource.query(
    `SELECT 1 FROM pg_foreign_data_wrapper WHERE fdwname = $1`,
    [wrapperName],
  );

  return (result as unknown[]).length > 0;
}

export const setupDb = async (dataSource: PgDataSource): Promise<void> => {
  await dataSource.initialize();

  const query = (sql: string, desc: string, ignoreExists = false) =>
    performQuery(dataSource, sql, desc, true, ignoreExists);

  await query('CREATE SCHEMA IF NOT EXISTS "public"', 'create schema "public"');
  await query('CREATE SCHEMA IF NOT EXISTS "core"', 'create schema "core"');

  await query(
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    'create extension "uuid-ossp"',
  );
  await query(
    'CREATE EXTENSION IF NOT EXISTS "unaccent"',
    'create extension "unaccent"',
  );
  await query(
    `CREATE OR REPLACE FUNCTION public.unaccent_immutable(input text)
    RETURNS text
    LANGUAGE sql
    IMMUTABLE
AS $$
SELECT public.unaccent('public.unaccent'::regdictionary, input)
$$;`,
    'create immutable unaccent wrapper function',
  );

  // FDW support is paused — mirror the original conditional.
  if (process.env.IS_FDW_ENABLED !== 'true') {
    return;
  }

  await query(
    'CREATE EXTENSION IF NOT EXISTS "postgres_fdw"',
    'create extension "postgres_fdw"',
  );
  await query(
    'CREATE EXTENSION IF NOT EXISTS "wrappers"',
    'create extension "wrappers"',
  );
  await query(
    'CREATE EXTENSION IF NOT EXISTS "mysql_fdw"',
    'create extension "mysql_fdw"',
  );

  const supabaseWrappers = [
    'airtable',
    'bigQuery',
    'clickHouse',
    'firebase',
    'logflare',
    's3',
    'stripe',
  ];

  for (const wrapper of supabaseWrappers) {
    if (await checkForeignDataWrapperExists(dataSource, `${wrapper.toLowerCase()}_fdw`)) {
      continue;
    }

    await query(
      `
        CREATE FOREIGN DATA WRAPPER "${wrapper.toLowerCase()}_fdw"
        HANDLER "${camelToSnakeCase(wrapper)}_fdw_handler"
        VALIDATOR "${camelToSnakeCase(wrapper)}_fdw_validator";
      `,
      `create ${wrapper} "wrappers"`,
      true,
    );
  }
};
