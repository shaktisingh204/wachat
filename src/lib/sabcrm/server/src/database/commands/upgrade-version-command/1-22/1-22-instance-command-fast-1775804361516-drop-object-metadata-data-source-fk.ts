import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.22.0', 1775804361516) — pg-migration->mongo-index
// Original: DROP FK + DROP INDEX + ALTER COLUMN "dataSourceId" DROP NOT NULL
// on "core"."objectMetadata".
//
// Mongo analogue:
//  up:   drop the dataSourceId index (if it exists) and remove the sparse
//        constraint so the field becomes optional at the application layer.
//  down: recreate the index.
//
// There are no foreign-key constraints in Mongo; the FK removal step is a no-op.

import { connectToDatabase } from "@/lib/mongodb";

const INDEX_NAME = "IDX_OBJECT_METADATA_DATA_SOURCE_ID";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  try {
    await db.collection("sabcrm_objectMetadata").dropIndex(INDEX_NAME);
  } catch {
    // Index may not exist
  }

  // PORT-NOTE: Making dataSourceId optional is enforced at the application
  // layer in Mongo. No schema change is required here.
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  await db.collection("sabcrm_objectMetadata").createIndex(
    { dataSourceId: 1 },
    { name: INDEX_NAME, background: true, sparse: false },
  );
}
