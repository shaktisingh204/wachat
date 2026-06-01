// PORT-NOTE: Ported from Twenty twenty-server. TypeORM Relation<> and
// SyncableEntity constraints are replaced with plain TypeScript structural
// types. The runtime constant value is identical to the original source.

export const ALL_MANY_TO_ONE_METADATA_FOREIGN_KEY = {
  agent: {
    workspace: null,
    application: null,
  },
  skill: {
    workspace: null,
    application: null,
  },
  commandMenuItem: {
    workspace: null,
    application: null,
    availabilityObjectMetadata: { foreignKey: 'availabilityObjectMetadataId' },
    frontComponent: { foreignKey: 'frontComponentId' },
    pageLayout: { foreignKey: 'pageLayoutId' },
  },
  navigationMenuItem: {
    workspace: null,
    userWorkspace: null,
    application: null,
    targetObjectMetadata: { foreignKey: 'targetObjectMetadataId' },
    folder: { foreignKey: 'folderId' },
    view: { foreignKey: 'viewId' },
    pageLayout: { foreignKey: 'pageLayoutId' },
  },
  fieldMetadata: {
    object: { foreignKey: 'objectMetadataId' },
    workspace: null,
    application: null,
    relationTargetFieldMetadata: { foreignKey: 'relationTargetFieldMetadataId' },
    relationTargetObjectMetadata: { foreignKey: 'relationTargetObjectMetadataId' },
  },
  objectMetadata: {
    workspace: null,
    application: null,
  },
  view: {
    objectMetadata: { foreignKey: 'objectMetadataId' },
    workspace: null,
    createdBy: null,
    application: null,
    calendarFieldMetadata: { foreignKey: 'calendarFieldMetadataId' },
    kanbanAggregateOperationFieldMetadata: { foreignKey: 'kanbanAggregateOperationFieldMetadataId' },
    mainGroupByFieldMetadata: { foreignKey: 'mainGroupByFieldMetadataId' },
  },
  viewField: {
    fieldMetadata: { foreignKey: 'fieldMetadataId' },
    view: { foreignKey: 'viewId' },
    viewFieldGroup: { foreignKey: 'viewFieldGroupId' },
    workspace: null,
    application: null,
  },
  viewFieldGroup: {
    view: { foreignKey: 'viewId' },
    workspace: null,
    application: null,
  },
  viewFilter: {
    fieldMetadata: { foreignKey: 'fieldMetadataId' },
    view: { foreignKey: 'viewId' },
    relationTargetFieldMetadata: { foreignKey: 'relationTargetFieldMetadataId' },
    viewFilterGroup: { foreignKey: 'viewFilterGroupId' },
    workspace: null,
    application: null,
  },
  viewGroup: {
    view: { foreignKey: 'viewId' },
    workspace: null,
    application: null,
  },
  index: {
    objectMetadata: { foreignKey: 'objectMetadataId' },
    workspace: null,
    application: null,
  },
  logicFunction: {
    workspace: null,
    application: null,
  },
  role: {
    workspace: null,
    application: null,
  },
  roleTarget: {
    role: { foreignKey: 'roleId' },
    apiKey: null,
    workspace: null,
    application: null,
  },
  rolePermissionFlag: {
    workspace: null,
    application: null,
    role: { foreignKey: 'roleId' },
    permissionFlag: { foreignKey: 'permissionFlagId' },
  },
  permissionFlag: {
    workspace: null,
    application: null,
  },
  objectPermission: {
    workspace: null,
    application: null,
    role: { foreignKey: 'roleId' },
    objectMetadata: { foreignKey: 'objectMetadataId' },
  },
  fieldPermission: {
    workspace: null,
    application: null,
    role: { foreignKey: 'roleId' },
    objectMetadata: { foreignKey: 'objectMetadataId' },
    fieldMetadata: { foreignKey: 'fieldMetadataId' },
  },
  pageLayout: {
    workspace: null,
    objectMetadata: { foreignKey: 'objectMetadataId' },
    application: null,
    defaultTabToFocusOnMobileAndSidePanel: { foreignKey: 'defaultTabToFocusOnMobileAndSidePanelId' },
  },
  pageLayoutTab: {
    workspace: null,
    pageLayout: { foreignKey: 'pageLayoutId' },
    application: null,
  },
  pageLayoutWidget: {
    workspace: null,
    pageLayoutTab: { foreignKey: 'pageLayoutTabId' },
    objectMetadata: { foreignKey: 'objectMetadataId' },
    application: null,
  },
  rowLevelPermissionPredicate: {
    workspace: null,
    role: { foreignKey: 'roleId' },
    fieldMetadata: { foreignKey: 'fieldMetadataId' },
    workspaceMemberFieldMetadata: { foreignKey: 'workspaceMemberFieldMetadataId' },
    objectMetadata: { foreignKey: 'objectMetadataId' },
    rowLevelPermissionPredicateGroup: { foreignKey: 'rowLevelPermissionPredicateGroupId' },
    application: null,
  },
  rowLevelPermissionPredicateGroup: {
    objectMetadata: { foreignKey: 'objectMetadataId' },
    role: { foreignKey: 'roleId' },
    parentRowLevelPermissionPredicateGroup: { foreignKey: 'parentRowLevelPermissionPredicateGroupId' },
    workspace: null,
    application: null,
  },
  viewFilterGroup: {
    application: null,
    parentViewFilterGroup: { foreignKey: 'parentViewFilterGroupId' },
    view: { foreignKey: 'viewId' },
    workspace: null,
  },
  frontComponent: {
    workspace: null,
    application: null,
  },
  webhook: {
    workspace: null,
    application: null,
  },
  applicationVariable: {
    workspace: null,
    application: null,
  },
  viewSort: {
    application: null,
    workspace: null,
    fieldMetadata: { foreignKey: 'fieldMetadataId' },
    view: { foreignKey: 'viewId' },
  },
  connectionProvider: {
    workspace: null,
    application: null,
  },
} as const;
