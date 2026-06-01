import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that added an
// `applicationId` uuid column to the `publicDomain` table, along with an index
// and a foreign-key constraint referencing `application`.
//
// In MongoDB, `applicationId` is added as a string field on publicDomain
// documents. The FK constraint has no MongoDB equivalent; referential
// integrity is enforced at the application layer. The index IS ported.
//
// Original SQL:
//   ALTER TABLE "core"."publicDomain" ADD "applicationId" uuid
//   CREATE INDEX "IDX_PUBLIC_DOMAIN_APPLICATION_ID" ON "core"."publicDomain" ("applicationId")
//   ALTER TABLE "core"."publicDomain" ADD CONSTRAINT ... FOREIGN KEY ("applicationId") ...

export const VERSION = '2.4.0';
export const TIMESTAMP = 1798000003000;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_publicdomain');

  // Create index on applicationId (equivalent to IDX_PUBLIC_DOMAIN_APPLICATION_ID)
  await col.createIndex({ applicationId: 1 }, { sparse: true, background: true });
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_publicdomain');

  await col.dropIndex('applicationId_1').catch(() => {
    // Ignore if index does not exist
  });
}
