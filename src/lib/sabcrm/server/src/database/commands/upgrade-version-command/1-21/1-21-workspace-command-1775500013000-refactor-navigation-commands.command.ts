import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.21.0', 1775500013000)
// Ported to plain async functions backed by MongoDB.
// Original: replaces GO_TO_* command menu items with unified NAVIGATION engine key
// and adds settings navigation items + standardises interpolated labels.
// The Postgres-only `addPayloadCheckConstraintToCommandMenuItem` step (CHECK constraint
// on core schema) has no Mongo analogue and is documented below.

import { connectToDatabase } from "@/lib/mongodb";
import { v4, v5 } from "uuid";

// ---------------------------------------------------------------------------
// Constants (preserved from source)
// ---------------------------------------------------------------------------

const GO_TO_ENGINE_KEYS = [
  "GO_TO_PEOPLE",
  "GO_TO_COMPANIES",
  "GO_TO_DASHBOARDS",
  "GO_TO_OPPORTUNITIES",
  "GO_TO_SETTINGS",
  "GO_TO_TASKS",
  "GO_TO_NOTES",
  "GO_TO_WORKFLOWS",
  "GO_TO_RUNS",
] as const;

// UUID namespace for NAVIGATION command items (from source)
export const NAVIGATION_COMMAND_UUID_NAMESPACE =
  "f47ac10b-58cc-4372-a567-0e02b2c3d479";

export const NAVIGATION_INTERPOLATED_LABEL = "{{objectMetadata.labelPlural}}";
export const NAVIGATION_INTERPOLATED_SHORT_LABEL =
  "{{objectMetadata.labelPlural}}";
export const NAVIGATION_INTERPOLATED_ICON = "{{objectMetadata.icon}}";

// PORT-NOTE: STANDARD_COMMAND_MENU_ITEMS and TWENTY_STANDARD_APPLICATION are
// Twenty-internal runtime constructs that require the full application graph.
// In SabNode these constants are not available; callers must inject equivalent
// data from their own application registry.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandMenuItemDoc = {
  _id: string;
  workspaceId: string;
  applicationId: string;
  universalIdentifier: string;
  engineComponentKey: string;
  label: string;
  shortLabel: string | null;
  icon: string | null;
  position: number;
  isPinned: boolean;
  availabilityType: string;
  conditionalAvailabilityExpression: string | null;
  payload: Record<string, unknown> | null;
  hotKeys: string[] | null;
  updatedAt: string;
  [key: string]: unknown;
};

type ObjectMetadataDoc = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  isActive: boolean;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function refactorNavigationCommands(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  console.log(
    `${isDryRun ? "[DRY RUN] " : ""}Refactoring navigation commands for workspace ${workspaceId}`,
  );

  const allCommandMenuItems = await db
    .collection<CommandMenuItemDoc>("sabcrm_commandMenuItem")
    .find({ workspaceId })
    .toArray();

  // Determine the standard application for this workspace
  const standardApp = await db
    .collection("sabcrm_application")
    .findOne({ workspaceId, isStandard: true });

  const standardAppId = standardApp?._id as string | undefined;

  const standardAppCommandMenuItems = standardApp
    ? allCommandMenuItems.filter((item) => item.applicationId === standardAppId)
    : allCommandMenuItems;

  const goToItemsToDelete = standardAppCommandMenuItems.filter((item) =>
    (GO_TO_ENGINE_KEYS as readonly string[]).includes(item.engineComponentKey),
  );

  console.log(
    `${isDryRun ? "[DRY RUN] Would delete" : "Deleting"} ${goToItemsToDelete.length} old GO_TO_* command(s) for workspace ${workspaceId}`,
  );

  const existingNavigationUniversalIdentifiers = new Set(
    allCommandMenuItems
      .filter((item) => item.engineComponentKey === "NAVIGATION")
      .map((item) => item.universalIdentifier),
  );

  const activeObjects = await db
    .collection<ObjectMetadataDoc>("sabcrm_objectMetadata")
    .find({ workspaceId, isActive: true })
    .toArray();

  console.log(
    `Found ${activeObjects.length} active object(s) for workspace ${workspaceId}`,
  );

  const nonGoToItems = allCommandMenuItems.filter(
    (item) =>
      !(GO_TO_ENGINE_KEYS as readonly string[]).includes(
        item.engineComponentKey,
      ),
  );

  let nextPosition =
    nonGoToItems.reduce((max, item) => Math.max(max, item.position), -1) + 1;

  const now = new Date().toISOString();
  const itemsToCreate: CommandMenuItemDoc[] = [];

  for (const objectMetadata of activeObjects) {
    const universalIdentifier = v5(
      objectMetadata.universalIdentifier,
      NAVIGATION_COMMAND_UUID_NAMESPACE,
    );

    if (existingNavigationUniversalIdentifiers.has(universalIdentifier)) {
      continue;
    }

    itemsToCreate.push({
      _id: v4(),
      universalIdentifier,
      applicationId: standardAppId ?? "",
      workspaceId,
      label: NAVIGATION_INTERPOLATED_LABEL,
      shortLabel: NAVIGATION_INTERPOLATED_SHORT_LABEL,
      icon: NAVIGATION_INTERPOLATED_ICON,
      position: nextPosition++,
      isPinned: false,
      availabilityType: "GLOBAL",
      conditionalAvailabilityExpression: null,
      payload: { objectMetadataId: objectMetadata.universalIdentifier },
      hotKeys: null,
      engineComponentKey: "NAVIGATION",
      createdAt: now,
      updatedAt: now,
    } as CommandMenuItemDoc);
  }

  const staleNavigationItemsToUpdate = allCommandMenuItems
    .filter(
      (item) =>
        item.engineComponentKey === "NAVIGATION" &&
        item.payload &&
        typeof item.payload === "object" &&
        "objectMetadataId" in item.payload &&
        (item.label !== NAVIGATION_INTERPOLATED_LABEL ||
          item.shortLabel !== NAVIGATION_INTERPOLATED_SHORT_LABEL ||
          item.icon !== NAVIGATION_INTERPOLATED_ICON),
    )
    .map((item) => ({
      ...item,
      label: NAVIGATION_INTERPOLATED_LABEL,
      shortLabel: NAVIGATION_INTERPOLATED_SHORT_LABEL,
      icon: NAVIGATION_INTERPOLATED_ICON,
      updatedAt: now,
    }));

  if (
    goToItemsToDelete.length === 0 &&
    itemsToCreate.length === 0 &&
    staleNavigationItemsToUpdate.length === 0
  ) {
    console.log(
      `All NAVIGATION commands already exist and use interpolation for workspace ${workspaceId}, skipping`,
    );
    return;
  }

  console.log(
    `${isDryRun ? "[DRY RUN] Would create" : "Creating"} ${itemsToCreate.length} NAVIGATION command(s) ` +
      `and update ${staleNavigationItemsToUpdate.length} stale item(s) for workspace ${workspaceId}`,
  );

  if (isDryRun) {
    return;
  }

  // Delete old GO_TO_* items
  if (goToItemsToDelete.length > 0) {
    await db
      .collection("sabcrm_commandMenuItem")
      .deleteMany({ _id: { $in: goToItemsToDelete.map((i) => i._id) } });
  }

  // Create new NAVIGATION items
  if (itemsToCreate.length > 0) {
    await db.collection("sabcrm_commandMenuItem").insertMany(itemsToCreate);
  }

  // Update stale items
  for (const item of staleNavigationItemsToUpdate) {
    await db
      .collection("sabcrm_commandMenuItem")
      .updateOne(
        { _id: item._id },
        {
          $set: {
            label: item.label,
            shortLabel: item.shortLabel,
            icon: item.icon,
            updatedAt: item.updatedAt,
          },
        },
      );
  }

  // PORT-NOTE: The Postgres CHECK constraint `CHK_CMD_MENU_ITEM_ENGINE_KEY_COHERENCE`
  // has no Mongo analogue. Enforce equivalent validation at the application layer.

  console.log(
    `Successfully refactored navigation commands for workspace ${workspaceId}`,
  );
}
