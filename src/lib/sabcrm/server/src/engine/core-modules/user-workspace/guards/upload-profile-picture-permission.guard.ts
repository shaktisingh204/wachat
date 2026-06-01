// PORT-NOTE: NestJS CanActivate guard replaced with a plain async permission
// check function. Callers (Next.js route handlers / server actions) should
// invoke checkUploadProfilePicturePermission() and handle the thrown
// PermissionsException themselves. The GqlExecutionContext / request extraction
// must be done by the caller before calling this function.

export class PermissionsException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly meta?: { userFriendlyMessage?: string },
  ) {
    super(message);
    this.name = "PermissionsException";
  }
}

export const PermissionsExceptionCode = {
  PERMISSION_DENIED: "PERMISSION_DENIED",
} as const;

export const PermissionsExceptionMessage = {
  PERMISSION_DENIED: "Permission denied",
} as const;

export const WorkspaceActivationStatus = {
  PENDING_CREATION: "PENDING_CREATION",
  ONGOING_CREATION: "ONGOING_CREATION",
} as const;

export const PermissionFlagType = {
  WORKSPACE_MEMBERS: "WORKSPACE_MEMBERS",
  PROFILE_INFORMATION: "PROFILE_INFORMATION",
  WORKSPACE: "WORKSPACE",
} as const;

type PermissionCheckDeps = {
  userHasWorkspaceSettingPermission: (params: {
    userWorkspaceId: string;
    workspaceId: string;
    setting: string;
    apiKeyId?: string;
  }) => Promise<boolean>;
};

type UploadProfilePictureRequest = {
  workspaceId: string;
  userWorkspaceId: string;
  workspaceActivationStatus: string;
  apiKeyId?: string;
};

export async function checkUploadProfilePicturePermission(
  request: UploadProfilePictureRequest,
  permissionsService: PermissionCheckDeps,
): Promise<void> {
  const { workspaceId, userWorkspaceId, workspaceActivationStatus, apiKeyId } = request;

  // Allow during workspace creation
  const creationStatuses: string[] = [
    WorkspaceActivationStatus.PENDING_CREATION,
    WorkspaceActivationStatus.ONGOING_CREATION,
  ];
  if (creationStatuses.includes(workspaceActivationStatus)) {
    return;
  }

  const hasWorkspaceMembersPermission =
    await permissionsService.userHasWorkspaceSettingPermission({
      userWorkspaceId,
      workspaceId,
      setting: PermissionFlagType.WORKSPACE_MEMBERS,
      apiKeyId,
    });

  if (hasWorkspaceMembersPermission) return;

  const hasProfileInformationPermission =
    await permissionsService.userHasWorkspaceSettingPermission({
      userWorkspaceId,
      workspaceId,
      setting: PermissionFlagType.PROFILE_INFORMATION,
      apiKeyId,
    });

  if (hasProfileInformationPermission) return;

  throw new PermissionsException(
    PermissionsExceptionMessage.PERMISSION_DENIED,
    PermissionsExceptionCode.PERMISSION_DENIED,
    {
      userFriendlyMessage:
        "You do not have permission to upload profile pictures. Please contact your workspace administrator for access.",
    },
  );
}
