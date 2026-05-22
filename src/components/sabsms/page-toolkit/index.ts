/**
 * SabSMS page toolkit — composable primitives that deliver the 30
 * shared features (S1-S30) every `/sabsms/*` page reuses. See
 * `plans/sabsms-pages-catalog.md` §A.
 */

export { useSabsmsUrlState, type UrlStateAPI } from "./use-sabsms-url-state";
export {
  SabsmsPageShell,
  type SabsmsBreadcrumb,
  type SabsmsPageShellProps,
  type SabsmsSecondaryAction,
} from "./SabsmsPageShell";
export {
  SabsmsFilterBar,
  type SabsmsFacet,
  type SabsmsFilterBarProps,
  type SabsmsSortOption,
} from "./sabsms-filter-bar";
export {
  SabsmsDataTable,
  type SabsmsColumn,
  type SabsmsDataTableProps,
  type SabsmsRowAction,
} from "./sabsms-data-table";
export {
  SabsmsBulkActionsBar,
  type SabsmsBulkAction,
  type SabsmsBulkActionsBarProps,
} from "./sabsms-bulk-actions";
export { SabsmsPagination, type SabsmsPaginationProps } from "./sabsms-pagination";
export {
  SabsmsExportMenu,
  rowsToCsv,
  type SabsmsExportMenuProps,
} from "./sabsms-export-menu";
export { SabsmsRefreshButton, type SabsmsRefreshButtonProps } from "./sabsms-refresh-button";
export {
  SabsmsDetailDrawer,
  type SabsmsDetailDrawerProps,
} from "./sabsms-detail-drawer";
export {
  SabsmsKbdHint,
  type SabsmsKbdHintProps,
  type SabsmsShortcut,
} from "./sabsms-kbd-hint";
export {
  SabsmsColumnPicker,
  type SabsmsColumnDef,
  type SabsmsColumnPickerProps,
} from "./sabsms-column-picker";
export {
  SabsmsSavedViews,
  type SabsmsSavedView,
  type SabsmsSavedViewsProps,
} from "./sabsms-saved-views";
export {
  SabsmsEmpty,
  SabsmsErrorState,
  SabsmsTableSkeleton,
  type SabsmsEmptyProps,
  type SabsmsErrorStateProps,
  type SabsmsTableSkeletonProps,
} from "./sabsms-states";
