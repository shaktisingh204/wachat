import "server-only";

import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import {
  FlatDeletePageLayoutWidgetAction,
  UniversalDeletePageLayoutWidgetAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/page-layout-widget/types/workspace-migration-page-layout-widget-action.type";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

export class DeletePageLayoutWidgetActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "delete",
  "pageLayoutWidget",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalDeletePageLayoutWidgetAction>,
  ): Promise<FlatDeletePageLayoutWidgetAction> {
    return this.transpileUniversalDeleteActionToFlatDeleteAction(context);
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatDeletePageLayoutWidgetAction>,
  ): Promise<void> {
    const { flatAction, queryRunner } = context;

    void queryRunner; // PORT-NOTE: replaced by direct Mongo call
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_pageLayoutWidget")
      .deleteOne({ id: flatAction.entityId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatDeletePageLayoutWidgetAction>,
  ): Promise<void> {
    return;
  }
}
