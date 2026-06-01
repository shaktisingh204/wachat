import "server-only";

// PORT-NOTE: server-logic
// Original: TypeORM rawDataSource using postgres DataSource built from PG_DATABASE_URL.
// SabNode runs MongoDB, not Postgres; there is no "raw" Postgres DataSource.
// This module re-exports the SabNode MongoDB connection as the canonical raw data accessor
// for any CRM code that imported rawDataSource for ad-hoc queries.
//
// If a Postgres DataSource is genuinely needed in the future (e.g. for external PG analytics),
// install 'pg' and reconstruct a direct pg.Pool from PG_DATABASE_URL.

import { connectToDatabase } from "@/lib/mongodb";
import type { Db } from "mongodb";

/**
 * Returns the raw MongoDB Db instance (equivalent role to TypeORM's rawDataSource).
 * Use for ad-hoc / low-level queries against the SabCRM database.
 */
export async function getRawDataSource(): Promise<Db> {
  return connectToDatabase();
}

// Named re-export to ease import compatibility with code referencing `rawDataSource`
export { getRawDataSource as rawDataSource };
