// PORT-NOTE: In the original source this map holds TypeORM EntityTarget<>
// references (class constructors) used for repository injection. In the Mongo
// port there are no TypeORM entities; we export the collection-name strings
// that each metadata name maps to in MongoDB instead.

import { type AllMetadataName } from '@/lib/sabcrm/shared/src/metadata/all-metadata-name';

export const ALL_METADATA_ENTITY_BY_METADATA_NAME: Record<AllMetadataName, string> = {
  viewField: 'sabcrm_view_fields',
  viewFieldGroup: 'sabcrm_view_field_groups',
  viewFilter: 'sabcrm_view_filters',
  viewGroup: 'sabcrm_view_groups',
  viewFilterGroup: 'sabcrm_view_filter_groups',
  roleTarget: 'sabcrm_role_targets',
  rowLevelPermissionPredicate: 'sabcrm_row_level_permission_predicates',
  pageLayoutWidget: 'sabcrm_page_layout_widgets',
  rowLevelPermissionPredicateGroup: 'sabcrm_row_level_permission_predicate_groups',
  view: 'sabcrm_views',
  index: 'sabcrm_index_metadatas',
  pageLayoutTab: 'sabcrm_page_layout_tabs',
  frontComponent: 'sabcrm_front_components',
  fieldMetadata: 'sabcrm_field_metadatas',
  pageLayout: 'sabcrm_page_layouts',
  skill: 'sabcrm_skills',
  logicFunction: 'sabcrm_logic_functions',
  objectMetadata: 'sabcrm_object_metadatas',
  objectPermission: 'sabcrm_object_permissions',
  fieldPermission: 'sabcrm_field_permissions',
  role: 'sabcrm_roles',
  agent: 'sabcrm_agents',
  commandMenuItem: 'sabcrm_command_menu_items',
  navigationMenuItem: 'sabcrm_navigation_menu_items',
  rolePermissionFlag: 'sabcrm_role_permission_flags',
  permissionFlag: 'sabcrm_permission_flags',
  webhook: 'sabcrm_webhooks',
  applicationVariable: 'sabcrm_application_variables',
  viewSort: 'sabcrm_view_sorts',
  connectionProvider: 'sabcrm_connection_providers',
} as const;
