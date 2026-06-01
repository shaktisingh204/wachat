import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.23.0', 1780000005000)
// Ported to plain async functions backed by MongoDB.
// Original: Update command menu items that require object context from GLOBAL
// to GLOBAL_OBJECT_CONTEXT availability type.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Constants
// PORT-NOTE: Stable universal identifiers from STANDARD_COMMAND_MENU_ITEMS.
// ---------------------------------------------------------------------------

const UNIVERSAL_IDENTIFIERS_TO_FIX = new Set<string>([
  "createNewRecord-standard-command-menu-item",
  "importRecords-standard-command-menu-item",
  "exportView-standard-command-menu-item",
  "seeDeletedRecords-standard-command-menu-item",
  "createNewView-standard-command-menu-item",
  "hideDeletedRecords-standard-command-menu-item",
]);

const TARGET_AVAILABILITY_TYPE = "GLOBAL_OBJECT_CONTEXT";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandMenuItemDoc = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  availabilityType: string;
  updatedAt: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function updateGlobalObjectContextCommandMenuItems(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  console.log(
    `${isDryRun ? "[DRY RUN] " : ""}Starting GLOBAL_OBJECT_CONTEXT availability type update for workspace ${workspaceId}`,
  );

  const existingItems = await db
    .collection<CommandMenuItemDoc>("sabcrm_commandMenuItem")
    .find({
      workspaceId,
      universalIdentifier: { $in: [...UNIVERSAL_IDENTIFIERS_TO_FIX] },
    })
    .toArray();

  const itemsToUpdate = existingItems.filter(
    (item) => item.availabilityType !== TARGET_AVAILABILITY_TYPE,
  );

  if (itemsToUpdate.length === 0) {
    console.log(
      `Command menu item availability types already up to date for workspace ${workspaceId}`,
    );
    return;
  }

  console.log(
    `Found ${itemsToUpdate.length} command menu item(s) to update for workspace ${workspaceId}`,
  );

  if (isDryRun) {
    console.log(
      `[DRY RUN] Would update ${itemsToUpdate.length} command menu item availability type(s) for workspace ${workspaceId}`,
    );
    return;
  }

  const now = new Date().toISOString();

  for (const item of itemsToUpdate) {
    await db.collection("sabcrm_commandMenuItem").updateOne(
      { _id: item._id },
      {
        $set: {
          availabilityType: TARGET_AVAILABILITY_TYPE,
          updatedAt: now,
        },
      },
    );
  }

  console.log(
    `Successfully updated ${itemsToUpdate.length} command menu item availability type(s) for workspace ${workspaceId}`,
  );
}
