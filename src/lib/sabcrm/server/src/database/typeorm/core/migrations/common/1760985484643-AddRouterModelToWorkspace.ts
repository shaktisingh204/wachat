// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."workspace" table — adds "routerModel" varchar NOT NULL DEFAULT 'auto'.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * Migration 1760985484643 – AddRouterModelToWorkspace
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.workspace ADD routerModel character varying NOT NULL DEFAULT 'auto';
 *   DOWN: ALTER TABLE core.workspace DROP COLUMN routerModel;
 *
 * Mongo equivalent:
 *   - sabcrm_workspace documents gain a `routerModel` string field (default: 'auto').
 *   - Schema-less Mongo requires no DDL.
 *   - Seed default for existing documents (run once):
 *       db.sabcrm_workspace.updateMany(
 *         { routerModel: { $exists: false } },
 *         { $set: { routerModel: 'auto' } }
 *       );
 */

export const ROUTER_MODEL_DEFAULT = "auto";

export async function seedRouterModelDefault(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_workspace")
    .updateMany(
      { routerModel: { $exists: false } },
      { $set: { routerModel: ROUTER_MODEL_DEFAULT } },
    );
}

export const migrationNote = {
  id: "1760985484643",
  name: "AddRouterModelToWorkspace",
  mongoEquivalent:
    "seed routerModel='auto' on sabcrm_workspace documents missing the field",
} as const;
