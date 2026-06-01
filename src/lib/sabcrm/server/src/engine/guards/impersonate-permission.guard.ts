import "server-only";

// PORT-NOTE: Ported from twenty-server ImpersonatePermissionGuard.
// NestJS DI and GqlExecutionContext replaced with plain function receiving
// typed context. PermissionsException preserved via re-exported types.
// PermissionsService.userHasWorkspaceSettingPermission injected as callback.

export class PermissionsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly userFriendlyMessage?: string,
  ) {
    super(message);
    this.name = "PermissionsError";
  }
}

export const PermissionsExceptionMessage = {
  PERMISSION_DENIED: "Permission denied",
} as const;

export const PermissionsExceptionCode = {
  PERMISSION_DENIED: "PERMISSION_DENIED",
} as const;

export type ImpersonateGuardContext = {
  userWorkspaceId: string | undefined;
  workspaceId: string;
  /** True when the JWT/cookie already carries the canImpersonate flag. */
  canImpersonate: boolean;
};

export type HasWorkspaceSettingPermissionFn = (params: {
  userWorkspaceId: string;
  setting: string;
  workspaceId: string;
}) => Promise<boolean>;

/**
 * Asserts that the current user is allowed to impersonate other users.
 * Throws PermissionsError when the check fails.
 */
export async function assertImpersonatePermission(
  ctx: ImpersonateGuardContext,
  hasPermission: HasWorkspaceSettingPermissionFn,
): Promise<void> {
  if (!ctx.userWorkspaceId) {
    throw new PermissionsError(
      PermissionsExceptionMessage.PERMISSION_DENIED,
      PermissionsExceptionCode.PERMISSION_DENIED,
      "Can't impersonate user via api key",
    );
  }

  if (ctx.canImpersonate === true) return;

  const allowed = await hasPermission({
    userWorkspaceId: ctx.userWorkspaceId,
    setting: "IMPERSONATE",
    workspaceId: ctx.workspaceId,
  });

  if (allowed) return;

  throw new PermissionsError(
    PermissionsExceptionMessage.PERMISSION_DENIED,
    PermissionsExceptionCode.PERMISSION_DENIED,
    "You do not have permission to impersonate users. Please contact your workspace administrator for access.",
  );
}
