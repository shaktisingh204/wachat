import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: SlowInstanceCommand — backfills pageLayoutWidget.position from gridPosition in Postgres.
// In Mongo the equivalent is an updateMany on sabcrm_pageLayoutWidget.
// Version: 2.1.0  Timestamp: 1795000002000

export interface BackfillPageLayoutWidgetPositionMigration {
  version: "2.1.0";
  timestamp: 1795000002000;
  type: "slow";
  description: "Backfill position from gridPosition on pageLayoutWidget documents";
}

/**
 * Mongo analogue of the Postgres slow-instance data migration.
 *
 * For every pageLayoutWidget document where `position` is null/missing but
 * `gridPosition` exists, synthesise a `position` object with layoutMode=GRID
 * and the four numeric sub-fields from `gridPosition`.
 */
export async function runDataMigration(): Promise<void> {
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_pageLayoutWidget");

  await collection.updateMany(
    {
      position: { $exists: false },
      gridPosition: { $exists: true, $ne: null },
    },
    [
      {
        $set: {
          position: {
            layoutMode: "GRID",
            row: "$gridPosition.row",
            column: "$gridPosition.column",
            rowSpan: "$gridPosition.rowSpan",
            columnSpan: "$gridPosition.columnSpan",
          },
        },
      },
    ],
  );
}

export async function up(): Promise<void> {
  // Schema change — no DDL equivalent in MongoDB.
}

export async function down(): Promise<void> {
  // Reversing the backfill is not needed in Mongo.
}
