// PORT-NOTE: @lingui/core msg template tag and assertUnreachable are dropped;
// user-friendly messages are plain strings. CustomException (NestJS) is replaced
// by a plain Error subclass carrying the exception code.

export enum EmailToolExceptionCode {
  INVALID_CONNECTED_ACCOUNT_ID = "INVALID_CONNECTED_ACCOUNT_ID",
  CONNECTED_ACCOUNT_NOT_FOUND = "CONNECTED_ACCOUNT_NOT_FOUND",
  INVALID_EMAIL = "INVALID_EMAIL",
  WORKSPACE_ID_NOT_FOUND = "WORKSPACE_ID_NOT_FOUND",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  INVALID_FILE_ID = "INVALID_FILE_ID",
  TOO_MANY_RECIPIENTS = "TOO_MANY_RECIPIENTS",
}

const USER_FRIENDLY_MESSAGES: Record<EmailToolExceptionCode, string> = {
  [EmailToolExceptionCode.INVALID_CONNECTED_ACCOUNT_ID]:
    "Invalid connected account ID.",
  [EmailToolExceptionCode.CONNECTED_ACCOUNT_NOT_FOUND]:
    "Connected account not found.",
  [EmailToolExceptionCode.INVALID_EMAIL]: "Invalid email address.",
  [EmailToolExceptionCode.WORKSPACE_ID_NOT_FOUND]: "Workspace not found.",
  [EmailToolExceptionCode.FILE_NOT_FOUND]: "File not found.",
  [EmailToolExceptionCode.INVALID_FILE_ID]: "Invalid file ID.",
  [EmailToolExceptionCode.TOO_MANY_RECIPIENTS]: "Too many recipients.",
};

export class EmailToolException extends Error {
  readonly code: EmailToolExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: EmailToolExceptionCode,
    options?: { userFriendlyMessage?: string },
  ) {
    super(message);
    this.name = "EmailToolException";
    this.code = code;
    this.userFriendlyMessage =
      options?.userFriendlyMessage ?? USER_FRIENDLY_MESSAGES[code];
  }
}
