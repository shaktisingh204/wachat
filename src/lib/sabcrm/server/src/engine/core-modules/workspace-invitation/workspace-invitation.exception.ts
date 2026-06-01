export enum WorkspaceInvitationExceptionCode {
  INVALID_APP_TOKEN_TYPE = "INVALID_APP_TOKEN_TYPE",
  INVITATION_CORRUPTED = "INVITATION_CORRUPTED",
  INVITATION_ALREADY_EXIST = "INVITATION_ALREADY_EXIST",
  USER_ALREADY_EXIST = "USER_ALREADY_EXIST",
  INVALID_INVITATION = "INVALID_INVITATION",
  EMAIL_MISSING = "EMAIL_MISSING",
}

const USER_FRIENDLY_MESSAGES: Record<WorkspaceInvitationExceptionCode, string> =
  {
    [WorkspaceInvitationExceptionCode.INVALID_APP_TOKEN_TYPE]:
      "There is an issue with your invitation. Please try again.",
    [WorkspaceInvitationExceptionCode.INVITATION_CORRUPTED]:
      "There is an issue with your invitation. Please try again.",
    [WorkspaceInvitationExceptionCode.INVALID_INVITATION]:
      "There is an issue with your invitation. Please try again.",
    [WorkspaceInvitationExceptionCode.INVITATION_ALREADY_EXIST]:
      "An invitation has already been sent to this email.",
    [WorkspaceInvitationExceptionCode.USER_ALREADY_EXIST]:
      "This user is already a member of the workspace.",
    [WorkspaceInvitationExceptionCode.EMAIL_MISSING]: "Email is required.",
  };

export class WorkspaceInvitationException extends Error {
  readonly code: WorkspaceInvitationExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: WorkspaceInvitationExceptionCode,
    options?: { userFriendlyMessage?: string },
  ) {
    super(message);
    this.name = "WorkspaceInvitationException";
    this.code = code;
    this.userFriendlyMessage =
      options?.userFriendlyMessage ?? USER_FRIENDLY_MESSAGES[code];
  }
}
