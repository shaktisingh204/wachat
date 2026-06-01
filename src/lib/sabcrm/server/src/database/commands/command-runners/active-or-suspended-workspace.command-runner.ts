import { WorkspaceActivationStatus } from '@/lib/sabcrm/shared/src/workspace/types/WorkspaceActivationStatus';

import {
  type WorkspaceCommandOptions,
  WorkspaceCommandRunner,
} from '@/lib/sabcrm/server/src/database/commands/command-runners/workspace.command-runner';
import { type WorkspaceIteratorService } from '@/lib/sabcrm/server/src/database/commands/command-runners/workspace-iterator.service';

export type ActiveOrSuspendedWorkspaceCommandOptions = WorkspaceCommandOptions;

/**
 * Abstract base for command runners that target active or suspended workspaces.
 * Subclass and implement `runOnWorkspace`.
 */
export abstract class ActiveOrSuspendedWorkspaceCommandRunner<
  Options extends ActiveOrSuspendedWorkspaceCommandOptions =
    ActiveOrSuspendedWorkspaceCommandOptions,
> extends WorkspaceCommandRunner<Options> {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
  ) {
    super(workspaceIteratorService, [
      WorkspaceActivationStatus.ACTIVE,
      WorkspaceActivationStatus.SUSPENDED,
    ]);
  }
}
