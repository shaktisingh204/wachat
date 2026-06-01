import "server-only";

// PORT-NOTE: Ported from twenty-server SettingsPermissionGuard factory.
// NestJS mixin/DI pattern replaced with a plain higher-order async function
// that accepts the permission check as a callback.

export class SettingsPermissionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userFriendlyMessage?: string,
  ) {
    super(message);
    this.name = "SettingsPermissionError";
  }
}

export const WorkspaceActivationStatus = {
  PENDING_CREATION: "PENDING_CREATION",
  ONGOING_CREATION: "ONGOING_CREATION",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;

export type WorkspaceActivationStatusType =
  (typeof WorkspaceActivationStatus)[keyof typeof WorkspaceActivationStatus];

export type SettingsPermissionContext = {
  workspaceId: string;
  userWorkspaceId?: string;
  workspaceActivationStatus: WorkspaceActivationStatusType;
  apiKeyId?: string;
  applicationId?: string;
};

export type UserHasWorkspaceSettingPermissionFn = (params: {
  userWorkspaceId?: string;
  setting: string;
  workspaceId: string;
  apiKeyId?: string;
  applicationId?: string;
}) => Promise<boolean>;

/**
 * Factory that returns an async guard function pre-bound to `requiredPermission`.
 * The returned function throws SettingsPermissionError when the user lacks the
 * required setting permission. It always passes during workspace creation flows.
 */
export function createSettingsPermissionGuard(requiredPermission: string) {
  return async function assertSettingsPermission(
    ctx: SettingsPermissionContext,
    hasPermission: UserHasWorkspaceSettingPermissionFn,
  ): Promise<void> {
    const creationStatuses: WorkspaceActivationStatusType[] = [
      WorkspaceActivationStatus.PENDING_CREATION,
      WorkspaceActivationStatus.ONGOING_CREATION,
    ];

    if (creationStatuses.includes(ctx.workspaceActivationStatus)) {
      return;
    }

    const allowed = await hasPermission({
      userWorkspaceId: ctx.userWorkspaceId,
      setting: requiredPermission,
      workspaceId: ctx.workspaceId,
      apiKeyId: ctx.apiKeyId,
      applicationId: ctx.applicationId,
    });

    if (allowed) return;

    throw new SettingsPermissionError(
      "Permission denied",
      "PERMISSION_DENIED",
      "You do not have permission to access this feature. Please contact your workspace administrator for access.",
    );
  };
}
