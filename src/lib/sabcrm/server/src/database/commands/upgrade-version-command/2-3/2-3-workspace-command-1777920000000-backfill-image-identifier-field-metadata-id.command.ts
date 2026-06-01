import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: Workspace command (version 2.3.0, timestamp 1777920000000).
// Backfills imageIdentifierFieldMetadataUniversalIdentifier on workspaceMember
// for workspaces where it was never set.

export const BACKFILL_IMAGE_IDENTIFIER_COMMAND_NAME =
  "upgrade:2-3:backfill-image-identifier-field-metadata-id";

// From STANDARD_OBJECTS.workspaceMember.universalIdentifier
const WORKSPACE_MEMBER_UNIVERSAL_IDENTIFIER =
  "20202020-1c25-4d02-bf25-6aeccf7ea419";

// From STANDARD_OBJECTS.workspaceMember.fields.avatarUrl.universalIdentifier
const AVATAR_URL_FIELD_UNIVERSAL_IDENTIFIER =
  "20202020-1c25-4d02-bf25-6aeccf7ea4aa";

export interface BackfillImageIdentifierOptions {
  dryRun?: boolean;
}

export interface BackfillImageIdentifierResult {
  workspaceId: string;
  updated: boolean;
  skipped: boolean;
}

/**
 * Finds the workspaceMember objectMetadata in the given workspace.
 * If imageIdentifierFieldMetadataUniversalIdentifier is not yet set to the
 * avatarUrl field's universalIdentifier, updates it.
 */
export async function backfillImageIdentifierFieldMetadataId(
  workspaceId: string,
  options: BackfillImageIdentifierOptions = {},
): Promise<BackfillImageIdentifierResult> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  const objectMetadataCollection = db.collection("sabcrm_objectMetadata");
  const fieldMetadataCollection = db.collection("sabcrm_fieldMetadata");

  const existingObject = await objectMetadataCollection.findOne({
    workspaceId,
    universalIdentifier: WORKSPACE_MEMBER_UNIVERSAL_IDENTIFIER,
  });

  if (!existingObject) {
    return { workspaceId, updated: false, skipped: true };
  }

  if (
    existingObject.imageIdentifierFieldMetadataUniversalIdentifier ===
    AVATAR_URL_FIELD_UNIVERSAL_IDENTIFIER
  ) {
    return { workspaceId, updated: false, skipped: true };
  }

  const existingField = await fieldMetadataCollection.findOne({
    workspaceId,
    universalIdentifier: AVATAR_URL_FIELD_UNIVERSAL_IDENTIFIER,
  });

  if (!existingField) {
    return { workspaceId, updated: false, skipped: true };
  }

  if (isDryRun) {
    return { workspaceId, updated: false, skipped: false };
  }

  await objectMetadataCollection.updateOne(
    { _id: existingObject._id },
    {
      $set: {
        imageIdentifierFieldMetadataUniversalIdentifier:
          AVATAR_URL_FIELD_UNIVERSAL_IDENTIFIER,
        updatedAt: new Date().toISOString(),
      },
    },
  );

  return { workspaceId, updated: true, skipped: false };
}
