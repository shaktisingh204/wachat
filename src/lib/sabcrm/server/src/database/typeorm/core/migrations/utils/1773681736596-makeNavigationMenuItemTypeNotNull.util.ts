// PORT-NOTE: pg-migration->mongo-index/seed
// Original Twenty migration: makeNavigationMenuItemTypeNotNull
// This migration:
//   - Sets navigationMenuItem.type NOT NULL
//   - Drops + re-adds a CHECK constraint enforcing type-field coherence:
//       FOLDER | OBJECT (needs targetObjectMetadataId) | VIEW (needs viewId) |
//       RECORD (needs targetRecordId + targetObjectMetadataId) | LINK (needs link)
//
// In MongoDB there is no native CHECK constraint. The equivalent is:
//   - Application-layer validation (e.g. Zod schema) on write
//   - A partial sparse index on `type` to support efficient queries
//
// The allowed type values (FOLDER, OBJECT, VIEW, RECORD, LINK) are documented below
// for reference when implementing application-layer validation.

import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

export const NAVIGATION_MENU_ITEM_TYPES = [
  "FOLDER",
  "OBJECT",
  "VIEW",
  "RECORD",
  "LINK",
] as const;

export type NavigationMenuItemType = (typeof NAVIGATION_MENU_ITEM_TYPES)[number];

/**
 * Ensures an index on sabcrm_navigationmenuitem.type for efficient type-based queries.
 * Application layer must enforce the CHECK constraint that was present in Postgres.
 */
export async function ensureNavigationMenuItemIndexes(): Promise<void> {
  const db = await connectToDatabase();
  const col = db.collection("sabcrm_navigationmenuitem");

  await col.createIndex(
    { type: 1 },
    { sparse: true, name: "IDX_navigationMenuItem_type" }
  );
}
