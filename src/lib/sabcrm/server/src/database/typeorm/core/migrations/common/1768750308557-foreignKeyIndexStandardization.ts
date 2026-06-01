// PORT-NOTE: pg-migration->mongo-index/seed
// Original: Twenty TypeORM migration ForeignKeyIndexStandardization1768750308557
//
// What this migration did in Postgres (core schema):
//   UP:
//     - Dropped old partial (WHERE deletedAt IS NULL) indexes on viewFilter, viewFilterGroup,
//       viewGroup, viewSort, viewField.
//     - Created new non-partial indexes (standard FK indexes) on the same columns.
//     - Added new indexes for: roleTarget.roleId, rowLevelPermissionPredicate.workspaceMemberFieldMetadataId,
//       rowLevelPermissionPredicateGroup.parentRowLevelPermissionPredicateGroupId,
//       viewFilterGroup.parentViewFilterGroupId, viewSort.fieldMetadataId,
//       view.createdByUserWorkspaceId, view.mainGroupByFieldMetadataId,
//       view.kanbanAggregateOperationFieldMetadataId, view.calendarFieldMetadataId,
//       viewField.fieldMetadataId, objectMetadata.dataSourceId,
//       cronTrigger.serverlessFunctionId, databaseEventTrigger.serverlessFunctionId,
//       routeTrigger.serverlessFunctionId, serverlessFunction.serverlessFunctionLayerId,
//       pageLayoutWidget.objectMetadataId, commandMenuItem.availabilityObjectMetadataId.
//   DOWN: Reverts to partial indexes for viewFilter/viewFilterGroup/viewGroup/viewSort/viewField,
//         drops all newly created indexes.
//
// Mongo equivalent:
//   These are all simple single-field or compound indexes on FK reference fields.
//   They should be created at collection-init time in the respective schema modules.
//   Listed below for reference — add to the relevant schema index creation calls.

export const MIGRATION_NAME = 'ForeignKeyIndexStandardization1768750308557';

export const MONGO_INDEXES = [
  { collection: 'sabcrm_roleTarget', index: { roleId: 1 } },
  { collection: 'sabcrm_rowLevelPermissionPredicate', index: { workspaceMemberFieldMetadataId: 1 } },
  { collection: 'sabcrm_rowLevelPermissionPredicateGroup', index: { parentRowLevelPermissionPredicateGroupId: 1 } },
  { collection: 'sabcrm_viewFilter', index: { viewId: 1 } },
  { collection: 'sabcrm_viewFilterGroup', index: { parentViewFilterGroupId: 1 } },
  { collection: 'sabcrm_viewFilterGroup', index: { viewId: 1 } },
  { collection: 'sabcrm_viewGroup', index: { viewId: 1 } },
  { collection: 'sabcrm_viewSort', index: { fieldMetadataId: 1 } },
  { collection: 'sabcrm_viewSort', index: { viewId: 1 } },
  { collection: 'sabcrm_view', index: { createdByUserWorkspaceId: 1 } },
  { collection: 'sabcrm_view', index: { mainGroupByFieldMetadataId: 1 } },
  { collection: 'sabcrm_view', index: { kanbanAggregateOperationFieldMetadataId: 1 } },
  { collection: 'sabcrm_view', index: { calendarFieldMetadataId: 1 } },
  { collection: 'sabcrm_viewField', index: { fieldMetadataId: 1 } },
  { collection: 'sabcrm_viewField', index: { viewId: 1 } },
  { collection: 'sabcrm_objectMetadata', index: { dataSourceId: 1 } },
  { collection: 'sabcrm_cronTrigger', index: { serverlessFunctionId: 1 } },
  { collection: 'sabcrm_databaseEventTrigger', index: { serverlessFunctionId: 1 } },
  { collection: 'sabcrm_routeTrigger', index: { serverlessFunctionId: 1 } },
  { collection: 'sabcrm_serverlessFunction', index: { serverlessFunctionLayerId: 1 } },
  { collection: 'sabcrm_pageLayoutWidget', index: { objectMetadataId: 1 } },
  { collection: 'sabcrm_commandMenuItem', index: { availabilityObjectMetadataId: 1 } },
] as const;
