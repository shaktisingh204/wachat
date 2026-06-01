// PORT-NOTE: NestJS CustomException base class replaced with a plain Error
// subclass. The @lingui/core/macro msg tag is replaced by plain string
// messages.

export enum UserWorkspaceExceptionCode {
  USER_WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
}

function getUserWorkspaceExceptionUserFriendlyMessage(
  code: UserWorkspaceExceptionCode,
): string {
  switch (code) {
    case UserWorkspaceExceptionCode.USER_WORKSPACE_NOT_FOUND:
      return "User workspace not found.";
    default: {
      const _exhaustiveCheck: never = code;
      throw new Error(`Unhandled code: ${_exhaustiveCheck}`);
    }
  }
}

export class UserWorkspaceException extends Error {
  public readonly code: UserWorkspaceExceptionCode;
  public readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: UserWorkspaceExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = "UserWorkspaceException";
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ?? getUserWorkspaceExceptionUserFriendlyMessage(code);
  }
}

export const UserWorkspaceNotFoundDefaultError = new UserWorkspaceException(
  "User Workspace not found",
  UserWorkspaceExceptionCode.USER_WORKSPACE_NOT_FOUND,
);
