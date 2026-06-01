import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// Original drops Postgres FK constraints from workspace messaging/calendar tables.
// MongoDB has no FK constraints — this command is a documented no-op for Mongo.

export type DropWorkspaceMessagingFksOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

/**
 * Workspace command: 1.21.0 / 1775500010000
 * Drop FK constraints from workspace messaging/calendar tables that now reference
 * core schema entities.
 *
 * PORT-NOTE: MongoDB has no foreign key constraints, so this command is a no-op
 * in SabNode. The tables/columns that had FKs dropped in Postgres are:
 *   - messageChannelMessageAssociation.messageChannelId
 *   - calendarChannelEventAssociation.calendarChannelId
 *   - messageFolder.messageChannelId
 *   - messageChannelMessageAssociationMessageFolder.messageFolderId
 *
 * If referential integrity is enforced at the application layer, verify that
 * those relationship validations have been removed from the Mongo service layer.
 */
export async function dropWorkspaceMessagingFks(
  options: DropWorkspaceMessagingFksOptions,
): Promise<void> {
  const { workspaceId, dryRun = false } = options;

  if (dryRun) {
    console.log(
      `[DRY RUN] No FK constraints to drop in MongoDB for workspace ${workspaceId} (no-op)`,
    );
    return;
  }

  // PORT-NOTE: MongoDB has no FK constraints. This is intentionally a no-op.
  console.log(
    `dropWorkspaceMessagingFks: no-op for MongoDB (workspace ${workspaceId})`,
  );
}
