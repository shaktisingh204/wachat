// PORT-NOTE: pg-migration->mongo-index/seed
// Origin: core."workspace" table — adds "trashRetentionDays" integer NOT NULL DEFAULT 14.

/**
 * Migration 1760356369619 – AddWorkspaceTrashRetention
 *
 * Postgres intent:
 *   UP:   ALTER TABLE core.workspace ADD trashRetentionDays integer NOT NULL DEFAULT 14;
 *   DOWN: ALTER TABLE core.workspace DROP COLUMN trashRetentionDays;
 *
 * Mongo equivalent:
 *   - sabcrm_workspace documents gain a `trashRetentionDays` number field (default: 14).
 *   - Schema-less Mongo requires no DDL.
 *   - Seed default for existing documents (run once):
 *       db.sabcrm_workspace.updateMany(
 *         { trashRetentionDays: { $exists: false } },
 *         { $set: { trashRetentionDays: 14 } }
 *       );
 */

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const TRASH_RETENTION_DAYS_DEFAULT = 14;

export async function seedTrashRetentionDefaults(): Promise<void> {
  const { db } = await connectToDatabase();
  await db
    .collection("sabcrm_workspace")
    .updateMany(
      { trashRetentionDays: { $exists: false } },
      { $set: { trashRetentionDays: TRASH_RETENTION_DAYS_DEFAULT } },
    );
}

export const migrationNote = {
  id: "1760356369619",
  name: "AddWorkspaceTrashRetention",
  mongoEquivalent:
    "seed trashRetentionDays=14 on sabcrm_workspace documents missing the field",
} as const;
