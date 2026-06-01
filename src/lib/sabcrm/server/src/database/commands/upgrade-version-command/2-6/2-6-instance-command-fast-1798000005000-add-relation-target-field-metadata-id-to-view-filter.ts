import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command (2.6.0
// version, timestamp 1798000005000) that:
//   - Added a nullable `relationTargetFieldMetadataId` uuid column IF NOT EXISTS
//     to the `viewFilter` table
//   - Created a partial index on that column WHERE IS NOT NULL
//   - Added a FK -> fieldMetadata(id) ON DELETE CASCADE
//
// The 2.5.0 variant (timestamp 1747234500000) added the column without an
// index. This 2.6.0 command adds the index and the FK.
//
// In MongoDB we add the index on sabcrm_viewfilter. The field is schemaless.
// FK constraints have no MongoDB equivalent.

export const VERSION = '2.6.0';
export const TIMESTAMP = 1798000005000;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_viewfilter');

  // Partial index: only index documents where the field is set
  await col.createIndex(
    { relationTargetFieldMetadataId: 1 },
    {
      sparse: true,
      name: 'IDX_VIEW_FILTER_RELATION_TARGET_FIELD_METADATA_ID',
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_viewfilter');

  await col
    .dropIndex('IDX_VIEW_FILTER_RELATION_TARGET_FIELD_METADATA_ID')
    .catch(() => {});
}
