import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.22.0', 1775500016000)
// Ported to plain async functions backed by MongoDB.
// Original: Add per-object Send Email command menu items (Person, Company, Opportunity)
// to existing workspaces that do not already have them.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Constants
// PORT-NOTE: These universal identifiers are stable values from
// STANDARD_COMMAND_MENU_ITEMS. Inlined here as string literals.
// ---------------------------------------------------------------------------

const SEND_EMAIL_RECORD_SELECTION_UNIVERSAL_IDENTIFIERS = [
  "composeEmailToPerson-standard-command-menu-item",
  "composeEmailToCompany-standard-command-menu-item",
  "composeEmailToOpportunity-standard-command-menu-item",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommandMenuItemDoc = {
  _id: string;
  workspaceId: string;
  universalIdentifier: string;
  label: string;
  availabilityType: string;
  engineComponentKey: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function addSendEmailRecordSelectionCommandMenuItems(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  console.log(
    `${isDryRun ? "[DRY RUN] " : ""}Checking Send Email record-selection commands for workspace ${workspaceId}`,
  );

  const existingItems = await db
    .collection<CommandMenuItemDoc>("sabcrm_commandMenuItem")
    .find({
      workspaceId,
      universalIdentifier: {
        $in: SEND_EMAIL_RECORD_SELECTION_UNIVERSAL_IDENTIFIERS,
      },
    })
    .toArray();

  const existingUniversalIdentifiers = new Set(
    existingItems.map((item) => item.universalIdentifier),
  );

  const missingUniversalIdentifiers =
    SEND_EMAIL_RECORD_SELECTION_UNIVERSAL_IDENTIFIERS.filter(
      (id) => !existingUniversalIdentifiers.has(id),
    );

  if (missingUniversalIdentifiers.length === 0) {
    console.log(
      `Send Email record-selection commands already exist for workspace ${workspaceId}, skipping`,
    );
    return;
  }

  // Build items to create from standard definitions
  // PORT-NOTE: In Twenty these come from computeTwentyStandardApplicationAllFlatEntityMaps.
  // In SabNode they are constructed inline with the canonical field values.
  const now = new Date().toISOString();
  const standardApp = await db
    .collection("sabcrm_application")
    .findOne({ workspaceId, isStandard: true });
  const applicationId = (standardApp?._id as string | undefined) ?? "";

  const itemsToCreate: CommandMenuItemDoc[] = missingUniversalIdentifiers.map(
    (universalIdentifier) => ({
      _id: crypto.randomUUID(),
      universalIdentifier,
      applicationId,
      workspaceId,
      label: "Compose Email",
      shortLabel: "Send email",
      icon: "IconMail",
      position: 0,
      isPinned: false,
      availabilityType: "RECORD_SELECTION",
      conditionalAvailabilityExpression: null,
      engineComponentKey: "OPEN_RECORD_EMAIL_THREAD",
      payload: null,
      hotKeys: null,
      createdAt: now,
      updatedAt: now,
    }),
  );

  if (isDryRun) {
    console.log(
      `[DRY RUN] Would create ${itemsToCreate.length} Send Email record-selection commands for workspace ${workspaceId}`,
    );
    return;
  }

  await db.collection("sabcrm_commandMenuItem").insertMany(itemsToCreate);

  console.log(
    `Successfully added ${itemsToCreate.length} Send Email record-selection commands for workspace ${workspaceId}`,
  );
}
