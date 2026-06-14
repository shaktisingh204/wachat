/**
 * RecordSurface composites — barrel for the record engine pieces.
 *
 * NOT re-exported from the 20ui root barrel (and these files import 20ui
 * primitives relatively, never via `@/components/sabcrm/20ui`, to avoid the
 * barrel self-cycle).
 */

export {
  RecordGrid,
  type RecordGridProps,
  type RecordGridSort,
  type RecordGridSelection,
} from './record-grid';
export { BulkBar, type BulkBarProps } from './bulk-bar';
export { GridPagination, type GridPaginationProps } from './grid-pagination';
export {
  RecordBoard,
  type RecordBoardProps,
  type RecordBoardColumn,
  type RecordBoardGateVerdict,
  type RecordBoardGateKind,
  type RecordBoardRotting,
} from './board';
export { RecordCell, type RecordCellProps } from './record-cell';
export { getFieldDisplay, getFieldEditor } from './fields';
export {
  ViewBar,
  type ViewBarProps,
  type RecordViewType,
  type ViewSort,
  type ViewDensity,
  type SavedView,
  type SavedViewPatch,
} from './view-bar';
export {
  RecordDetail,
  type RecordDetailProps,
  type RecordDetailHeader,
} from './record-detail';
export { RecordPanel, type RecordPanelProps } from './record-panel';
export {
  RecordQueue,
  type RecordQueueProps,
  type QueueItemState,
} from './record-queue';
export {
  RecordCalendarView,
  type RecordCalendarViewProps,
} from './record-calendar-view';
export {
  RecordMapView,
  type RecordMapViewProps,
} from './record-map-view';
export {
  RecordTimelineView,
  type RecordTimelineViewProps,
} from './record-timeline-view';
export {
  pickDateField,
  pickLocationField,
  type MonthGrid,
  type MonthCell,
  type LocationGroup,
  type TimelineEntry,
} from './record-view-buckets';
export {
  RecordTabs,
  TimelineList,
  type RecordTabsProps,
  type RecordDetailTab,
  type TimelineItem,
  type TimelineItemKind,
  type TimelineListProps,
} from './record-tabs';
export {
  FilterBuilder,
  countConditions,
  pruneFilterGroup,
  opsForField,
  opLabel,
  isUnaryOp,
  filterableFields,
  defaultCondition,
  isFilterGroup,
  EMPTY_FILTER_GROUP,
  type FilterGroup,
  type FilterCondition,
  type FilterNode,
  type FilterOp,
  type FilterConjunction,
} from './filter-builder';
