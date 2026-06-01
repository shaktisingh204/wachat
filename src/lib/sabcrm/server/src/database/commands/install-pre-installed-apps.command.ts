import 'server-only';

import {
  type ActiveOrSuspendedWorkspaceCommandOptions,
  ActiveOrSuspendedWorkspaceCommandRunner,
} from '@/lib/sabcrm/server/src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { type WorkspaceIteratorService } from '@/lib/sabcrm/server/src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from '@/lib/sabcrm/server/src/database/commands/command-runners/workspace.command-runner';

// PORT-NOTE: PreInstalledAppsService must be ported separately. A minimal
// structural type is defined here so this file compiles in isolation.
type PreInstalledAppsService = {
  installOnWorkspace: (workspaceId: string) => Promise<void>;
};

/**
 * Installs every application registration flagged `isPreInstalled` on every
 * active and suspended workspace. Idempotent.
 *
 * PORT-NOTE: nest-commander @Command decorator removed. Call
 * `command.run([], options)` directly from a script or server action.
 */
export class InstallPreInstalledAppsCommand extends ActiveOrSuspendedWorkspaceCommandRunner<ActiveOrSuspendedWorkspaceCommandOptions> {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly preInstalledAppsService: PreInstalledAppsService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
    index,
    total,
  }: RunOnWorkspaceArgs): Promise<void> {
    const dryRun = options.dryRun ?? false;

    this.logger.log(
      `${dryRun ? '[DRY RUN] ' : ''}Installing pre-installed apps on workspace ${workspaceId} (${index + 1}/${total})`,
    );

    if (dryRun) {
      return;
    }

    await this.preInstalledAppsService.installOnWorkspace(workspaceId);
  }
}
