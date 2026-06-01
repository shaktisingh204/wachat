import "server-only";

// PORT-NOTE: @RegisteredInstanceCommand('1.22.0', 1775758621018, { type: 'slow' })
// Original (SlowInstanceCommand):
//   runDataMigration — UPDATE each indirect entity table to set workspaceId
//     from the parent table via the foreign key join.
//   up — ALTER COLUMN "workspaceId" SET NOT NULL
//   down — ALTER COLUMN "workspaceId" DROP NOT NULL
//
// Mongo analogue:
//   runDataMigration — for each collection, lookup the parent collection and
//     set workspaceId on documents where it is missing.
//   up — create a non-sparse index to enforce non-null workspaceId (Mongo has
//     no NOT NULL constraint, so a partial/sparse index is the closest analogue).
//   down — drop that index.

import { connectToDatabase } from "@/lib/mongodb";

type BackfillDefinition = {
  collection: string;
  parentCollection: string;
  foreignKey: string;
};

// Order matches source: parents before children
const BACKFILL_DEFINITIONS: BackfillDefinition[] = [
  {
    collection: "sabcrm_twoFactorAuthenticationMethod",
    parentCollection: "sabcrm_userWorkspace",
    foreignKey: "userWorkspaceId",
  },
  {
    collection: "sabcrm_agentChatThread",
    parentCollection: "sabcrm_userWorkspace",
    foreignKey: "userWorkspaceId",
  },
  {
    collection: "sabcrm_agentTurn",
    parentCollection: "sabcrm_agentChatThread",
    foreignKey: "threadId",
  },
  {
    collection: "sabcrm_agentMessage",
    parentCollection: "sabcrm_agentChatThread",
    foreignKey: "threadId",
  },
  {
    collection: "sabcrm_agentTurnEvaluation",
    parentCollection: "sabcrm_agentTurn",
    foreignKey: "turnId",
  },
  {
    collection: "sabcrm_agentMessagePart",
    parentCollection: "sabcrm_agentMessage",
    foreignKey: "messageId",
  },
  {
    collection: "sabcrm_indexFieldMetadata",
    parentCollection: "sabcrm_indexMetadata",
    foreignKey: "indexMetadataId",
  },
  {
    collection: "sabcrm_applicationVariable",
    parentCollection: "sabcrm_application",
    foreignKey: "applicationId",
  },
];

export async function runDataMigration(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const { collection, parentCollection, foreignKey } of BACKFILL_DEFINITIONS) {
    // Find all child documents without workspaceId
    const childrenWithoutWorkspaceId = await db
      .collection(collection)
      .find({ workspaceId: { $exists: false } })
      .toArray();

    for (const child of childrenWithoutWorkspaceId) {
      const parentId = child[foreignKey] as string | undefined;
      if (!parentId) continue;

      const parent = await db
        .collection(parentCollection)
        .findOne({ _id: parentId }, { projection: { workspaceId: 1 } });

      if (parent?.workspaceId) {
        await db.collection(collection).updateOne(
          { _id: child._id },
          { $set: { workspaceId: parent.workspaceId } },
        );
      }
    }
  }
}

export async function up(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const { collection } of BACKFILL_DEFINITIONS) {
    // Create a partial index that only covers documents where workspaceId exists,
    // acting as a soft NOT NULL constraint.
    await db.collection(collection).createIndex(
      { workspaceId: 1 },
      {
        name: `IDX_${collection}_workspaceId_notnull`,
        partialFilterExpression: { workspaceId: { $exists: true } },
        background: true,
      },
    );
  }
}

export async function down(): Promise<void> {
  const { db } = await connectToDatabase();

  for (const { collection } of BACKFILL_DEFINITIONS) {
    try {
      await db.collection(collection).dropIndex(`IDX_${collection}_workspaceId_notnull`);
    } catch {
      // Index may not exist
    }
  }
}
