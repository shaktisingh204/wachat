// PORT-NOTE: Ported from twenty-server. @lingui/core msg tags replaced with
// plain English strings (no i18n runtime in SabNode at this layer).
// CustomException base class ported inline — assertUnreachable inlined.
// The NestJS exception hierarchy is dropped; errors are plain JS Error subclasses.

const assertUnreachable = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};

export enum RecordTransformerExceptionCode {
  INVALID_URL = 'INVALID_URL',
  INVALID_PHONE_NUMBER = 'INVALID_PHONE_NUMBER',
  INVALID_PHONE_COUNTRY_CODE = 'INVALID_PHONE_COUNTRY_CODE',
  INVALID_PHONE_CALLING_CODE = 'INVALID_PHONE_CALLING_CODE',
  CONFLICTING_PHONE_COUNTRY_CODE = 'CONFLICTING_PHONE_COUNTRY_CODE',
  CONFLICTING_PHONE_CALLING_CODE = 'CONFLICTING_PHONE_CALLING_CODE',
  CONFLICTING_PHONE_CALLING_CODE_AND_COUNTRY_CODE = 'CONFLICTING_PHONE_CALLING_CODE_AND_COUNTRY_CODE',
}

const getRecordTransformerExceptionUserFriendlyMessage = (
  code: RecordTransformerExceptionCode,
): string => {
  switch (code) {
    case RecordTransformerExceptionCode.INVALID_URL:
      return 'Invalid URL format.';
    case RecordTransformerExceptionCode.INVALID_PHONE_NUMBER:
      return 'Invalid phone number.';
    case RecordTransformerExceptionCode.INVALID_PHONE_COUNTRY_CODE:
      return 'Invalid phone country code.';
    case RecordTransformerExceptionCode.INVALID_PHONE_CALLING_CODE:
      return 'Invalid phone calling code.';
    case RecordTransformerExceptionCode.CONFLICTING_PHONE_COUNTRY_CODE:
      return 'Conflicting phone country code.';
    case RecordTransformerExceptionCode.CONFLICTING_PHONE_CALLING_CODE:
      return 'Conflicting phone calling code.';
    case RecordTransformerExceptionCode.CONFLICTING_PHONE_CALLING_CODE_AND_COUNTRY_CODE:
      return 'Conflicting phone calling code and country code.';
    default:
      assertUnreachable(code);
  }
};

export class RecordTransformerException extends Error {
  readonly code: RecordTransformerExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: RecordTransformerExceptionCode,
    {
      userFriendlyMessage,
    }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = 'RecordTransformerException';
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ??
      getRecordTransformerExceptionUserFriendlyMessage(code);
  }
}
