// PORT-NOTE: NestJS @Module has no direct Next.js equivalent.
// This registry re-exports all pieces wired by the original UserModule.

export {
  getUserCollection,
  ensureUserIndexes,
  type UserDocument,
  OnboardingStatus,
  SABCRM_USER_COLLECTION,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/user.entity";

export {
  UserException,
  UserExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/user.exception";

export { userValidator } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.validate";

export {
  loadWorkspaceMember,
  loadWorkspaceMembers,
  loadDeletedWorkspaceMembersOnly,
  loadWorkspaceMembersByUserIds,
  loadSignedAvatarUrlsByUserId,
  deleteUser,
  findUserByEmail,
  findUserByEmailOrThrow,
  findUserByEmailWithWorkspaces,
  findUserById,
  findUserByIdOrThrow,
  markEmailAsVerified,
  updateEmailFromVerificationToken,
  updateUserEmail,
  hasUserAccessToWorkspaceOrThrow,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/services/user.service";

export { WorkspaceMemberTranspiler } from "@/lib/sabcrm/server/src/engine/core-modules/user/services/workspace-member-transpiler.service";
export type {
  WorkspaceMemberDTO,
  DeletedWorkspaceMemberDTO,
  ToWorkspaceMemberDtoArgs,
} from "@/lib/sabcrm/server/src/engine/core-modules/user/services/workspace-member-transpiler.service";

export { UserVarsService } from "@/lib/sabcrm/server/src/engine/core-modules/user/user-vars/services/user-vars.service";

export { userAutoResolverOpts } from "@/lib/sabcrm/server/src/engine/core-modules/user/user.auto-resolver-opts";

export { fromUserEntityToFlat } from "@/lib/sabcrm/server/src/engine/core-modules/user/utils/from-user-entity-to-flat.util";

export { assertWorkspaceMemberUpdateUsesNonCustomFieldsOnly } from "@/lib/sabcrm/server/src/engine/core-modules/user/utils/assert-workspace-member-update-non-custom-fields.util";

export type { FlatUser } from "@/lib/sabcrm/server/src/engine/core-modules/user/types/flat-user.type";
export type { FlatWorkspaceMember } from "@/lib/sabcrm/server/src/engine/core-modules/user/types/flat-workspace-member.type";
export type { FlatWorkspaceMemberMaps } from "@/lib/sabcrm/server/src/engine/core-modules/user/types/flat-workspace-member-maps.type";

/*
  Original NestJS module imports (reference only):
    NestjsQueryGraphQLModule, NestjsQueryTypeOrmModule, TypeORMModule,
    WorkspaceModule, OnboardingModule, TypeOrmModule (KeyValuePairEntity, UserWorkspaceEntity),
    UserVarsModule, UserWorkspaceModule, AuditModule, UserRoleModule,
    FeatureFlagModule, PermissionsModule, EmailVerificationModule,
    WorkspaceDomainsModule, WorkspaceCacheModule, CoreEntityCacheModule

  Original providers:
    UserService, UserResolver, UserEntityCacheProviderService,
    WorkspaceMemberTranspiler, WorkspaceFlatWorkspaceMemberMapCacheService,
    GlobalWorkspaceMemberListener

  Original exports:
    UserService, WorkspaceMemberTranspiler
*/
