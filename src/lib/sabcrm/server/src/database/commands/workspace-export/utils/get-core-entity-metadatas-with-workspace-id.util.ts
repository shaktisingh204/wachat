// PORT-NOTE: Ported from twenty-server database/commands/workspace-export/utils/get-core-entity-metadatas-with-workspace-id.util.ts
//
// The original filters TypeORM EntityMetadata objects for those that have a
// "workspaceId" column. SabNode uses MongoDB, not TypeORM / Postgres, so we
// represent the equivalent concept as a list of collection-name strings.
//
// A minimal stub is provided that returns the well-known SabCRM core
// collection names that carry a workspaceId field. Callers should treat the
// return value as opaque collection descriptors.

export type CoreEntityDescriptor = {
  tableName: string;
  schema: string;
};

/**
 * Returns the set of SabCRM core Mongo collections that store a workspaceId.
 * Equivalent to the TypeORM variant which filtered DataSource.entityMetadatas.
 */
export const getCoreEntityMetadatasWithWorkspaceId = (): CoreEntityDescriptor[] => {
  // PORT-NOTE: In the original this is derived at runtime from the TypeORM
  // DataSource. In Mongo/SabNode we enumerate the known collections statically.
  // Extend this list as new core collections are ported.
  return [
    { schema: 'core', tableName: 'apiKey' },
    { schema: 'core', tableName: 'approvedAccessDomain' },
    { schema: 'core', tableName: 'billingCustomer' },
    { schema: 'core', tableName: 'billingEntitlement' },
    { schema: 'core', tableName: 'billingSubscription' },
    { schema: 'core', tableName: 'billingSubscriptionItem' },
    { schema: 'core', tableName: 'billingPrice' },
    { schema: 'core', tableName: 'billingProduct' },
    { schema: 'core', tableName: 'billingMeter' },
    { schema: 'core', tableName: 'cronTrigger' },
    { schema: 'core', tableName: 'databaseEventTrigger' },
    { schema: 'core', tableName: 'dataSource' },
    { schema: 'core', tableName: 'featureFlag' },
    { schema: 'core', tableName: 'fieldMetadata' },
    { schema: 'core', tableName: 'fieldPermission' },
    { schema: 'core', tableName: 'indexFieldMetadata' },
    { schema: 'core', tableName: 'indexMetadata' },
    { schema: 'core', tableName: 'keyValuePair' },
    { schema: 'core', tableName: 'objectMetadata' },
    { schema: 'core', tableName: 'objectPermission' },
    { schema: 'core', tableName: 'permissionFlag' },
    { schema: 'core', tableName: 'postgresCredentials' },
    { schema: 'core', tableName: 'remoteServer' },
    { schema: 'core', tableName: 'remoteTable' },
    { schema: 'core', tableName: 'role' },
    { schema: 'core', tableName: 'roleTargets' },
    { schema: 'core', tableName: 'route' },
    { schema: 'core', tableName: 'searchFieldMetadata' },
    { schema: 'core', tableName: 'serverlessFunction' },
    { schema: 'core', tableName: 'userWorkspace' },
    { schema: 'core', tableName: 'view' },
    { schema: 'core', tableName: 'viewField' },
    { schema: 'core', tableName: 'viewFilter' },
    { schema: 'core', tableName: 'viewFilterGroup' },
    { schema: 'core', tableName: 'viewGroup' },
    { schema: 'core', tableName: 'viewSort' },
    { schema: 'core', tableName: 'webhook' },
    { schema: 'core', tableName: 'workspaceMigration' },
    { schema: 'core', tableName: 'workspaceSSOIdentityProvider' },
  ];
};
