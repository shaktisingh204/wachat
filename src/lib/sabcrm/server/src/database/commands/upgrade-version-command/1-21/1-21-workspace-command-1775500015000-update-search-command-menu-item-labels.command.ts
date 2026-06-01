import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.21.0', 1775500015000)
// Ported to plain async functions backed by MongoDB.
// Original: updates search command menu item labels to remove objectMetadata name.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Constants
// PORT-NOTE: These universal identifiers are stable runtime values from
// STANDARD_COMMAND_MENU_ITEMS. They are inlined here as string literals
// matching the Twenty source constants.
// ---------------------------------------------------------------------------

const SEARCH_RECORDS_UNIVERSAL_IDENTIFIER =
  "searchRecords-standard-command-menu-item";
const SEARCH_RECORDS_FALLBACK_UNIVERSAL_IDENTIFIER =
  "searchRecordsFallback-standard-command-menu-item";

const UNIVERSAL_IDENTIFIERS_TO_FIX = new Set<string>([
  SEARCH_RECORDS_UNIVERSAL_IDENTIFIER,
  SEARCH_RECORDS_FALLBACK_UNIVERSAL_IDENTIFIER,
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandMenuItemDoc = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  label: string;
  updatedAt: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function updateSearchCommandMenuItemLabels(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  console.log(
    `${isDryRun ? "[DRY RUN] " : ""}Starting search label update for workspace ${workspaceId}`,
  );

  // The standard labels for these items (source of truth)
  const standardLabels: Record<string, string> = {
    [SEARCH_RECORDS_UNIVERSAL_IDENTIFIER]: "Search",
    [SEARCH_RECORDS_FALLBACK_UNIVERSAL_IDENTIFIER]: "Search",
  };

  const existingItems = await db
    .collection<CommandMenuItemDoc>("sabcrm_commandMenuItem")
    .find({
      workspaceId,
      universalIdentifier: { $in: [...UNIVERSAL_IDENTIFIERS_TO_FIX] },
    })
    .toArray();

  const itemsToUpdate = existingItems
    .filter((item) => {
      const standardLabel = standardLabels[item.universalIdentifier];
      return standardLabel !== undefined && item.label !== standardLabel;
    })
    .map((item) => ({
      _id: item._id,
      label: standardLabels[item.universalIdentifier],
      updatedAt: new Date().toISOString(),
    }));

  if (itemsToUpdate.length === 0) {
    console.log(
      `Search command menu item labels already up to date for workspace ${workspaceId}`,
    );
    return;
  }

  console.log(
    `Found ${itemsToUpdate.length} search command menu item(s) to update for workspace ${workspaceId}`,
  );

  if (isDryRun) {
    console.log(
      `[DRY RUN] Would update ${itemsToUpdate.length} search command menu item label(s) for workspace ${workspaceId}`,
    );
    return;
  }

  for (const item of itemsToUpdate) {
    await db.collection("sabcrm_commandMenuItem").updateOne(
      { _id: item._id },
      { $set: { label: item.label, updatedAt: item.updatedAt } },
    );
  }

  console.log(
    `Successfully updated ${itemsToUpdate.length} search command menu item label(s) for workspace ${workspaceId}`,
  );
}
