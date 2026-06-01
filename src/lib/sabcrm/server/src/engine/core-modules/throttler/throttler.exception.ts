// PORT-NOTE: CustomException + Lingui deps replaced with plain Error subclass.
// assertUnreachable is inlined; msg`` tags become plain strings.

function assertUnreachable(x: never): never {
  throw new Error(`Unhandled throttler exception code: ${String(x)}`);
}

export enum ThrottlerExceptionCode {
  LIMIT_REACHED = 'LIMIT_REACHED',
}

function getThrottlerExceptionUserFriendlyMessage(
  code: ThrottlerExceptionCode,
): string {
  switch (code) {
    case ThrottlerExceptionCode.LIMIT_REACHED:
      return 'Rate limit reached. Please try again later.';
    default:
      return assertUnreachable(code);
  }
}

export class ThrottlerException extends Error {
  readonly code: ThrottlerExceptionCode;
  readonly userFriendlyMessage: string;

  constructor(
    message: string,
    code: ThrottlerExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage?: string } = {},
  ) {
    super(message);
    this.name = 'ThrottlerException';
    this.code = code;
    this.userFriendlyMessage =
      userFriendlyMessage ?? getThrottlerExceptionUserFriendlyMessage(code);
  }
}
