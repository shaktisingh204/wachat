import "server-only";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import {
  FlatDeletePageLayoutAction,
  UniversalDeletePageLayoutAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/page-layout/types/workspace-migration-page-layout-action.type";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

export class DeletePageLayoutActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "delete",
  "pageLayout",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalDeletePageLayoutAction>,
  ): Promise<FlatDeletePageLayoutAction> {
    return this.transpileUniversalDeleteActionToFlatDeleteAction(context);
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatDeletePageLayoutAction>,
  ): Promise<void> {
    const { flatAction, queryRunner, workspaceId } = context;

    void queryRunner; // PORT-NOTE: replaced by direct Mongo call
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_pageLayout")
      .deleteOne({ id: flatAction.entityId, workspaceId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatDeletePageLayoutAction>,
  ): Promise<void> {
    return;
  }
}
