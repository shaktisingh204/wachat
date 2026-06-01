// PORT-NOTE: Ported from twenty-server database/scripts/truncate-db.ts
// The original drops all Postgres schemas (except system ones) sequentially.
// In SabNode (MongoDB) the equivalent is dropping all SabCRM collections.
// A Postgres variant is also preserved for export/migration tooling.
//
// Exported functions:
//   dropSchemasSequentially(dataSource) — Postgres DDL, mirrors the original.
//   dropSabcrmCollections()             — MongoDB equivalent for SabNode.

import { connectToDatabase } from '@/lib/mongodb';
import { performQuery } from './setup-db-utils';

type PgDataSource = {
  initialize: () => Promise<void>;
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>;
};

// ---------------------------------------------------------------------------
// Postgres variant (mirrors the original for export/migration tooling)
// ---------------------------------------------------------------------------

export const dropSchemasSequentially = async (
  dataSource: PgDataSource,
): Promise<void> => {
  await dataSource.initialize();

  const schemas =
    (await performQuery<{ schema_name: string }[]>(
      dataSource,
      `
      SELECT n.nspname AS "schema_name"
      FROM pg_catalog.pg_namespace n
      WHERE n.nspname !~ '^pg_'
        AND n.nspname <> 'information_schema'
        AND n.nspname NOT IN ('metric_helpers', 'user_management', 'public')
    `,
      'Fetching schemas...',
    )) ?? [];

  const batchSize = 10;

  for (let i = 0; i < schemas.length; i += batchSize) {
    const batch = schemas.slice(i, i + batchSize);

    await Promise.all(
      batch.map((schema) =>
        performQuery(
          dataSource,
          `DROP SCHEMA IF EXISTS "${schema.schema_name}" CASCADE;`,
          `Dropping schema ${schema.schema_name}...`,
        ),
      ),
    );
  }

  console.log('All schemas dropped successfully.');
};

// ---------------------------------------------------------------------------
// MongoDB variant — drops all sabcrm_* collections
// ---------------------------------------------------------------------------

export const dropSabcrmCollections = async (): Promise<void> => {
  const { db } = await connectToDatabase();
  const collections = await db.listCollections().toArray();

  const sabcrmCollections = collections.filter((c) =>
    c.name.startsWith('sabcrm_'),
  );

  await Promise.all(
    sabcrmCollections.map(async (c) => {
      await db.collection(c.name).drop();
      console.log(`Dropped collection: ${c.name}`);
    }),
  );

  console.log('All SabCRM collections dropped successfully.');
};
