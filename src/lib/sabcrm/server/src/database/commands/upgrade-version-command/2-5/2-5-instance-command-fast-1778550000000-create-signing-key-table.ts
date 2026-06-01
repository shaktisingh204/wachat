import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: This was a TypeORM/Postgres fast instance command that created
// the `signingKey` table in the `core` schema with a unique partial index
// ensuring at most one `isCurrent = true` row.
//
// In MongoDB we create the `sabcrm_signingkey` collection (implicit) and
// add the equivalent unique sparse index for the isCurrent=true constraint.
//
// Original SQL (up):
//   CREATE TABLE IF NOT EXISTS "core"."signingKey" (
//     id uuid, publicKey varchar NOT NULL, privateKey varchar,
//     isCurrent boolean NOT NULL DEFAULT false,
//     revokedAt timestamptz, createdAt timestamptz, updatedAt timestamptz,
//     PRIMARY KEY (id)
//   )
//   CREATE UNIQUE INDEX IF NOT EXISTS "IDX_SIGNING_KEY_IS_CURRENT_UNIQUE"
//     ON "core"."signingKey" ("isCurrent") WHERE "isCurrent" = true

export const VERSION = '2.5.0';
export const TIMESTAMP = 1778550000000;

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_signingkey');

  // Unique partial index: at most one document may have isCurrent = true
  await col.createIndex(
    { isCurrent: 1 },
    {
      unique: true,
      partialFilterExpression: { isCurrent: { $eq: true } },
      name: 'IDX_SIGNING_KEY_IS_CURRENT_UNIQUE',
    },
  );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection('sabcrm_signingkey');

  await col.dropIndex('IDX_SIGNING_KEY_IS_CURRENT_UNIQUE').catch(() => {
    // Ignore if index does not exist
  });
}
