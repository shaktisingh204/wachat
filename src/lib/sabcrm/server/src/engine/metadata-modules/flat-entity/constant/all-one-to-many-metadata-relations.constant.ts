// PORT-NOTE: Ported from Twenty twenty-server. TypeORM Relation<> and
// SyncableEntity constraints removed. Runtime value is identical to original.

export const ALL_ONE_TO_MANY_METADATA_RELATIONS = {
  agent: {},
  skill: {},
  commandMenuItem: {},
  navigationMenuItem: {},
  fieldMetadata: {
    viewSorts: {
      flatEntityForeignKeyAggregator: 'viewSortIds',
      metadataName: 'viewSort',
      universalFlatEntityForeignKeyAggregator: 'viewSortUniversalIdentifiers',
    },
    fieldPermissions: {
      metadataName: 'fieldPermission',
      flatEntityForeignKeyAggregator: 'fieldPermissionIds',
      universalFlatEntityForeignKeyAggregator: 'fieldPermissionUniversalIdentifiers',
    },
    indexFieldMetadatas: null,
    viewFields: {
      metadataName: 'viewField',
      flatEntityForeignKeyAggregator: 'viewFieldIds',
      universalFlatEntityForeignKeyAggregator: 'viewFieldUniversalIdentifiers',
    },
    viewFilters: {
      metadataName: 'viewFilter',
      flatEntityForeignKeyAggregator: 'viewFilterIds',
      universalFlatEntityForeignKeyAggregator: 'viewFilterUniversalIdentifiers',
    },
    kanbanAggregateOperationViews: {
      metadataName: 'view',
      flatEntityForeignKeyAggregator: 'kanbanAggregateOperationViewIds',
      universalFlatEntityForeignKeyAggregator: 'kanbanAggregateOperationViewUniversalIdentifiers',
    },
    calendarViews: {
      metadataName: 'view',
      flatEntityForeignKeyAggregator: 'calendarViewIds',
      universalFlatEntityForeignKeyAggregator: 'calendarViewUniversalIdentifiers',
    },
    mainGroupByFieldMetadataViews: {
      metadataName: 'view',
      flatEntityForeignKeyAggregator: 'mainGroupByFieldMetadataViewIds',
      universalFlatEntityForeignKeyAggregator: 'mainGroupByFieldMetadataViewUniversalIdentifiers',
    },
  },
  objectMetadata: {
    fields: {
      metadataName: 'fieldMetadata',
      flatEntityForeignKeyAggregator: 'fieldIds',
      universalFlatEntityForeignKeyAggregator: 'fieldUniversalIdentifiers',
    },
    indexMetadatas: {
      metadataName: 'index',
      flatEntityForeignKeyAggregator: 'indexMetadataIds',
      universalFlatEntityForeignKeyAggregator: 'indexMetadataUniversalIdentifiers',
    },
    objectPermissions: {
      metadataName: 'objectPermission',
      flatEntityForeignKeyAggregator: 'objectPermissionIds',
      universalFlatEntityForeignKeyAggregator: 'objectPermissionUniversalIdentifiers',
    },
    fieldPermissions: {
      metadataName: 'fieldPermission',
      flatEntityForeignKeyAggregator: 'fieldPermissionIds',
      universalFlatEntityForeignKeyAggregator: 'fieldPermissionUniversalIdentifiers',
    },
    views: {
      metadataName: 'view',
      flatEntityForeignKeyAggregator: 'viewIds',
      universalFlatEntityForeignKeyAggregator: 'viewUniversalIdentifiers',
    },
  },
  view: {
    viewFields: {
      metadataName: 'viewField',
      flatEntityForeignKeyAggregator: 'viewFieldIds',
      universalFlatEntityForeignKeyAggregator: 'viewFieldUniversalIdentifiers',
    },
    viewFilters: {
      metadataName: 'viewFilter',
      flatEntityForeignKeyAggregator: 'viewFilterIds',
      universalFlatEntityForeignKeyAggregator: 'viewFilterUniversalIdentifiers',
    },
    viewFilterGroups: {
      metadataName: 'viewFilterGroup',
      flatEntityForeignKeyAggregator: 'viewFilterGroupIds',
      universalFlatEntityForeignKeyAggregator: 'viewFilterGroupUniversalIdentifiers',
    },
    viewGroups: {
      metadataName: 'viewGroup',
      flatEntityForeignKeyAggregator: 'viewGroupIds',
      universalFlatEntityForeignKeyAggregator: 'viewGroupUniversalIdentifiers',
    },
    viewFieldGroups: {
      metadataName: 'viewFieldGroup',
      flatEntityForeignKeyAggregator: 'viewFieldGroupIds',
      universalFlatEntityForeignKeyAggregator: 'viewFieldGroupUniversalIdentifiers',
    },
    viewSorts: {
      metadataName: 'viewSort',
      flatEntityForeignKeyAggregator: 'viewSortIds',
      universalFlatEntityForeignKeyAggregator: 'viewSortUniversalIdentifiers',
    },
  },
  viewField: {},
  viewFieldGroup: {
    viewFields: {
      metadataName: 'viewField',
      flatEntityForeignKeyAggregator: 'viewFieldIds',
      universalFlatEntityForeignKeyAggregator: 'viewFieldUniversalIdentifiers',
    },
  },
  viewFilter: {},
  viewGroup: {},
  index: { indexFieldMetadatas: null },
  logicFunction: {},
  role: {
    roleTargets: {
      metadataName: 'roleTarget',
      flatEntityForeignKeyAggregator: 'roleTargetIds',
      universalFlatEntityForeignKeyAggregator: 'roleTargetUniversalIdentifiers',
    },
    objectPermissions: {
      metadataName: 'objectPermission',
      flatEntityForeignKeyAggregator: 'objectPermissionIds',
      universalFlatEntityForeignKeyAggregator: 'objectPermissionUniversalIdentifiers',
    },
    rolePermissionFlags: {
      metadataName: 'rolePermissionFlag',
      flatEntityForeignKeyAggregator: 'rolePermissionFlagIds',
      universalFlatEntityForeignKeyAggregator: 'rolePermissionFlagUniversalIdentifiers',
    },
    fieldPermissions: {
      metadataName: 'fieldPermission',
      flatEntityForeignKeyAggregator: 'fieldPermissionIds',
      universalFlatEntityForeignKeyAggregator: 'fieldPermissionUniversalIdentifiers',
    },
    rowLevelPermissionPredicates: {
      metadataName: 'rowLevelPermissionPredicate',
      flatEntityForeignKeyAggregator: 'rowLevelPermissionPredicateIds',
      universalFlatEntityForeignKeyAggregator: 'rowLevelPermissionPredicateUniversalIdentifiers',
    },
    rowLevelPermissionPredicateGroups: {
      metadataName: 'rowLevelPermissionPredicateGroup',
      flatEntityForeignKeyAggregator: 'rowLevelPermissionPredicateGroupIds',
      universalFlatEntityForeignKeyAggregator: 'rowLevelPermissionPredicateGroupUniversalIdentifiers',
    },
  },
  roleTarget: {},
  rolePermissionFlag: {},
  permissionFlag: {
    rolePermissionFlags: {
      metadataName: 'rolePermissionFlag',
      flatEntityForeignKeyAggregator: 'rolePermissionFlagIds',
      universalFlatEntityForeignKeyAggregator: 'rolePermissionFlagUniversalIdentifiers',
    },
  },
  objectPermission: {},
  fieldPermission: {},
  pageLayout: {
    tabs: {
      metadataName: 'pageLayoutTab',
      flatEntityForeignKeyAggregator: 'tabIds',
      universalFlatEntityForeignKeyAggregator: 'tabUniversalIdentifiers',
    },
  },
  pageLayoutTab: {
    widgets: {
      metadataName: 'pageLayoutWidget',
      flatEntityForeignKeyAggregator: 'widgetIds',
      universalFlatEntityForeignKeyAggregator: 'widgetUniversalIdentifiers',
    },
  },
  pageLayoutWidget: {},
  rowLevelPermissionPredicate: {},
  rowLevelPermissionPredicateGroup: {
    childRowLevelPermissionPredicateGroups: {
      metadataName: 'rowLevelPermissionPredicateGroup',
      flatEntityForeignKeyAggregator: 'childRowLevelPermissionPredicateGroupIds',
      universalFlatEntityForeignKeyAggregator: 'childRowLevelPermissionPredicateGroupUniversalIdentifiers',
    },
    rowLevelPermissionPredicates: {
      metadataName: 'rowLevelPermissionPredicate',
      flatEntityForeignKeyAggregator: 'rowLevelPermissionPredicateIds',
      universalFlatEntityForeignKeyAggregator: 'rowLevelPermissionPredicateUniversalIdentifiers',
    },
  },
  viewFilterGroup: {
    childViewFilterGroups: {
      metadataName: 'viewFilterGroup',
      flatEntityForeignKeyAggregator: 'childViewFilterGroupIds',
      universalFlatEntityForeignKeyAggregator: 'childViewFilterGroupUniversalIdentifiers',
    },
    viewFilters: {
      metadataName: 'viewFilter',
      flatEntityForeignKeyAggregator: 'viewFilterIds',
      universalFlatEntityForeignKeyAggregator: 'viewFilterUniversalIdentifiers',
    },
  },
  frontComponent: {},
  webhook: {},
  applicationVariable: {},
  viewSort: {},
  connectionProvider: {},
} as const;
