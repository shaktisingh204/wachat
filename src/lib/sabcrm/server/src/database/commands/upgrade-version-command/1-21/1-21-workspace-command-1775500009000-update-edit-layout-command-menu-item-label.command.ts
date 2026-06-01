import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// Original uses a raw Postgres UPDATE on core."commandMenuItem".
// In Mongo we update the sabcrm_command_menu_item collection.

import { connectToDatabase } from "@/lib/mongodb";

export type UpdateEditLayoutCommandMenuItemLabelOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

const EDIT_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER =
  "d9794c67-1799-424f-8871-5ea771dd4a6d";

/**
 * Workspace command: 1.21.0 / 1775500009000
 * Update Edit Page Layout command menu item label to "Edit Layout".
 */
export async function updateEditLayoutCommandMenuItemLabel(
  options: UpdateEditLayoutCommandMenuItemLabelOptions,
): Promise<void> {
  const { workspaceId, dryRun = false } = options;

  if (dryRun) {
    console.log(
      `[DRY RUN] Would update Edit Layout command menu item label for workspace ${workspaceId}. Skipping.`,
    );
    return;
  }

  const { db } = await connectToDatabase();
  const col = db.collection("sabcrm_command_menu_item");

  const result = await col.updateMany(
    {
      workspaceId,
      universalIdentifier: EDIT_RECORD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
      $or: [
        { label: { $ne: "Edit Layout" } },
        { shortLabel: { $ne: "Edit Layout" } },
      ],
    },
    {
      $set: { label: "Edit Layout", shortLabel: "Edit Layout" },
    },
  );

  if (result.modifiedCount === 0) {
    console.log(
      `Edit Layout command menu item already up to date for workspace ${workspaceId}`,
    );
  } else {
    console.log(
      `Updated Edit Layout command menu item label for workspace ${workspaceId}`,
    );
  }
}
