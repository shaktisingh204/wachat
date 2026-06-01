import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: Workspace command (version 2.1.0, timestamp 1790000000000).
// Gates exportRecords / exportView / importRecords command menu items behind
// EXPORT_CSV / IMPORT_CSV permission flags by updating their
// conditionalAvailabilityExpression to match the standard definition.

export const GATE_EXPORT_IMPORT_COMMAND_NAME =
  "upgrade:2-1:gate-export-import-by-permission-flag";

// These are the universalIdentifiers from STANDARD_COMMAND_MENU_ITEMS.
const UNIVERSAL_IDENTIFIERS_TO_FIX = new Set<string>([
  "exportRecords",
  "exportView",
  "importRecords",
]);

export interface GateExportImportOptions {
  dryRun?: boolean;
}

export interface GateExportImportCommandMenuItemsResult {
  workspaceId: string;
  updatedCount: number;
  skipped: boolean;
}

/**
 * Gates export/import command menu items behind permission flags for a given workspace.
 *
 * For each of exportRecords, exportView, importRecords — if the stored
 * conditionalAvailabilityExpression differs from the standard definition,
 * update it to match.
 */
export async function gateExportImportCommandMenuItemsByPermissionFlag(
  workspaceId: string,
  options: GateExportImportOptions = {},
): Promise<GateExportImportCommandMenuItemsResult> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_commandMenuItem");

  // Fetch existing items whose universalIdentifier is one of the three targets.
  const existingItems = await collection
    .find({
      workspaceId,
      universalIdentifier: { $in: [...UNIVERSAL_IDENTIFIERS_TO_FIX] },
    })
    .toArray();

  if (existingItems.length === 0) {
    return { workspaceId, updatedCount: 0, skipped: true };
  }

  // PORT-NOTE: The standard conditionalAvailabilityExpression values are computed
  // by computeTwentyStandardApplicationAllFlatEntityMaps in the original.
  // In SabNode we store those expressions directly in the command menu item documents.
  // Here we identify items whose expression differs from what the standard prescribes;
  // the caller is responsible for passing the expected expressions or querying them
  // from the sabcrm_application collection.

  const itemsToUpdate = existingItems.filter(
    (item) =>
      item.conditionalAvailabilityExpression !== item.standardConditionalAvailabilityExpression,
  );

  if (itemsToUpdate.length === 0) {
    return { workspaceId, updatedCount: 0, skipped: true };
  }

  if (isDryRun) {
    return { workspaceId, updatedCount: itemsToUpdate.length, skipped: false };
  }

  const now = new Date().toISOString();
  let updatedCount = 0;

  for (const item of itemsToUpdate) {
    const result = await collection.updateOne(
      { _id: item._id },
      {
        $set: {
          conditionalAvailabilityExpression:
            item.standardConditionalAvailabilityExpression,
          updatedAt: now,
        },
      },
    );

    if (result.modifiedCount > 0) {
      updatedCount++;
    }
  }

  return { workspaceId, updatedCount, skipped: false };
}
