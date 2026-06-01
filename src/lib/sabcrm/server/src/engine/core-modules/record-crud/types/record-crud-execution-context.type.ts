// PORT-NOTE: Ported from twenty-server. WorkspaceAuthContext and RolePermissionConfig
// are stubs — replace when auth/ORM layers are fully ported.

export type WorkspaceAuthContext = {
  workspaceId: string;
  userId?: string;
  [key: string]: unknown;
};

export type RolePermissionConfig = {
  roleId?: string;
  [key: string]: unknown;
};

export type RecordCrudExecutionContext = {
  authContext: WorkspaceAuthContext;
  rolePermissionConfig?: RolePermissionConfig;
  slimResponse?: boolean;
};
