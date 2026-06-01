import "server-only";

import {
  FlatDeleteObjectPermissionAction,
  UniversalDeleteObjectPermissionAction,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-builder/builders/object-permission/types/workspace-migration-object-permission-action.type";
import { WorkspaceMigrationRunnerActionHandler } from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/interfaces/workspace-migration-runner-action-handler-service.interface";
import {
  WorkspaceMigrationActionRunnerArgs,
  WorkspaceMigrationActionRunnerContext,
} from "@/lib/sabcrm/server/src/engine/workspace-manager/workspace-migration/workspace-migration-runner/types/workspace-migration-action-runner-args.type";

export class DeleteObjectPermissionActionHandlerService extends WorkspaceMigrationRunnerActionHandler(
  "delete",
  "objectPermission",
) {
  constructor() {
    super();
  }

  override async transpileUniversalActionToFlatAction(
    context: WorkspaceMigrationActionRunnerArgs<UniversalDeleteObjectPermissionAction>,
  ): Promise<FlatDeleteObjectPermissionAction> {
    return this.transpileUniversalDeleteActionToFlatDeleteAction(context);
  }

  async executeForMetadata(
    context: WorkspaceMigrationActionRunnerContext<FlatDeleteObjectPermissionAction>,
  ): Promise<void> {
    const { flatAction, queryRunner, workspaceId } = context;

    void queryRunner; // PORT-NOTE: replaced by direct Mongo call
    const db = await (await import("@/lib/mongodb")).connectToDatabase();
    await db
      .collection("sabcrm_objectPermission")
      .deleteOne({ id: flatAction.entityId, workspaceId });
  }

  async executeForWorkspaceSchema(
    _context: WorkspaceMigrationActionRunnerContext<FlatDeleteObjectPermissionAction>,
  ): Promise<void> {
    return;
  }
}
