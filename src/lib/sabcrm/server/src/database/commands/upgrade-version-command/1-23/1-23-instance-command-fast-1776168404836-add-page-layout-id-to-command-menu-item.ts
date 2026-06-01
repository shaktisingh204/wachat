import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.23.0', 1776168404836) — pg-migration->mongo-index
// Original:
//   - ALTER TABLE "core"."commandMenuItem" ADD "pageLayoutId" uuid
//   - CREATE INDEX IDX_COMMAND_MENU_ITEM_PAGE_LAYOUT_ID_WORKSPACE_ID
//   - ADD FK commandMenuItem.pageLayoutId -> pageLayout.id ON DELETE CASCADE
//
// Mongo analogue:
//   - Backfill pageLayoutId = null on existing documents.
//   - Create compound index on (pageLayoutId, workspaceId).
//   - No FK constraints in Mongo; cascade delete handled at application layer.

import { connectToDatabase } from "@/lib/mongodb";

const INDEX_NAME = "IDX_COMMAND_MENU_ITEM_PAGE_LAYOUT_ID_WORKSPACE_ID";

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  await db
    .collection("sabcrm_commandMenuItem")
    .updateMany(
      { pageLayoutId: { $exists: false } },
      { $set: { pageLayoutId: null } },
    );

  await db
    .collection("sabcrm_commandMenuItem")
    .createIndex(
      { pageLayoutId: 1, workspaceId: 1 },
      { name: INDEX_NAME, sparse: true, background: true },
    );
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  try {
    await db.collection("sabcrm_commandMenuItem").dropIndex(INDEX_NAME);
  } catch {
    // Index may not exist
  }

  await db
    .collection("sabcrm_commandMenuItem")
    .updateMany({}, { $unset: { pageLayoutId: "" } });
}
