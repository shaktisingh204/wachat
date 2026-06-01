// PORT-NOTE: @lingui/core msg tags replaced with plain strings.
// CustomException base class inlined. assertUnreachable inlined.

export enum SearchExceptionCode {
  LABEL_IDENTIFIER_FIELD_NOT_FOUND = "LABEL_IDENTIFIER_FIELD_NOT_FOUND",
  OBJECT_METADATA_NOT_FOUND = "OBJECT_METADATA_NOT_FOUND",
}

function assertUnreachable(x: never): never {
  throw new Error(`Unreachable case: ${String(x)}`);
}

const getSearchExceptionUserFriendlyMessage = (
  code: SearchExceptionCode,
): string => {
  switch (code) {
    case SearchExceptionCode.LABEL_IDENTIFIER_FIELD_NOT_FOUND:
      return "No identifier to search by was found.";
    case SearchExceptionCode.OBJECT_METADATA_NOT_FOUND:
      return "Object not found.";
    default:
      assertUnreachable(code);
  }
};

export class SearchException extends Error {
  readonly code: SearchExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: SearchExceptionCode,
    options: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = "SearchException";
    this.code = code;
    this.userFriendlyMessage =
      options.userFriendlyMessage ??
      getSearchExceptionUserFriendlyMessage(code);
  }
}
