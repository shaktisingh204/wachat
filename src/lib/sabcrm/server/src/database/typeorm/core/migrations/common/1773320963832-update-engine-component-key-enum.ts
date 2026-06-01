// PORT-NOTE: pg-migration->mongo-index/seed
// Original migration: UpdateEngineComponentKeyEnum1773320963832
//
// Postgres DDL intent:
//   - Replaced the `commandMenuItem_enginecomponentkey_enum` Postgres enum with an
//     expanded set containing many new values (navigation, export, view management,
//     workflow operations, search, AI, etc.).
//   - Renamed the old enum to *_old, created the new one, re-typed the column,
//     then dropped the old enum.
//
// MongoDB equivalent:
//   - MongoDB stores enum values as plain strings; no DDL change is needed.
//   - The `sabcrm_commandMenuItem.engineComponentKey` field may now hold any of the
//     values listed in the `EngineComponentKey` type below.
//   - No seed or index migration is required.

import "server-only";

/** Full set of valid engineComponentKey values as of this migration. */
export type EngineComponentKey =
  | "NAVIGATE_TO_NEXT_RECORD"
  | "NAVIGATE_TO_PREVIOUS_RECORD"
  | "CREATE_NEW_RECORD"
  | "DELETE_SINGLE_RECORD"
  | "DELETE_MULTIPLE_RECORDS"
  | "RESTORE_SINGLE_RECORD"
  | "RESTORE_MULTIPLE_RECORDS"
  | "DESTROY_SINGLE_RECORD"
  | "DESTROY_MULTIPLE_RECORDS"
  | "ADD_TO_FAVORITES"
  | "REMOVE_FROM_FAVORITES"
  | "EXPORT_NOTE_TO_PDF"
  | "EXPORT_FROM_RECORD_INDEX"
  | "EXPORT_FROM_RECORD_SHOW"
  | "UPDATE_MULTIPLE_RECORDS"
  | "MERGE_MULTIPLE_RECORDS"
  | "EXPORT_MULTIPLE_RECORDS"
  | "IMPORT_RECORDS"
  | "EXPORT_VIEW"
  | "SEE_DELETED_RECORDS"
  | "CREATE_NEW_VIEW"
  | "HIDE_DELETED_RECORDS"
  | "GO_TO_PEOPLE"
  | "GO_TO_COMPANIES"
  | "GO_TO_DASHBOARDS"
  | "GO_TO_OPPORTUNITIES"
  | "GO_TO_SETTINGS"
  | "GO_TO_TASKS"
  | "GO_TO_NOTES"
  | "EDIT_RECORD_PAGE_LAYOUT"
  | "SAVE_RECORD_PAGE_LAYOUT"
  | "CANCEL_RECORD_PAGE_LAYOUT"
  | "EDIT_DASHBOARD_LAYOUT"
  | "SAVE_DASHBOARD_LAYOUT"
  | "CANCEL_DASHBOARD_LAYOUT"
  | "DUPLICATE_DASHBOARD"
  | "GO_TO_WORKFLOWS"
  | "ACTIVATE_WORKFLOW"
  | "DEACTIVATE_WORKFLOW"
  | "DISCARD_DRAFT_WORKFLOW"
  | "TEST_WORKFLOW"
  | "SEE_ACTIVE_VERSION_WORKFLOW"
  | "SEE_RUNS_WORKFLOW"
  | "SEE_VERSIONS_WORKFLOW"
  | "ADD_NODE_WORKFLOW"
  | "TIDY_UP_WORKFLOW"
  | "DUPLICATE_WORKFLOW"
  | "GO_TO_RUNS"
  | "SEE_VERSION_WORKFLOW_RUN"
  | "SEE_WORKFLOW_WORKFLOW_RUN"
  | "STOP_WORKFLOW_RUN"
  | "SEE_RUNS_WORKFLOW_VERSION"
  | "SEE_WORKFLOW_WORKFLOW_VERSION"
  | "USE_AS_DRAFT_WORKFLOW_VERSION"
  | "SEE_VERSIONS_WORKFLOW_VERSION"
  | "SEARCH_RECORDS"
  | "SEARCH_RECORDS_FALLBACK"
  | "ASK_AI"
  | "VIEW_PREVIOUS_AI_CHATS";

export const MIGRATION_NAME = "UpdateEngineComponentKeyEnum1773320963832";

/** No-op: string enum values in MongoDB require no DDL migration. */
export async function up(): Promise<void> {
  // No-op
}

export async function down(): Promise<void> {
  // No-op
}
