import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.23.0', 1775752781995) — pg-migration->mongo-index/seed
// Original:
//   - ALTER TABLE "core"."navigationMenuItem" ADD "pageLayoutId" uuid
//   - ALTER TYPE "core"."pageLayout_type_enum" ADD VALUE 'STANDALONE_PAGE'
//   - ALTER TYPE "core"."navigationMenuItem_type_enum" ADD VALUE 'PAGE_LAYOUT'
//   - ADD CONSTRAINT CHK_navigation_menu_item_type_fields (updated)
//   - CREATE INDEX IDX_NAVIGATION_MENU_ITEM_PAGE_LAYOUT_ID_WORKSPACE_ID
//   - ADD FK navigationMenuItem.pageLayoutId -> pageLayout.id
//
// Mongo analogue:
//   - No DDL needed for new optional field (pageLayoutId).
//   - Enum values are just strings; new values are valid after this migration.
//   - Create a compound index on (pageLayoutId, workspaceId).
//   - No FK constraints in Mongo.

import { connectToDatabase } from "@/lib/mongodb";

const INDEX_NAME = "IDX_NAVIGATION_MENU_ITEM_PAGE_LAYOUT_ID_WORKSPACE_ID";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  // Backfill pageLayoutId = null on existing navigationMenuItem documents
  await db
    .collection("sabcrm_navigationMenuItem")
    .updateMany(
      { pageLayoutId: { $exists: false } },
      { $set: { pageLayoutId: null } },
    );

  // Create compound index for pageLayoutId queries
  await db
    .collection("sabcrm_navigationMenuItem")
    .createIndex(
      { pageLayoutId: 1, workspaceId: 1 },
      { name: INDEX_NAME, sparse: true, background: true },
    );

  // PORT-NOTE: 'STANDALONE_PAGE' and 'PAGE_LAYOUT' are now valid string values
  // for sabcrm_pageLayout.type and sabcrm_navigationMenuItem.type respectively.
  // No further action needed in Mongo.
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  try {
    await db.collection("sabcrm_navigationMenuItem").dropIndex(INDEX_NAME);
  } catch {
    // Index may not exist
  }

  // Remove PAGE_LAYOUT navigation items (mirrors the Postgres DELETE step)
  await db
    .collection("sabcrm_navigationMenuItem")
    .deleteMany({ type: "PAGE_LAYOUT" });

  // Remove STANDALONE_PAGE page layouts
  await db
    .collection("sabcrm_pageLayout")
    .deleteMany({ type: "STANDALONE_PAGE" });

  await db
    .collection("sabcrm_navigationMenuItem")
    .updateMany({}, { $unset: { pageLayoutId: "" } });
}
