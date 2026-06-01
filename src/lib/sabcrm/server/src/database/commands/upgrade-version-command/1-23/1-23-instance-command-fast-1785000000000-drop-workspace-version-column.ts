import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.23.0', 1785000000000) — pg-migration->mongo-index/seed
// Original:
//   up:   ALTER TABLE "core"."workspace" DROP COLUMN IF EXISTS "version"
//   down: ALTER TABLE "core"."workspace" ADD "version" character varying
//
// Mongo analogue:
//   up:   $unset the "version" field from all sabcrm_workspace documents.
//   down: $set "version" = null on all sabcrm_workspace documents (adds the field back).

import { connectToDatabase } from "@/lib/mongodb";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_workspace")
    .updateMany({}, { $unset: { version: "" } });
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_workspace")
    .updateMany(
      { version: { $exists: false } },
      { $set: { version: null } },
    );
}
