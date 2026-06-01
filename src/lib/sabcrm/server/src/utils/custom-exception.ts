// PORT-NOTE: Ported from twenty-server/src/utils/custom-exception.ts.
// @lingui/core MessageDescriptor replaced with plain string for Next.js compatibility.

export abstract class CustomException<
  ExceptionCode extends string = string,
  ExceptionMessage extends string = string,
> extends Error {
  code: ExceptionCode;
  userFriendlyMessage: string;

  constructor(
    message: ExceptionMessage,
    code: ExceptionCode,
    { userFriendlyMessage }: { userFriendlyMessage: string },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.userFriendlyMessage = userFriendlyMessage;
  }
}

export class UnknownException extends CustomException {}
