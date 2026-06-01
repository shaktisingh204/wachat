import "server-only";

// PORT-NOTE: Ported from NestJS Injectable + DiscoveryService pattern.
// NestJS DI/DiscoveryService removed. Handlers are registered manually via
// registerActionHandler(). No module auto-discovery in Next.js.
// All method signatures and logic preserved faithfully.

import {
  BaseWorkspaceMigrationRunnerActionHandlerService,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface';
import {
  buildActionHandlerKey,
  type AllUniversalWorkspaceMigrationAction,
  type WorkspaceMigrationActionHandlerKey,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/types/workspace-migration-action-common';
import {
  WorkspaceMigrationActionExecutionException,
  WorkspaceMigrationActionExecutionExceptionCode,
} from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/exceptions/workspace-migration-action-execution.exception';
import { type WorkspaceMigrationActionRunnerArgs } from '@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type';

export class WorkspaceMigrationRunnerActionHandlerRegistryService {
  private readonly actionHandlers = new Map<
    WorkspaceMigrationActionHandlerKey,
    InstanceType<typeof BaseWorkspaceMigrationRunnerActionHandlerService>
  >();

  // Manual registration replacing NestJS DiscoveryService
  registerActionHandler(
    handler: InstanceType<typeof BaseWorkspaceMigrationRunnerActionHandlerService>,
  ): void {
    const key = buildActionHandlerKey(handler.actionType, handler.metadataName);

    this.actionHandlers.set(key, handler);
  }

  private getActionHandler<T extends AllUniversalWorkspaceMigrationAction>(
    action: T,
  ) {
    const actionHandlerKey = buildActionHandlerKey(
      action.type,
      action.metadataName,
    );
    const handler = this.actionHandlers.get(actionHandlerKey);

    if (!handler) {
      throw new WorkspaceMigrationActionExecutionException({
        message: `No migration runner action handler found for action: ${actionHandlerKey}`,
        code: WorkspaceMigrationActionExecutionExceptionCode.INVALID_ACTION_TYPE,
      });
    }

    return handler;
  }

  async executeActionHandler<T extends AllUniversalWorkspaceMigrationAction>({
    action,
    context,
  }: {
    action: T;
    context: WorkspaceMigrationActionRunnerArgs<T>;
  }) {
    const handler = this.getActionHandler(action);

    return await handler.execute(context);
  }

  async executeActionRollbackHandler<
    T extends AllUniversalWorkspaceMigrationAction,
  >({
    action,
    context,
  }: {
    action: T;
    context: Omit<WorkspaceMigrationActionRunnerArgs<T>, 'queryRunner'>;
  }) {
    const handler = this.getActionHandler(action);

    await handler.rollback(context);
  }
}

// Singleton instance for the SabNode app
export const workspaceMigrationRunnerActionHandlerRegistry =
  new WorkspaceMigrationRunnerActionHandlerRegistryService();
