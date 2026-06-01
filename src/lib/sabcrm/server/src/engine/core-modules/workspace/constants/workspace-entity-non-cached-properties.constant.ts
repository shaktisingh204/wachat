// PORT-NOTE: Ported from Twenty's WORKSPACE_ENTITY_NON_CACHED_PROPERTIES constant.
// WorkspaceEntity type reference replaced with a structural string-literal array.

export const WORKSPACE_ENTITY_NON_CACHED_PROPERTIES = [
  "logoFile",
  "appTokens",
  "keyValuePairs",
  "workspaceUsers",
  "featureFlags",
  "approvedAccessDomains",
  "emailingDomains",
  "publicDomains",
  "workspaceMembersCount",
  "workspaceSSOIdentityProviders",
  "agents",
  "webhooks",
  "apiKeys",
  "views",
  "viewFields",
  "viewFilters",
  "viewFilterGroups",
  "viewGroups",
  "viewSorts",
  "defaultRole",
  "workspaceCustomApplication",
  "applications",
] as const;

export type WorkspaceEntityNonCachedProperty =
  (typeof WORKSPACE_ENTITY_NON_CACHED_PROPERTIES)[number];
