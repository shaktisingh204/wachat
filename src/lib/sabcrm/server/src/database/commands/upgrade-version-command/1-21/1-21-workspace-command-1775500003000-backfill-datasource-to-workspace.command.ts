import "server-only";

// PORT-NOTE: NestJS @Command -> exported async function.
// TypeORM WorkspaceEntity + DataSourceEntity Repositories -> Mongo collections.

import { connectToDatabase } from "@/lib/mongodb";

export type BackfillDatasourceToWorkspaceOptions = {
  workspaceId: string;
  dryRun?: boolean;
};

/**
 * Workspace command: 1.21.0 / 1775500003000
 * Backfill workspace.databaseSchema from the dataSource entity for workspaces
 * that have not been migrated yet.
 */
export async function backfillDatasourceToWorkspace(
  options: BackfillDatasourceToWorkspaceOptions,
): Promise<void> {
  const { workspaceId, dryRun = false } = options;

  const { db } = await connectToDatabase();
  const workspacesCol = db.collection<{
    id: string;
    databaseSchema?: string | null;
  }>("sabcrm_workspace");
  const dataSourcesCol = db.collection<{
    id: string;
    workspaceId: string;
    schema: string;
    createdAt: string;
  }>("sabcrm_data_source");

  const workspace = await workspacesCol.findOne(
    { id: workspaceId },
    { projection: { id: 1, databaseSchema: 1 } },
  );

  if (workspace == null) {
    console.warn(`Workspace ${workspaceId} not found, skipping`);
    return;
  }

  if (
    typeof workspace.databaseSchema === "string" &&
    workspace.databaseSchema.length > 0
  ) {
    console.log(
      `Workspace ${workspaceId} already has databaseSchema="${workspace.databaseSchema}", skipping`,
    );
    return;
  }

  const dataSource = await dataSourcesCol.findOne(
    { workspaceId },
    { sort: { createdAt: -1 } },
  );

  if (dataSource == null) {
    throw new Error(
      `No dataSource row found for workspace ${workspaceId}. Cannot backfill databaseSchema.`,
    );
  }

  if (typeof dataSource.schema !== "string" || dataSource.schema.length === 0) {
    throw new Error(
      `DataSource for workspace ${workspaceId} has an empty schema. Cannot backfill databaseSchema.`,
    );
  }

  if (dryRun) {
    console.log(
      `[DRY RUN] Would set workspace ${workspaceId} databaseSchema to "${dataSource.schema}"`,
    );
    return;
  }

  await workspacesCol.updateOne(
    { id: workspaceId },
    { $set: { databaseSchema: dataSource.schema } },
  );

  console.log(
    `Backfilled workspace ${workspaceId} databaseSchema to "${dataSource.schema}"`,
  );
}
