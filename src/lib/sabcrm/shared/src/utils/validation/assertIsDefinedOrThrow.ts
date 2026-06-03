import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

// https://github.com/microsoft/TypeScript/issues/34523
// eslint-disable-next-line prefer-arrow/prefer-arrow-functions
export function assertIsDefinedOrThrow<T>(
  value: T | undefined | null,
  exceptionToThrow: Error = new Error('Value not defined'),
): asserts value is T {
  if (!isDefined(value)) throw exceptionToThrow;
}
