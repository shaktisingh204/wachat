// PORT-NOTE: UserInputError from the GraphQL layer is replaced with a plain
// Error subclass since NestJS GraphQL context is absent in Next.js.
// The function re-throws the exception as a UserInputError so callers can
// handle it at the API route level (e.g. return HTTP 400).

import {
  type RecordTransformerException,
  RecordTransformerExceptionCode,
} from '@/lib/sabcrm/server/src/engine/core-modules/record-transformer/record-transformer.exception';

const assertUnreachable = (value: never): never => {
  throw new Error(`Unexpected value: ${String(value)}`);
};

export class UserInputError extends Error {
  readonly originalError: RecordTransformerException;

  constructor(error: RecordTransformerException) {
    super(error.userFriendlyMessage || error.message);
    this.name = 'UserInputError';
    this.originalError = error;
  }
}

export const recordTransformerGraphqlApiExceptionHandler = (
  error: RecordTransformerException,
): never => {
  switch (error.code) {
    case RecordTransformerExceptionCode.INVALID_PHONE_NUMBER:
    case RecordTransformerExceptionCode.INVALID_PHONE_COUNTRY_CODE:
    case RecordTransformerExceptionCode.CONFLICTING_PHONE_COUNTRY_CODE:
    case RecordTransformerExceptionCode.CONFLICTING_PHONE_CALLING_CODE:
    case RecordTransformerExceptionCode.CONFLICTING_PHONE_CALLING_CODE_AND_COUNTRY_CODE:
    case RecordTransformerExceptionCode.INVALID_PHONE_CALLING_CODE:
    case RecordTransformerExceptionCode.INVALID_URL:
      throw new UserInputError(error);
    default: {
      assertUnreachable(error.code);
    }
  }
};
