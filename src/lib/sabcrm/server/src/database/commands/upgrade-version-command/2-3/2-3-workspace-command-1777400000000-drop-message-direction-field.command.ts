import "server-only";

import { connectToDatabase } from "@/lib/mongodb";

// PORT-NOTE: Workspace command (version 2.3.0, timestamp 1777400000000).
// Drops the leftover message.direction fieldMetadata and its workspace column.

export const DROP_MESSAGE_DIRECTION_FIELD_COMMAND_NAME =
  "upgrade:2-3:drop-message-direction-field";

const MESSAGE_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER =
  "20202020-0203-4118-8e2a-05b9bdae6dab";

export interface DropMessageDirectionFieldOptions {
  dryRun?: boolean;
}

export interface DropMessageDirectionFieldResult {
  workspaceId: string;
  deleted: boolean;
  skipped: boolean;
}

/**
 * Finds the message.direction fieldMetadata document in the given workspace and
 * deletes it (and triggers the associated workspace migration to drop its column).
 *
 * In SabNode the migration is performed by removing the document from
 * sabcrm_fieldMetadata for the workspace.
 */
export async function dropMessageDirectionField(
  workspaceId: string,
  options: DropMessageDirectionFieldOptions = {},
): Promise<DropMessageDirectionFieldResult> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();
  const collection = db.collection("sabcrm_fieldMetadata");

  const directionFieldMetadata = await collection.findOne({
    workspaceId,
    universalIdentifier: MESSAGE_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  });

  if (!directionFieldMetadata) {
    return { workspaceId, deleted: false, skipped: true };
  }

  if (isDryRun) {
    return { workspaceId, deleted: false, skipped: false };
  }

  await collection.deleteOne({ _id: directionFieldMetadata._id });

  return { workspaceId, deleted: true, skipped: false };
}
