// PORT-NOTE: NestJS module-wiring — no Next.js equivalent.
// Re-exports all ported workspace-invitation pieces for consumers.

export {
  WorkspaceInvitationException,
  WorkspaceInvitationExceptionCode,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/workspace-invitation.exception";

export type { SendInvitationsDTO } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/send-invitations.dto";

export {
  sendInvitationsInputSchema,
  type SendInvitationsInput,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/send-invitations.input";

export type { WorkspaceInvitation } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/dtos/workspace-invitation.dto";

export { castAppTokenToWorkspaceInvitationUtil } from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/utils/cast-app-token-to-workspace-invitation.util";

export {
  validatePersonalInvitation,
  findInvitationsByEmail,
  getOneWorkspaceInvitation,
  getAppTokenByInvitationToken,
  loadWorkspaceInvitations,
  generateInvitationToken,
  createWorkspaceInvitation,
  deleteWorkspaceInvitation,
  invalidateWorkspaceInvitation,
  sendInvitations,
  resendWorkspaceInvitation,
} from "@/lib/sabcrm/server/src/engine/core-modules/workspace-invitation/services/workspace-invitation.service";

// Original NestJS imports:
//   AppTokenEntity, UserWorkspaceEntity, WorkspaceEntity (TypeORM)
//   WorkspaceDomainsModule, RoleValidationModule, FileModule,
//   OnboardingModule, PermissionsModule, FeatureFlagModule, ThrottlerModule
// All cross-cutting concerns (email, throttling, file URL signing,
// onboarding, role validation, permissions) must be integrated at
// the Next.js route/action layer.
