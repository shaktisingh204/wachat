// PORT-NOTE: CustomException base ported as a plain Error subclass.
// The original used @lingui/core for i18n message descriptors;
// we preserve the codes and human-readable messages as plain strings.

export enum UserExceptionCode {
  USER_NOT_FOUND = "USER_NOT_FOUND",
  EMAIL_ALREADY_IN_USE = "EMAIL_ALREADY_IN_USE",
  EMAIL_UNCHANGED = "EMAIL_UNCHANGED",
  EMAIL_UPDATE_RESTRICTED_TO_SINGLE_WORKSPACE = "EMAIL_UPDATE_RESTRICTED_TO_SINGLE_WORKSPACE",
}

const getUserFriendlyMessage = (code: UserExceptionCode): string => {
  switch (code) {
    case UserExceptionCode.USER_NOT_FOUND:
      return "User not found.";
    case UserExceptionCode.EMAIL_ALREADY_IN_USE:
      return "This email is already in use.";
    case UserExceptionCode.EMAIL_UNCHANGED:
      return "Email is unchanged.";
    case UserExceptionCode.EMAIL_UPDATE_RESTRICTED_TO_SINGLE_WORKSPACE:
      return "Email update is restricted to single workspace users.";
    default: {
      const _exhaustive: never = code;
      return "An unknown error occurred.";
    }
  }
};

export class UserException extends Error {
  readonly code: UserExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: UserExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {}
  ) {
    super(message);
    this.name = "UserException";
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ?? getUserFriendlyMessage(code);
  }
}
