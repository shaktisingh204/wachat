/**
 * SabCRM Views — shared TypeScript types for the Twenty-compatible view model.
 *
 * These types mirror the Twenty GraphQL fragment shapes (ViewFragment,
 * ViewFieldFragment, ViewGroupFragment, ViewFilterFragment,
 * ViewFilterGroupFragment, ViewSortFragment, ViewFieldGroupFragment) so that
 * the ported gql->action-call mutation helpers can reference them.
 *
 * In SabNode, views are stored in dedicated Mongo collections; the id field
 * is always a string (hex ObjectId). Sub-documents reference parent ids by
 * string (viewId, etc.) rather than embedded objects.
 */

// ---------------------------------------------------------------------------
// Sub-document types
// ---------------------------------------------------------------------------

export type ViewField = {
  id: string;
  fieldMetadataId: string;
  viewId: string;
  isVisible: boolean;
  position: number;
  size: number;
  aggregateOperation?: string;
  viewFieldGroupId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type ViewFieldGroup = {
  id: string;
  name: string;
  position: number;
  isVisible: boolean;
  viewId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  viewFields?: ViewField[];
};

export type ViewFilter = {
  id: string;
  fieldMetadataId: string;
  operand: string;
  value: string;
  viewFilterGroupId?: string;
  positionInViewFilterGroup?: number;
  subFieldName?: string;
  relationTargetFieldMetadataId?: string;
  viewId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type ViewFilterGroup = {
  id: string;
  parentViewFilterGroupId?: string;
  logicalOperator: string;
  positionInViewFilterGroup?: number;
  viewId: string;
};

export type ViewSort = {
  id: string;
  fieldMetadataId: string;
  direction: string;
  subFieldName?: string;
  viewId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type ViewGroup = {
  id: string;
  isVisible: boolean;
  fieldValue: string;
  position: number;
  viewId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

// ---------------------------------------------------------------------------
// Top-level View type (mirrors ViewFragment)
// ---------------------------------------------------------------------------

export type View = {
  id: string;
  name: string;
  objectMetadataId: string;
  type: string;
  key?: string;
  icon?: string;
  position: number;
  isCompact: boolean;
  openRecordIn?: string;
  kanbanAggregateOperation?: string;
  kanbanAggregateOperationFieldMetadataId?: string;
  mainGroupByFieldMetadataId?: string;
  shouldHideEmptyGroups?: boolean;
  anyFieldFilterValue?: string;
  calendarFieldMetadataId?: string;
  calendarLayout?: string;
  visibility?: string;
  createdByUserWorkspaceId?: string;
  viewFields: ViewField[];
  viewFieldGroups: ViewFieldGroup[];
  viewFilters: ViewFilter[];
  viewFilterGroups: ViewFilterGroup[];
  viewSorts: ViewSort[];
  viewGroups: ViewGroup[];
};
