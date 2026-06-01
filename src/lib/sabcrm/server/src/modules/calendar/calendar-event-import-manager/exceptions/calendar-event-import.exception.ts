// PORT-NOTE: @lingui/core msg`` template tags dropped — user-facing messages kept as plain strings.
// PORT-NOTE: assertUnreachable from twenty-shared replaced with exhaustive check helper.
// PORT-NOTE: CustomException from src/utils replaced with native Error subclass.

export enum CalendarEventImportExceptionCode {
  PROVIDER_NOT_SUPPORTED = 'PROVIDER_NOT_SUPPORTED',
  UNKNOWN = 'UNKNOWN',
}

const getCalendarEventImportExceptionUserFriendlyMessage = (
  code: CalendarEventImportExceptionCode,
): string => {
  switch (code) {
    case CalendarEventImportExceptionCode.PROVIDER_NOT_SUPPORTED:
      return 'Calendar provider is not supported.';
    case CalendarEventImportExceptionCode.UNKNOWN:
      return 'An unknown calendar error occurred.';
    default: {
      const _exhaustive: never = code;
      return `Unknown error code: ${_exhaustive}`;
    }
  }
};

export class CalendarEventImportException extends Error {
  public readonly code: CalendarEventImportExceptionCode;
  public readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: CalendarEventImportExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = 'CalendarEventImportException';
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ??
      getCalendarEventImportExceptionUserFriendlyMessage(code);
  }
}
