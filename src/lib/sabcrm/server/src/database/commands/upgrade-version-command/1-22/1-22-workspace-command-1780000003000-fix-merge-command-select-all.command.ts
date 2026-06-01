import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.22.0', 1780000003000)
// Ported to plain async functions backed by MongoDB.
// Original: Fix merge command menu item to not appear in select-all (exclusion) mode
// by updating its conditionalAvailabilityExpression.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Constants
// PORT-NOTE: Stable universal identifier from STANDARD_COMMAND_MENU_ITEMS.
// ---------------------------------------------------------------------------

const MERGE_MULTIPLE_RECORDS_UNIVERSAL_IDENTIFIER =
  "mergeMultipleRecords-standard-command-menu-item";

// Standard conditionalAvailabilityExpression that excludes select-all mode
const STANDARD_CONDITIONAL_AVAILABILITY_EXPRESSION =
  "!isSelectAllActive";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandMenuItemDoc = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  conditionalAvailabilityExpression: string | null;
  updatedAt: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function fixMergeCommandSelectAll(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  console.log(
    `${isDryRun ? "[DRY RUN] " : ""}Starting merge command select-all expression fix for workspace ${workspaceId}`,
  );

  const existingItem = await db
    .collection<CommandMenuItemDoc>("sabcrm_commandMenuItem")
    .findOne({
      workspaceId,
      universalIdentifier: MERGE_MULTIPLE_RECORDS_UNIVERSAL_IDENTIFIER,
    });

  if (
    !existingItem ||
    existingItem.conditionalAvailabilityExpression ===
      STANDARD_CONDITIONAL_AVAILABILITY_EXPRESSION
  ) {
    console.log(
      `Merge command menu item expression already up to date for workspace ${workspaceId}`,
    );
    return;
  }

  console.log(
    `Found 1 command menu item to update for workspace ${workspaceId}`,
  );

  if (isDryRun) {
    console.log(
      `[DRY RUN] Would update 1 command menu item expression for workspace ${workspaceId}`,
    );
    return;
  }

  await db.collection("sabcrm_commandMenuItem").updateOne(
    { _id: existingItem._id },
    {
      $set: {
        conditionalAvailabilityExpression:
          STANDARD_CONDITIONAL_AVAILABILITY_EXPRESSION,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  console.log(
    `Successfully updated 1 command menu item expression for workspace ${workspaceId}`,
  );
}
