// PORT-NOTE: NestJS module → registry/index re-exporting all ported pieces.

export {
  getUserWorkspaceCollection,
  ensureUserWorkspaceIndexes,
  type UserWorkspaceDocument,
} from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.entity";

export {
  UserWorkspaceException,
  UserWorkspaceExceptionCode,
  UserWorkspaceNotFoundDefaultError,
} from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.exception";

export {
  findUserWorkspaceById,
  checkUserWorkspaceExists,
  checkUserWorkspaceExistsByEmail,
  getUserWorkspaceCount,
  countUserWorkspaces,
  getUserWorkspaceForUserOrThrow,
  getActiveUserWorkspaceCountTotal,
  createUserWorkspace,
  updateUserWorkspaceLocale,
  deleteUserWorkspace,
  findFirstWorkspaceIdByUserId,
} from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/user-workspace.service";

export { computeUserWorkspaceForCache } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/services/user-workspace-entity-cache-provider.service";

export { fromUserWorkspaceEntityToFlat } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/utils/from-user-workspace-entity-to-flat.util";

export { type FlatUserWorkspace } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/types/flat-user-workspace.type";

export { USER_WORKSPACE_ENTITY_NON_CACHED_PROPERTIES } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/constants/user-workspace-entity-non-cached-properties.constant";

export { checkUploadProfilePicturePermission } from "@/lib/sabcrm/server/src/engine/core-modules/user-workspace/guards/upload-profile-picture-permission.guard";
