import { isEmptyObject } from '@/lib/sabcrm/shared/src/utils';

export const isNullEquivalentRawJsonFieldValue = (value: unknown): boolean => {
  if (value === null) return true;

  return isEmptyObject(value);
};
