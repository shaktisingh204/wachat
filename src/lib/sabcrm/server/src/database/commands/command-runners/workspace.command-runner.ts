import chalk from 'chalk';
import { type Db } from 'mongodb';

import { WorkspaceActivationStatus } from '@/lib/sabcrm/shared/src/workspace/types/WorkspaceActivationStatus';
import {
  type WorkspaceIteratorService,
} from '@/lib/sabcrm/server/src/database/commands/command-runners/workspace-iterator.service';
import { CommandLogger } from '@/lib/sabcrm/server/src/database/commands/logger';

export type WorkspaceCommandOptions = {
  workspaceId?: Set<string>;
  startFromWorkspaceId?: string;
  workspaceCountLimit?: number;
  dryRun?: boolean;
  verbose?: boolean;
};

export type RunOnWorkspaceArgs = {
  options: WorkspaceCommandOptions;
  workspaceId: string;
  db?: Db;
  index: number;
  total: number;
};

/**
 * Abstract base for workspace-scoped command runners.
 * PORT-NOTE: nest-commander's CommandRunner and @Option decorators are removed.
 * Subclass and implement `runOnWorkspace`. Call `run(passedParams, options)`
 * to iterate across workspaces.
 */
export abstract class WorkspaceCommandRunner<
  Options extends WorkspaceCommandOptions = WorkspaceCommandOptions,
> {
  protected logger: CommandLogger;

  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    protected readonly activationStatuses: WorkspaceActivationStatus[],
  ) {
    this.logger = new CommandLogger({
      verbose: false,
      constructorName: this.constructor.name,
    });
  }

  async run(_passedParams: string[], options: Options): Promise<void> {
    if (options.verbose) {
      this.logger = new CommandLogger({
        verbose: true,
        constructorName: this.constructor.name,
      });
    }

    try {
      await this.workspaceIteratorService.iterate({
        workspaceIds:
          options.workspaceId && options.workspaceId.size > 0
            ? Array.from(options.workspaceId)
            : undefined,
        activationStatuses: this.activationStatuses,
        startFromWorkspaceId: options.startFromWorkspaceId,
        workspaceCountLimit: options.workspaceCountLimit,
        dryRun: options.dryRun,
        callback: async (context) => {
          await this.runOnWorkspace({
            options,
            workspaceId: context.workspaceId,
            db: context.db,
            index: context.index,
            total: context.total,
          });
        },
      });

      this.logger.log(chalk.blue('Command completed!'));
    } catch (error) {
      this.logger.error(chalk.red('Command failed'));
      throw error;
    }
  }

  public abstract runOnWorkspace(args: RunOnWorkspaceArgs): Promise<void>;
}
