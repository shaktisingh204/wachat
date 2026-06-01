// PORT-NOTE: @lingui/core msg tags replaced with plain strings.
// CustomException base class inlined here to avoid circular dependency chain.
// assertUnreachable from twenty-shared inlined.

export enum SdkClientExceptionCode {
  ARCHIVE_NOT_FOUND = "ARCHIVE_NOT_FOUND",
  ARCHIVE_EXTRACTION_FAILED = "ARCHIVE_EXTRACTION_FAILED",
  FILE_NOT_FOUND_IN_ARCHIVE = "FILE_NOT_FOUND_IN_ARCHIVE",
  GENERATION_FAILED = "GENERATION_FAILED",
}

function assertUnreachable(x: never): never {
  throw new Error(`Unreachable case: ${String(x)}`);
}

const getSdkClientExceptionUserFriendlyMessage = (
  code: SdkClientExceptionCode,
): string => {
  switch (code) {
    case SdkClientExceptionCode.ARCHIVE_NOT_FOUND:
      return "SDK client archive not found. The SDK client may not have been generated for this application.";
    case SdkClientExceptionCode.ARCHIVE_EXTRACTION_FAILED:
      return "Failed to extract SDK client archive.";
    case SdkClientExceptionCode.FILE_NOT_FOUND_IN_ARCHIVE:
      return "File not found in SDK client archive.";
    case SdkClientExceptionCode.GENERATION_FAILED:
      return "Failed to generate SDK client.";
    default:
      assertUnreachable(code);
  }
};

export class SdkClientException extends Error {
  readonly code: SdkClientExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: SdkClientExceptionCode,
    options: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = "SdkClientException";
    this.code = code;
    this.userFriendlyMessage =
      options.userFriendlyMessage ??
      getSdkClientExceptionUserFriendlyMessage(code);
  }
}
