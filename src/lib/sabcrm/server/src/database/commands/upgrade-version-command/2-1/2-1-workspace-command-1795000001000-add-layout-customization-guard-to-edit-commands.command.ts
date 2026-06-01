import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { replaceLegacyPageEditModeIdentifier } from "./utils/replace-legacy-page-edit-mode-identifier.util";

// PORT-NOTE: Workspace command (version 2.1.0, timestamp 1795000001000).
// Guards layout-edit command menu items and migrates legacy isPageInEditMode
// expressions to isDashboardPageLayoutInEditMode.

export const ADD_LAYOUT_CUSTOMIZATION_GUARD_COMMAND_NAME =
  "upgrade:2-1:add-layout-customization-guard-to-edit-commands";

// These universalIdentifiers receive a new conditionalAvailabilityExpression
// sourced directly from the standard application map.
const UNIVERSAL_IDENTIFIERS_TO_UPDATE = new Set<string>([
  "editRecordPageLayout",
  "editDashboardLayout",
  "saveDashboardLayout",
  "cancelDashboardLayout",
]);

export interface AddLayoutCustomizationGuardOptions {
  dryRun?: boolean;
}

export interface AddLayoutCustomizationGuardResult {
  workspaceId: string;
  updatedCount: number;
  skipped: boolean;
}

/**
 * Guards layout-edit command menu items and replaces legacy page-edit-mode
 * identifiers in conditionalAvailabilityExpression for a given workspace.
 *
 * - Items in UNIVERSAL_IDENTIFIERS_TO_UPDATE receive the standard expression.
 * - All other items have their expression run through replaceLegacyPageEditModeIdentifier.
 */
export async function addLayoutCustomizationGuardToEditCommands(
  workspaceId: string,
  options: AddLayoutCustomizationGuardOptions = {},
): Promise<AddLayoutCustomizationGuardResult> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_commandMenuItem");

  const allItems = await collection.find({ workspaceId }).toArray();

  const now = new Date().toISOString();
  const itemsToUpdate: Array<{ id: unknown; expression: string }> = [];

  for (const item of allItems) {
    const universalIdentifier: string = item.universalIdentifier ?? "";

    if (UNIVERSAL_IDENTIFIERS_TO_UPDATE.has(universalIdentifier)) {
      // PORT-NOTE: In the original, the standard expression comes from
      // computeTwentyStandardApplicationAllFlatEntityMaps. In SabNode we store
      // it as `standardConditionalAvailabilityExpression` on the document.
      if (
        item.conditionalAvailabilityExpression !==
        item.standardConditionalAvailabilityExpression
      ) {
        itemsToUpdate.push({
          id: item._id,
          expression: item.standardConditionalAvailabilityExpression ?? item.conditionalAvailabilityExpression,
        });
      }
      continue;
    }

    // Replace legacy isPageInEditMode identifier in all other items.
    const next = replaceLegacyPageEditModeIdentifier(
      item.conditionalAvailabilityExpression ?? null,
    );

    if (next !== item.conditionalAvailabilityExpression) {
      itemsToUpdate.push({
        id: item._id,
        expression: next ?? item.conditionalAvailabilityExpression,
      });
    }
  }

  if (itemsToUpdate.length === 0) {
    return { workspaceId, updatedCount: 0, skipped: true };
  }

  if (isDryRun) {
    return { workspaceId, updatedCount: itemsToUpdate.length, skipped: false };
  }

  let updatedCount = 0;

  for (const { id, expression } of itemsToUpdate) {
    const result = await collection.updateOne(
      { _id: id },
      { $set: { conditionalAvailabilityExpression: expression, updatedAt: now } },
    );

    if (result.modifiedCount > 0) {
      updatedCount++;
    }
  }

  return { workspaceId, updatedCount, skipped: false };
}
