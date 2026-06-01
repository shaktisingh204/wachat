import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that dropped
// the `postgresCredentials` table (with its FK constraint) from the `core`
// schema. The `down` recreated the table.
//
// In MongoDB the equivalent collection is `sabcrm_postgrescredentials`. The
// `up` migration drops it (if it exists); the `down` recreates an empty
// collection with a workspaceId index (the FK constraint has no MongoDB
// equivalent).
//
// Original SQL (up):
//   ALTER TABLE "core"."postgresCredentials"
//     DROP CONSTRAINT "FK_9494639abc06f9c8c3691bf5d22"
//   DROP TABLE "core"."postgresCredentials"

export const VERSION = '2.5.0';
export const TIMESTAMP = 1798500000000;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const collections = await db
    .listCollections({ name: 'sabcrm_postgrescredentials' })
    .toArray();

  if (collections.length > 0) {
    await db.collection('sabcrm_postgrescredentials').drop();
  }
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_postgrescredentials');

  // Re-create the collection by adding an index (MongoDB creates on insert)
  await col.createIndex({ workspaceId: 1 }, { name: 'IDX_POSTGRES_CREDENTIALS_WORKSPACE_ID' });
}
