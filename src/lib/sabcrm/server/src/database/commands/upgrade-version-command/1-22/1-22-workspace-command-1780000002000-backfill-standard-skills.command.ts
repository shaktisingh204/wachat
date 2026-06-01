import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.22.0', 1780000002000)
// Ported to plain async functions backed by MongoDB.
// Original: backfill standard skills for existing workspaces that were created
// before skills were added to the standard application.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SkillDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  name: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function backfillStandardSkills(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  console.log(
    `${isDryRun ? "[DRY RUN] " : ""}Checking standard skills for workspace ${workspaceId}`,
  );

  const standardApp = await db
    .collection("sabcrm_application")
    .findOne({ workspaceId, isStandard: true });
  const applicationId = (standardApp?._id as string | undefined) ?? "";

  // Load the standard skill definitions from the registry collection
  // PORT-NOTE: In Twenty these come from computeTwentyStandardApplicationAllFlatEntityMaps.
  // In SabNode the standard skill catalogue is stored in sabcrm_standardSkill.
  const standardSkills = await db
    .collection<SkillDoc>("sabcrm_standardSkill")
    .find({})
    .toArray();

  if (standardSkills.length === 0) {
    console.log(
      `No standard skills defined; nothing to backfill for workspace ${workspaceId}`,
    );
    return;
  }

  const existingSkills = await db
    .collection<SkillDoc>("sabcrm_skill")
    .find({ workspaceId })
    .toArray();

  const existingUniversalIdentifiers = new Set(
    existingSkills.map((s) => s.universalIdentifier),
  );

  const skillsToCreate = standardSkills.filter(
    (skill) => !existingUniversalIdentifiers.has(skill.universalIdentifier),
  );

  if (skillsToCreate.length === 0) {
    console.log(
      `All standard skills already exist for workspace ${workspaceId}, skipping`,
    );
    return;
  }

  console.log(
    `Found ${skillsToCreate.length} missing standard skill(s) for workspace ${workspaceId}: ${skillsToCreate.map((s) => s.name).join(", ")}`,
  );

  if (isDryRun) {
    console.log(
      `[DRY RUN] Would create ${skillsToCreate.length} standard skill(s) for workspace ${workspaceId}`,
    );
    return;
  }

  const now = new Date().toISOString();
  const docsToInsert = skillsToCreate.map((skill) => ({
    ...skill,
    _id: crypto.randomUUID(),
    workspaceId,
    applicationId,
    createdAt: now,
    updatedAt: now,
  }));

  await db.collection("sabcrm_skill").insertMany(docsToInsert);

  console.log(
    `Successfully created ${docsToInsert.length} standard skill(s) for workspace ${workspaceId}`,
  );
}
