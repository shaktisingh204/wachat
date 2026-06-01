import { type AllMetadataName } from '@/lib/sabcrm/shared/src/metadata/all-metadata-name';

export type MetadataSerializedRelatedMetadataName<T extends AllMetadataName> =
  keyof (typeof ALL_METADATA_SERIALIZED_RELATION)[T];

export const ALL_METADATA_SERIALIZED_RELATION = {
  agent: {},
  skill: {},
  commandMenuItem: {},
  navigationMenuItem: {},
  fieldMetadata: { fieldMetadata: true },
  objectMetadata: {},
  view: {},
  viewField: {},
  viewFieldGroup: {},
  viewFilter: {},
  viewGroup: {},
  index: {},
  logicFunction: {},
  role: {},
  roleTarget: {},
  rolePermissionFlag: {},
  permissionFlag: {},
  objectPermission: {},
  fieldPermission: {},
  pageLayout: {},
  pageLayoutTab: {},
  pageLayoutWidget: {
    fieldMetadata: true,
    view: true,
    viewFieldGroup: true,
    frontComponent: true,
  },
  rowLevelPermissionPredicate: {},
  rowLevelPermissionPredicateGroup: {},
  viewFilterGroup: {},
  viewSort: {},
  frontComponent: {},
  webhook: {},
  applicationVariable: {},
  connectionProvider: {},
} as const satisfies Record<AllMetadataName, Partial<Record<AllMetadataName, true>>>;
