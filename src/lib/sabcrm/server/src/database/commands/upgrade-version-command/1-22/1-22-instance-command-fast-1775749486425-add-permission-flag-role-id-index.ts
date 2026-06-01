import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.22.0', 1775749486425) — pg-migration->mongo-index
// Original: CREATE INDEX IF NOT EXISTS "IDX_PERMISSION_FLAG_ROLE_ID"
//   ON "core"."permissionFlag" ("roleId")
//
// Mongo equivalent: create an index on roleId in the sabcrm_permissionFlag collection.

import { connectToDatabase } from "@/lib/mongodb";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  await db.collection("sabcrm_permissionFlag").createIndex(
    { roleId: 1 },
    { name: "IDX_PERMISSION_FLAG_ROLE_ID", background: true },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  await db.collection("sabcrm_permissionFlag").dropIndex("IDX_PERMISSION_FLAG_ROLE_ID");
}
