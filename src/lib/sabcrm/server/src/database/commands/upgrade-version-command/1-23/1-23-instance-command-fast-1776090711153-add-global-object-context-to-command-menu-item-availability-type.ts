import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.23.0', 1776090711153) — pg-migration->mongo-index/seed
// Original:
//   ALTER TYPE "core"."commandMenuItem_availabilitytype_enum"
//     from ENUM('GLOBAL', 'RECORD_SELECTION', 'FALLBACK')
//     to   ENUM('GLOBAL', 'GLOBAL_OBJECT_CONTEXT', 'RECORD_SELECTION', 'FALLBACK')
//
// Mongo analogue: Enum types do not exist in Mongo. 'GLOBAL_OBJECT_CONTEXT' is
// now a valid string value for sabcrm_commandMenuItem.availabilityType.
// The down() step collapses GLOBAL_OBJECT_CONTEXT back to GLOBAL in all documents.

import { connectToDatabase } from "@/lib/mongodb";

export async function up(): Promise<void> {
  // PORT-NOTE: No DDL required; 'GLOBAL_OBJECT_CONTEXT' is valid once this
  // migration version is recorded. The application layer controls which values
  // are written.
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  // Mirror the Postgres down: update GLOBAL_OBJECT_CONTEXT -> GLOBAL
  await db.collection("sabcrm_commandMenuItem").updateMany(
    { availabilityType: "GLOBAL_OBJECT_CONTEXT" },
    { $set: { availabilityType: "GLOBAL" } },
  );
}
