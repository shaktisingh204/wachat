// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration AddFrontComponentIdToCommandMenuItem1769654418252
//
// What this migration did in Postgres (core schema):
//   UP:
//     - ALTER TABLE core."commandMenuItem" ADD "frontComponentId" uuid (nullable)
//     - DROP old INDEX IDX_COMMAND_MENU_ITEM_WORKFLOW_VERSION_ID_WORKSPACE_ID
//     - ALTER TABLE core."commandMenuItem" ALTER COLUMN "workflowVersionId" DROP NOT NULL
//     - CREATE INDEX IDX_COMMAND_MENU_ITEM_FRONT_COMPONENT_ID_WORKSPACE_ID
//         ON commandMenuItem (frontComponentId, workspaceId)
//     - CREATE INDEX IDX_COMMAND_MENU_ITEM_WORKFLOW_VERSION_ID_WORKSPACE_ID
//         ON commandMenuItem (workflowVersionId, workspaceId)
//     - ADD CHECK: (workflowVersionId IS NOT NULL AND frontComponentId IS NULL)
//               OR (workflowVersionId IS NULL  AND frontComponentId IS NOT NULL)
//     - FK: commandMenuItem.frontComponentId -> frontComponent.id ON DELETE CASCADE
//   DOWN: Reverts all of the above.
//
// Mongo equivalent:
//   The sabcrm_commandMenuItem document type gains:
//     frontComponentId?: string  (optional, mutually exclusive with workflowVersionId)
//     workflowVersionId: string  (now optional too)
//   The XOR constraint (exactly one of workflowVersionId / frontComponentId) is enforced
//   in application-layer validation (e.g., Zod refine).
//   New index to add: (frontComponentId, workspaceId).
//   The workflowVersionId index should remain.

export const MIGRATION_NAME = 'AddFrontComponentIdToCommandMenuItem1769654418252';

export const MONGO_INDEXES = [
  {
    collection: 'sabcrm_commandMenuItem',
    index: { frontComponentId: 1, workspaceId: 1 },
    options: {},
  },
  {
    collection: 'sabcrm_commandMenuItem',
    index: { workflowVersionId: 1, workspaceId: 1 },
    options: {},
  },
] as const;
