import "server-only";

import type {
  FlatDeleteViewAction,
  UniversalDeleteViewAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view/types/workspace-migration-view-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/transpile-universal-delete-action.util";

// PORT-NOTE: NestJS @Injectable + TypeORM ViewEntity repository replaced with plain class + MongoDB collection sabcrm_view.
export class DeleteViewActionHandlerService {
  async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteViewAction>,
  ): Promise<FlatDeleteViewAction> {
    return transpileUniversalDeleteActionToFlatDeleteAction(context);
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatDeleteViewAction>,
  ): Promise<void> {
    const { flatAction, workspaceId, db } = context as WorkspaceMigrationActionRunnerContext<FlatDeleteViewAction> & { db: import("mongodb").Db };

    await db
      .collection("sabcrm_view")
      .deleteOne({ id: flatAction.entityId, workspaceId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatDeleteViewAction>,
  ): Promise<void> {
    return;
  }
}
