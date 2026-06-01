import { type UserWorkspaceDocument } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.entity";

// PORT-NOTE: Original constant was typed against UserWorkspaceEntity (TypeORM).
// Updated to reference the ported UserWorkspaceDocument. Fields that existed
// only on TypeORM relations (user, workspace, twoFactorAuthenticationMethods)
// are mapped to their Mongo equivalents where applicable.

export const USER_WORKSPACE_ENTITY_NON_CACHED_PROPERTIES = [
  "twoFactorAuthenticationMethodIds",
  "permissionFlags",
  "objectPermissions",
  "objectsPermissions",
  "twoFactorAuthenticationMethodSummary",
] as const satisfies ReadonlyArray<keyof UserWorkspaceDocument>;
