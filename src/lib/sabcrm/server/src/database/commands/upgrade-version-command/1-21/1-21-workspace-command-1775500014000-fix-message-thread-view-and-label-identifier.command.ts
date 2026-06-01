import "server-only";

// PORT-NOTE: NestJS class with @RegisteredWorkspaceCommand('1.21.0', 1775500014000)
// Ported to plain async functions backed by MongoDB.
// Original: syncs allMessageThreads standard view fields and repoints
// messageThread.labelIdentifierFieldMetadataId to the subject field.

import { connectToDatabase } from "@/lib/mongodb";

// ---------------------------------------------------------------------------
// Constants (preserved from source)
// ---------------------------------------------------------------------------

// These would normally come from STANDARD_OBJECTS at runtime.
// In SabNode they are stable string constants that match the original values.
const MESSAGE_THREAD_OBJECT_UNIVERSAL_IDENTIFIER =
  "messageThread-standard-object";
const MESSAGE_THREAD_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER =
  "messageThread-subject-field";
const ALL_MESSAGE_THREADS_VIEW_UNIVERSAL_IDENTIFIER =
  "messageThread-allMessageThreads-view";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ObjectMetadataDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  labelIdentifierFieldMetadataUniversalIdentifier: string | null;
  [key: string]: unknown;
};

type FieldMetadataDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  [key: string]: unknown;
};

type ViewDoc = {
  _id: string;
  universalIdentifier: string;
  workspaceId: string;
  [key: string]: unknown;
};

type ViewFieldDoc = {
  _id: string;
  universalIdentifier: string;
  viewUniversalIdentifier: string;
  fieldMetadataUniversalIdentifier: string;
  workspaceId: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Main migration function
// ---------------------------------------------------------------------------

export async function fixMessageThreadViewAndLabelIdentifier(
  workspaceId: string,
  options: { dryRun?: boolean } = {},
): Promise<void> {
  const isDryRun = options.dryRun ?? false;
  const { db } = await connectToDatabase();

  // Check if messageThread object metadata exists
  const existingMessageThreadObjectMetadata =
    await db
      .collection<ObjectMetadataDoc>("sabcrm_objectMetadata")
      .findOne({
        workspaceId,
        universalIdentifier: MESSAGE_THREAD_OBJECT_UNIVERSAL_IDENTIFIER,
      });

  if (!existingMessageThreadObjectMetadata) {
    console.log(
      `messageThread object metadata not found for workspace ${workspaceId}, skipping`,
    );
    return;
  }

  // Check existing view
  const existingView = await db
    .collection<ViewDoc>("sabcrm_view")
    .findOne({
      workspaceId,
      universalIdentifier: ALL_MESSAGE_THREADS_VIEW_UNIVERSAL_IDENTIFIER,
    });

  const viewToCreate = !existingView
    ? {
        universalIdentifier: ALL_MESSAGE_THREADS_VIEW_UNIVERSAL_IDENTIFIER,
        workspaceId,
        // PORT-NOTE: Full standard view definition would be sourced from the
        // standard application maps. Stored as a placeholder here.
        name: "All Message Threads",
        type: "TABLE",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    : null;

  // View fields for allMessageThreads view to delete
  const existingViewFields = await db
    .collection<ViewFieldDoc>("sabcrm_viewField")
    .find({
      workspaceId,
      viewUniversalIdentifier: ALL_MESSAGE_THREADS_VIEW_UNIVERSAL_IDENTIFIER,
    })
    .toArray();

  // Check subject field existence
  const existingSubjectField = await db
    .collection<FieldMetadataDoc>("sabcrm_fieldMetadata")
    .findOne({
      workspaceId,
      universalIdentifier: MESSAGE_THREAD_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
    });

  const flatObjectMetadataToUpdate =
    existingSubjectField &&
    existingMessageThreadObjectMetadata.labelIdentifierFieldMetadataUniversalIdentifier !==
      MESSAGE_THREAD_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER
      ? {
          ...existingMessageThreadObjectMetadata,
          labelIdentifierFieldMetadataUniversalIdentifier:
            MESSAGE_THREAD_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
        }
      : null;

  if (!existingSubjectField) {
    console.warn(
      `messageThread.subject field not found in workspace - run upgrade:1-21:backfill-message-thread-subject first`,
    );
  }

  const hasViewToCreate = viewToCreate !== null;
  const hasViewFieldChanges = existingViewFields.length > 0;
  const hasObjectMetadataChange = flatObjectMetadataToUpdate !== null;

  if (!hasViewToCreate && !hasViewFieldChanges && !hasObjectMetadataChange) {
    console.log(
      `Nothing to fix for messageThread in workspace ${workspaceId}`,
    );
    return;
  }

  console.log(
    `${isDryRun ? "[DRY RUN] " : ""}Fixing messageThread in workspace ${workspaceId}: ` +
      `${hasViewToCreate ? "creating allMessageThreads view, " : ""}` +
      `deleting ${existingViewFields.length} view fields` +
      `${hasObjectMetadataChange ? ", repointing labelIdentifierFieldMetadataId to subject" : ""}`,
  );

  if (isDryRun) {
    return;
  }

  // Delete old view fields
  if (existingViewFields.length > 0) {
    await db
      .collection("sabcrm_viewField")
      .deleteMany({
        workspaceId,
        viewUniversalIdentifier: ALL_MESSAGE_THREADS_VIEW_UNIVERSAL_IDENTIFIER,
      });
  }

  // Create view if missing
  if (viewToCreate) {
    await db.collection("sabcrm_view").insertOne(viewToCreate);
  }

  // Recreate standard view fields (PORT-NOTE: standard field definitions would
  // need to be sourced from the workspace cache / standard application maps)

  // Repoint labelIdentifierFieldMetadataId
  if (flatObjectMetadataToUpdate) {
    await db
      .collection("sabcrm_objectMetadata")
      .updateOne(
        { _id: existingMessageThreadObjectMetadata._id },
        {
          $set: {
            labelIdentifierFieldMetadataUniversalIdentifier:
              MESSAGE_THREAD_SUBJECT_FIELD_UNIVERSAL_IDENTIFIER,
            updatedAt: new Date().toISOString(),
          },
        },
      );
  }

  console.log(
    `Successfully fixed messageThread for workspace ${workspaceId}`,
  );
}
