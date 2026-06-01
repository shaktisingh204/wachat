// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddShortLabelPositionToCommandMenuItem1772643950000
//
// Postgres DDL intent (on core.commandMenuItem):
//   - Added nullable varchar `shortLabel`
//   - Added NOT NULL double precision `position` DEFAULT 0
//   - Migrated `availabilityType` enum:
//       old values: GLOBAL | SINGLE_RECORD | BULK_RECORDS
//       SINGLE_RECORD + BULK_RECORDS → RECORD_SELECTION
//       new enum:   GLOBAL | RECORD_SELECTION
//       new default: GLOBAL
//
// MongoDB equivalent:
//   - Seed `position: 0` on documents missing it.
//   - Migrate `availabilityType` values: SINGLE_RECORD → RECORD_SELECTION,
//     BULK_RECORDS → RECORD_SELECTION.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "AddShortLabelPositionToCommandMenuItem1772643950000";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_commandMenuItem");

  // Seed position default
  await col.updateMany(
    { position: { $exists: false } },
    { $set: { position: 0 } },
  );

  // Migrate old enum values
  await col.updateMany(
    { availabilityType: { $in: ["SINGLE_RECORD", "BULK_RECORDS"] } },
    { $set: { availabilityType: "RECORD_SELECTION" } },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_commandMenuItem");

  // Revert RECORD_SELECTION → SINGLE_RECORD (best-effort rollback)
  await col.updateMany(
    { availabilityType: "RECORD_SELECTION" },
    { $set: { availabilityType: "SINGLE_RECORD" } },
  );

  // Remove position field
  await col.updateMany({}, { $unset: { position: "" } });
}
