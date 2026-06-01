// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: AddEngineComponentKeyToCommandMenuItem1773311456455
//
// Postgres DDL intent (on core.commandMenuItem):
//   - Dropped check constraint CHK_command_menu_item_workflow_or_front_component
//   - Created new enum `commandMenuItem_enginecomponentkey_enum` with values:
//       CREATE_NEW_RECORD | DELETE_SINGLE_RECORD | DELETE_MULTIPLE_RECORDS |
//       RESTORE_SINGLE_RECORD | RESTORE_MULTIPLE_RECORDS | DESTROY_SINGLE_RECORD |
//       DESTROY_MULTIPLE_RECORDS | ADD_TO_FAVORITES | REMOVE_FROM_FAVORITES |
//       MERGE_MULTIPLE_RECORDS | DUPLICATE_DASHBOARD | DUPLICATE_WORKFLOW |
//       ACTIVATE_WORKFLOW | DEACTIVATE_WORKFLOW | DISCARD_DRAFT_WORKFLOW |
//       TEST_WORKFLOW | STOP_WORKFLOW_RUN | USE_AS_DRAFT_WORKFLOW_VERSION |
//       SAVE_RECORD_PAGE_LAYOUT | SAVE_DASHBOARD_LAYOUT | TIDY_UP_WORKFLOW
//   - Added nullable column `engineComponentKey` using that enum
//   - Added new check: exactly one of workflowVersionId / frontComponentId / engineComponentKey is set
//
// MongoDB equivalent:
//   - MongoDB stores enum values as strings; no DDL change needed.
//   - The `sabcrm_commandMenuItem` document type gains:
//       engineComponentKey?: string | null
//   - The mutual-exclusivity check (one of the three fields set) is enforced at the
//     application layer.
//   - No index or seed operation is required.

import "server-only";

/** Valid engineComponentKey values as of this migration. */
export type EngineComponentKey =
  | "CREATE_NEW_RECORD"
  | "DELETE_SINGLE_RECORD"
  | "DELETE_MULTIPLE_RECORDS"
  | "RESTORE_SINGLE_RECORD"
  | "RESTORE_MULTIPLE_RECORDS"
  | "DESTROY_SINGLE_RECORD"
  | "DESTROY_MULTIPLE_RECORDS"
  | "ADD_TO_FAVORITES"
  | "REMOVE_FROM_FAVORITES"
  | "MERGE_MULTIPLE_RECORDS"
  | "DUPLICATE_DASHBOARD"
  | "DUPLICATE_WORKFLOW"
  | "ACTIVATE_WORKFLOW"
  | "DEACTIVATE_WORKFLOW"
  | "DISCARD_DRAFT_WORKFLOW"
  | "TEST_WORKFLOW"
  | "STOP_WORKFLOW_RUN"
  | "USE_AS_DRAFT_WORKFLOW_VERSION"
  | "SAVE_RECORD_PAGE_LAYOUT"
  | "SAVE_DASHBOARD_LAYOUT"
  | "TIDY_UP_WORKFLOW";

export const MIGRATION_NAME =
  "AddEngineComponentKeyToCommandMenuItem1773311456455";

/** No-op: string fields in MongoDB require no migration. */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op
}
