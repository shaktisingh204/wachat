import 'server-only';

import chalk from 'chalk';

import {
  type WorkspaceIteratorService,
} from '@/lib/sabcrm/server/src/database/commands/command-runners/workspace-iterator.service';
import { CommandLogger } from '@/lib/sabcrm/server/src/database/commands/logger';
import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

// PORT-NOTE: ApplicationService and WorkspaceCacheService must be ported
// separately. Structural types are used here to keep this file self-contained.

type FlatApplication = {
  id: string;
  name: string;
  universalIdentifier: string;
  deletedAt?: Date | null;
};

type ApplicationService = {
  uploadDefaultPackageFilesAndSetFileIds: (args: {
    id: string;
    universalIdentifier: string;
    workspaceId: string;
  }) => Promise<void>;
};

type WorkspaceCacheService = {
  getOrRecompute: (
    workspaceId: string,
    keys: string[],
  ) => Promise<{ flatApplicationMaps: { byId: Record<string, FlatApplication | undefined> } }>;
};

export type RebuildDefaultPackageFilesCommandOptions = {
  workspaceId?: Set<string>;
};

/**
 * Re-uploads default package.json and yarn.lock to file storage for all
 * applications in every workspace.
 *
 * PORT-NOTE: nest-commander @Command removed. Call `run(options)` directly.
 */
export class RebuildApplicationDefaultDepsCommand {
  protected logger: CommandLogger;

  constructor(
    private readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    this.logger = new CommandLogger({
      verbose: false,
      constructorName: this.constructor.name,
    });
  }

  async run(options: RebuildDefaultPackageFilesCommandOptions = {}): Promise<void> {
    const workspaceIds = isDefined(options.workspaceId)
      ? Array.from(options.workspaceId)
      : undefined;

    const report = await this.workspaceIteratorService.iterate({
      workspaceIds,
      callback: async ({ workspaceId }) => {
        const { flatApplicationMaps } =
          await this.workspaceCacheService.getOrRecompute(workspaceId, [
            'flatApplicationMaps',
          ]);

        const applications = Object.values(flatApplicationMaps.byId).filter(
          (application): application is FlatApplication =>
            isDefined(application) && !isDefined(application.deletedAt),
        );

        this.logger.log(
          `Found ${applications.length} application(s) in workspace ${workspaceId}`,
        );

        for (const application of applications) {
          await this.applicationService.uploadDefaultPackageFilesAndSetFileIds({
            id: application.id,
            universalIdentifier: application.universalIdentifier,
            workspaceId,
          });
          this.logger.log(
            `Rebuilt default package files for application "${application.name}" (${application.id})`,
          );
        }
      },
    });

    if (report.fail.length > 0) {
      throw new Error(
        `Command completed with ${report.fail.length} failure(s)`,
      );
    }

    this.logger.log(chalk.blue('Command completed!'));
  }
}
