// PORT-NOTE: pg-migration->mongo-index/seed
// Original:
//   CREATE TYPE "core"."navigationMenuItem_type_enum" AS ENUM('VIEW','FOLDER','LINK','OBJECT','RECORD')
//   ALTER TABLE "core"."navigationMenuItem" ADD "type" <enum>
//   ALTER TABLE "core"."navigationMenuItem" DROP CONSTRAINT "CHK_navigation_menu_item_target_fields"
//
// Mongo equivalent:
//   • The "type" field is already schema-less; documents accept the new field.
//   • Valid type values are enforced at the app layer (no Mongo ENUM).
//   • The CHECK constraint on targetRecordId/targetObjectMetadataId has no direct Mongo
//     analogue — it is removed here (mirrors the Postgres migration dropping it).
//   • A sparse index on "type" is added for query performance.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

/** Valid navigation menu item type values (mirrors the Postgres ENUM). */
export const NAVIGATION_MENU_ITEM_TYPES = [
  "VIEW",
  "FOLDER",
  "LINK",
  "OBJECT",
  "RECORD",
] as const;

export type NavigationMenuItemType =
  (typeof NAVIGATION_MENU_ITEM_TYPES)[number];

export async function applyMigration1773681736596(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_navigationMenuItem");

  // Sparse index on "type" for filtered lookups.
  await col.createIndex(
    { type: 1 },
    { sparse: true, background: true, name: "idx_navMenuItem_type" },
  );
}

/** Reversal: drop the sparse type index. */
export async function rollbackMigration1773681736596(): Promise<void> {
  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_navigationMenuItem");
  await col.dropIndex("idx_navMenuItem_type").catch(() => undefined);
}
