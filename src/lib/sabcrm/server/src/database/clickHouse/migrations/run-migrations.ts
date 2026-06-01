// PORT-NOTE: run-migrations.ts — ClickHouse schema migration runner.
// This is infrastructure-level tooling that operates against ClickHouse directly,
// not Postgres. The logic is fully compatible with SabNode since it only uses
// the @clickhouse/client SDK and dotenv — no NestJS or TypeORM required.
// Run this script standalone with `ts-node` or `tsx` from the repo root.

/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';

import {
  type ClickHouseClient,
  ClickHouseLogLevel,
  createClient,
} from '@clickhouse/client';
import { config } from 'dotenv';

config({
  path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  override: true,
});

const clickHouseUrl = (): string => {
  const url = process.env.CLICKHOUSE_URL;
  if (url) return url;
  throw new Error(
    'CLICKHOUSE_URL environment variable is not set. Please set it to the ClickHouse URL.',
  );
};

async function ensureDatabaseExists(): Promise<void> {
  const [url, database] = clickHouseUrl().split(/\/(?=[^/]*$)/);
  const client = createClient({ url, log: { level: ClickHouseLogLevel.OFF } });
  try {
    await client.command({
      query: `CREATE DATABASE IF NOT EXISTS "${database}"`,
    });
  } catch {
    // May fail due to permissions, but the database likely already exists.
  } finally {
    await client.close();
  }
}

async function ensureMigrationTable(client: ClickHouseClient): Promise<void> {
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS _migration (
        filename String,
        applied_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY filename;
    `,
  });
}

async function hasMigrationBeenRun(
  filename: string,
  client: ClickHouseClient,
): Promise<boolean> {
  const resultSet = await client.query({
    query: `SELECT count() as count FROM _migration WHERE filename = {filename:String}`,
    query_params: { filename },
    format: 'JSON',
  });
  const result = await resultSet.json<{ data: Array<{ count: number }> }>();
  return result.data[0].count > 0;
}

async function recordMigration(
  filename: string,
  client: ClickHouseClient,
): Promise<void> {
  await client.insert({
    table: '_migration',
    values: [{ filename }],
    format: 'JSONEachRow',
  });
}

async function runMigrations(): Promise<void> {
  const dir = path.join(__dirname);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));

  await ensureDatabaseExists();

  const client = createClient({
    url: clickHouseUrl(),
    clickhouse_settings: {
      allow_experimental_json_type: 1,
    },
    log: { level: ClickHouseLogLevel.OFF },
  });

  await ensureMigrationTable(client);

  for (const file of files) {
    const alreadyRun = await hasMigrationBeenRun(file, client);

    if (alreadyRun) {
      console.log(`✔︎ Skipping already applied migration: ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');

    console.log(`⚡ Running ${file}...`);

    const statements = sql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter(
        (stmt) =>
          stmt.length > 0 &&
          !stmt.startsWith('--') &&
          !stmt.match(/^[\s-]*$/),
      );

    for (const statement of statements) {
      const cleanedStatement = statement
        .split('\n')
        .filter((line) => !line.trim().startsWith('--'))
        .join('\n')
        .trim();

      if (cleanedStatement.length > 0) {
        await client.command({ query: cleanedStatement });
      }
    }

    await recordMigration(file, client);
  }

  console.log('✅ All migrations applied.');
  await client.close();
}

runMigrations().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
