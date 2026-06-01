// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   ALTER TABLE "core"."applicationRegistration" RENAME COLUMN "marketplaceDisplayData" TO "manifest"
//   DROP COLUMN IF EXISTS description, logoUrl, author, websiteUrl, termsUrl
//
// Mongo equivalent: rename the field and unset the dropped columns in all documents.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Renames marketplaceDisplayData -> manifest and removes deprecated display columns. */
export async function applyMigration1774472400000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_applicationRegistration");

  // Rename field via aggregation pipeline update.
  await col.updateMany(
    { marketplaceDisplayData: { $exists: true } },
    [
      {
        $set: { manifest: "$marketplaceDisplayData" },
      },
      {
        $unset: [
          "marketplaceDisplayData",
          "description",
          "logoUrl",
          "author",
          "websiteUrl",
          "termsUrl",
        ],
      },
    ],
  );

  // Also unset the deprecated columns from docs that never had marketplaceDisplayData.
  await col.updateMany(
    { marketplaceDisplayData: { $exists: false } },
    {
      $unset: {
        description: "",
        logoUrl: "",
        author: "",
        websiteUrl: "",
        termsUrl: "",
      },
    },
  );
}

/** Reversal: rename manifest back and leave deprecated columns absent (no restore). */
export async function rollbackMigration1774472400000(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_applicationRegistration");

  await col.updateMany({ manifest: { $exists: true } }, [
    { $set: { marketplaceDisplayData: "$manifest" } },
    { $unset: ["manifest"] },
  ]);
}
