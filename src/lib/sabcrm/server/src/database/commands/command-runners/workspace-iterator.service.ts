import 'server-only';

import chalk from 'chalk';
import { type Collection, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { WorkspaceActivationStatus } from '@/lib/sabcrm/shared/src/workspace/types/WorkspaceActivationStatus';

export type WorkspaceIteratorArgs = {
  workspaceIds?: string[];
  activationStatuses?: WorkspaceActivationStatus[];
  startFromWorkspaceId?: string;
  workspaceCountLimit?: number;
  dryRun?: boolean;
  callback: (context: WorkspaceIteratorContext) => Promise<void>;
};

export type WorkspaceIteratorContext = {
  workspaceId: string;
  db?: Db;
  index: number;
  total: number;
};

export type WorkspaceIteratorReport = {
  fail: {
    workspaceId: string;
    error: Error;
  }[];
  success: {
    workspaceId: string;
  }[];
};

const DEFAULT_ACTIVATION_STATUSES = [
  WorkspaceActivationStatus.ACTIVE,
  WorkspaceActivationStatus.SUSPENDED,
];

// Minimal workspace document shape stored in Mongo.
type WorkspaceDoc = {
  _id: string;
  activationStatus: WorkspaceActivationStatus;
};

// PORT-NOTE: GlobalWorkspaceOrmManager / TypeORM are replaced with a direct
// MongoDB collection lookup. The iterator still respects activation status
// filtering and workspace ID restrictions.
export class WorkspaceIteratorService {
  private getWorkspacesCollection(): Promise<Collection<WorkspaceDoc>> {
    return connectToDatabase().then((db) => db.collection<WorkspaceDoc>('sabcrm_workspace'));
  }

  async iterate(args: WorkspaceIteratorArgs): Promise<WorkspaceIteratorReport> {
    const { callback, ...options } = args;

    const report: WorkspaceIteratorReport = { fail: [], success: [] };

    const workspaceIdsToProcess =
      options.workspaceIds && options.workspaceIds.length > 0
        ? options.workspaceIds
        : await this.fetchWorkspaceIds(options);

    if (options.dryRun) {
      console.log(chalk.yellow('Dry run mode: No changes will be applied'));
    }

    const db = await connectToDatabase();

    for (const [index, workspaceId] of workspaceIdsToProcess.entries()) {
      console.log(
        `Running on workspace ${workspaceId} ${index + 1}/${workspaceIdsToProcess.length}`,
      );

      try {
        await callback({ workspaceId, db, index, total: workspaceIdsToProcess.length });
        report.success.push({ workspaceId });
      } catch (error: unknown) {
        report.fail.push({ error: error as Error, workspaceId });
      }
    }

    for (const { error, workspaceId } of report.fail) {
      console.error(
        `Error in workspace ${workspaceId}: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }

    return report;
  }

  private async fetchWorkspaceIds(
    options: Pick<
      WorkspaceIteratorArgs,
      'activationStatuses' | 'startFromWorkspaceId' | 'workspaceCountLimit'
    >,
  ): Promise<string[]> {
    const activationStatuses =
      options.activationStatuses ?? DEFAULT_ACTIVATION_STATUSES;

    const collection = await this.getWorkspacesCollection();

    const query: Record<string, unknown> = {
      activationStatus: { $in: activationStatuses },
    };

    if (options.startFromWorkspaceId) {
      query['_id'] = { $gte: options.startFromWorkspaceId };
    }

    const cursor = collection
      .find(query, { projection: { _id: 1 } })
      .sort({ _id: 1 });

    if (options.workspaceCountLimit) {
      cursor.limit(options.workspaceCountLimit);
    }

    const workspaces = await cursor.toArray();
    return workspaces.map((w) => w._id);
  }
}

// Singleton instance for use across server-only modules.
export const workspaceIteratorService = new WorkspaceIteratorService();
