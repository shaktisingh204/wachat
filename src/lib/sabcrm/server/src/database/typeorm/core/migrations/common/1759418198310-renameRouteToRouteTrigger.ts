// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: renames core."route" table to "routeTrigger"; renames enum + indexes; updates unique constraint name; re-wires FK.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1759418198310 – RenameRouteToRouteTrigger
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.route RENAME TO routeTrigger;
 *         ALTER TYPE core.route_httpmethod_enum RENAME TO routeTrigger_httpmethod_enum;
 *         rename indexes; drop old UNIQUE constraint + FK; add new UNIQUE constraint + FK.
 *   DOWN: reverse of the above.
 *
 * Mongo equivalent:
 *   - Rename collection sabcrm_route -> sabcrm_routeTrigger.
 *   - Recreate indexes on the renamed collection.
 *   - Unique index on { path, httpMethod, workspaceId } (renamed constraint).
 *
 * One-off collection rename (run once; requires no active readers/writers):
 *   db.sabcrm_route.renameCollection("sabcrm_routeTrigger");
 */

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  // Best-effort rename (will throw if source doesn't exist, or destination already exists)
  try {
    await db
      .collection("sabcrm_route")
      .rename("sabcrm_routeTrigger", { dropTarget: false });
  } catch {
    // Collection may already be renamed — safe to continue
  }

  const collection = db.collection("sabcrm_routeTrigger");

  // Unique constraint: path + httpMethod + workspaceId
  await collection.createIndex(
    { path: 1, httpMethod: 1, workspaceId: 1 },
    {
      unique: true,
      name: "IDX_routeTrigger_path_httpMethod_workspaceId_unique",
    },
  );

  // Index on serverlessFunctionId for cascade-style lookups
  await collection.createIndex(
    { serverlessFunctionId: 1 },
    { name: "IDX_routeTrigger_serverlessFunctionId" },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  try {
    await db
      .collection("sabcrm_routeTrigger")
      .rename("sabcrm_route", { dropTarget: false });
  } catch {
    // Safe to ignore
  }

  const collection = db.collection("sabcrm_route");
  await collection.createIndex(
    { path: 1, httpMethod: 1, workspaceId: 1 },
    {
      unique: true,
      name: "IDX_route_path_httpMethod_workspaceId_unique",
    },
  );
}

export const migrationNote = {
  id: "1759418198310",
  name: "RenameRouteToRouteTrigger",
  mongoEquivalent:
    "sabcrm_route renamed to sabcrm_routeTrigger; unique index on { path, httpMethod, workspaceId }",
} as const;
