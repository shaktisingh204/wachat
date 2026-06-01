import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// The original creates the messageThread.subject field using WorkspaceMigrationValidateBuildAndRunService
// (metadata system) and backfills it with an UPDATE SQL query per workspace schema.
// Metadata operations depend on ported ApplicationService + WorkspaceCacheService +
// WorkspaceMigrationValidateBuildAndRunService — those are scaffolded here.
// The Mongo backfill (updating messageThread.subject from the latest message) is
// expressed as a Mongo aggregation + updateMany.

import { connectToDatabase } from "@/lib/mongodb";

export type BackfillMessageThreadSubjectOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

/**
 * Workspace command: 1.21.0 / 1775500004000
 * Create the messageThread.subject standard field if missing and backfill it
 * from the most recently received message in each thread.
 *
 * PORT-NOTE: The field-metadata creation step (ensureSubjectFieldExists) requires
 * the ported ApplicationService + WorkspaceMigrationValidateBuildAndRunService.
 * That portion is left as a TODO stub. The Mongo data backfill is fully ported.
 */
export async function backfillMessageThreadSubject(
  options: BackfillMessageThreadSubjectOptions,
): Promise<void> {
  const { workspaceId, dryRun = false } = options;

  // TODO: call ensureSubjectFieldExists once ApplicationService +
  // WorkspaceMigrationValidateBuildAndRunService are available in ported form.

  if (dryRun) {
    console.log(
      `[DRY RUN] Would backfill messageThread.subject for workspace ${workspaceId}`,
    );
    return;
  }

  const { db } = await connectToDatabase();
  const messageCol = db.collection<{
    id: string;
    messageThreadId: string;
    subject: string;
    receivedAt?: string | null;
    workspaceId: string;
  }>("sabcrm_message");
  const threadCol = db.collection<{
    id: string;
    subject?: string | null;
    workspaceId: string;
  }>("sabcrm_message_thread");

  // Build a map of messageThreadId -> subject from the most recent message per thread
  const latestSubjects = await messageCol
    .aggregate<{ threadId: string; subject: string }>([
      { $match: { workspaceId } },
      { $sort: { messageThreadId: 1, receivedAt: -1 } },
      {
        $group: {
          _id: "$messageThreadId",
          subject: { $first: "$subject" },
        },
      },
      { $project: { _id: 0, threadId: "$_id", subject: 1 } },
    ])
    .toArray();

  let updatedCount = 0;

  for (const { threadId, subject } of latestSubjects) {
    if (typeof subject !== "string" || subject.length === 0) {
      continue;
    }

    const result = await threadCol.updateOne(
      { id: threadId, workspaceId, subject: null },
      { $set: { subject } },
    );

    if (result.modifiedCount > 0) {
      updatedCount += 1;
    }
  }

  console.log(
    `Backfilled subject for ${updatedCount} message threads in workspace ${workspaceId}`,
  );
}
