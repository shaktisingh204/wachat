// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: ChangeNavigationMenuItemPositionToDoublePrecision1771499112046
//
// Postgres DDL intent:
//   - Changed column `position` in `core.navigationMenuItem` from INTEGER to DOUBLE PRECISION
//
// MongoDB equivalent:
//   - MongoDB stores numbers as BSON Doubles by default, so no schema migration is needed.
//   - Existing documents in `sabcrm_navigationMenuItem` that stored `position` as an integer
//     are already compatible with double-precision reads/writes.
//   - If strict BSON typing is required, run a one-time update to coerce existing values:
//
//   db.getSiblingDB("sabcrm").sabcrm_navigationMenuItem.updateMany(
//     { position: { $type: "int" } },
//     [{ $set: { position: { $toDouble: "$position" } } }]
//   );
//
// No index changes are required by this migration.

import "server-only";
import { connectToDatabase } from "@/lib/mongodb";

export const MIGRATION_NAME =
  "ChangeNavigationMenuItemPositionToDoublePrecision1771499112046";

/**
 * Coerces any integer `position` values to doubles in `sabcrm_navigationMenuItem`.
 * This is a no-op in most MongoDB drivers but ensures BSON type consistency.
 */
export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  // MongoDB pipeline update: cast integer positions to double
  await db.collection("sabcrm_navigationMenuItem").updateMany(
    { position: { $type: "int" } },
    // @ts-expect-error — pipeline update syntax accepted at runtime
    [{ $set: { position: { $toDouble: "$position" } } }],
  );
}

/**
 * Reverses the coercion (no meaningful rollback in Mongo — integers are compatible).
 */
export async function down(): Promise<void> {
  // No-op: MongoDB does not distinguish integer vs double for compatibility purposes.
}
