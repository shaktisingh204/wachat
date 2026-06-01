import "server-only";

import type {
  FlatDeleteViewGroupAction,
  UniversalDeleteViewGroupAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/view-group/types/workspace-migration-view-group-action.type";
import type {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";
import { transpileUniversalDeleteActionToFlatDeleteAction } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/utils/transpile-universal-delete-action.util";

// PORT-NOTE: NestJS @Injectable + TypeORM repository replaced with plain class + MongoDB collection.
export class DeleteViewGroupActionHandlerService {
  async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteViewGroupAction>,
  ): Promise<FlatDeleteViewGroupAction> {
    return transpileUniversalDeleteActionToFlatDeleteAction(context);
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatDeleteViewGroupAction>,
  ): Promise<void> {
    const { flatAction, workspaceId, db } = context as WorkspaceMigrationActionRunnerContext<FlatDeleteViewGroupAction> & { db: import("mongodb").Db };

    await db
      .collection("sabcrm_view_group")
      .deleteOne({ id: flatAction.entityId, workspaceId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatDeleteViewGroupAction>,
  ): Promise<void> {
    return;
  }
}
