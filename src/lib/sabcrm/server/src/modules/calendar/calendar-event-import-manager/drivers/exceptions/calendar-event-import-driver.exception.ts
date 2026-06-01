// PORT-NOTE: @lingui/core msg`` template tags dropped — user-facing messages kept as plain strings.
// PORT-NOTE: assertUnreachable from twenty-shared replaced with exhaustive check helper.
// PORT-NOTE: CustomException from src/utils replaced with native Error subclass.

export enum CalendarEventImportDriverExceptionCode {
  NOT_FOUND = 'NOT_FOUND',
  TEMPORARY_ERROR = 'TEMPORARY_ERROR',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  SYNC_CURSOR_ERROR = 'SYNC_CURSOR_ERROR',
  UNKNOWN = 'UNKNOWN',
  UNKNOWN_NETWORK_ERROR = 'UNKNOWN_NETWORK_ERROR',
  HANDLE_ALIASES_REQUIRED = 'HANDLE_ALIASES_REQUIRED',
  CHANNEL_MISCONFIGURED = 'CHANNEL_MISCONFIGURED',
}

const getCalendarEventImportDriverExceptionUserFriendlyMessage = (
  code: CalendarEventImportDriverExceptionCode,
): string => {
  switch (code) {
    case CalendarEventImportDriverExceptionCode.NOT_FOUND:
      return 'Calendar event not found.';
    case CalendarEventImportDriverExceptionCode.TEMPORARY_ERROR:
      return 'A temporary error occurred. Please try again.';
    case CalendarEventImportDriverExceptionCode.INSUFFICIENT_PERMISSIONS:
      return 'Insufficient permissions to access calendar.';
    case CalendarEventImportDriverExceptionCode.SYNC_CURSOR_ERROR:
      return 'Calendar sync error.';
    case CalendarEventImportDriverExceptionCode.UNKNOWN:
      return 'An unknown calendar error occurred.';
    case CalendarEventImportDriverExceptionCode.UNKNOWN_NETWORK_ERROR:
      return 'A network error occurred while accessing calendar.';
    case CalendarEventImportDriverExceptionCode.HANDLE_ALIASES_REQUIRED:
      return 'Handle aliases are required.';
    case CalendarEventImportDriverExceptionCode.CHANNEL_MISCONFIGURED:
      return 'Calendar channel is misconfigured.';
    default: {
      const _exhaustive: never = code;
      return `Unknown error code: ${_exhaustive}`;
    }
  }
};

export class CalendarEventImportDriverException extends Error {
  public readonly code: CalendarEventImportDriverExceptionCode;
  public readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: CalendarEventImportDriverExceptionCode,
    {
      userFriendlyMessage,
    }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = 'CalendarEventImportDriverException';
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ??
      getCalendarEventImportDriverExceptionUserFriendlyMessage(code);
  }
}
