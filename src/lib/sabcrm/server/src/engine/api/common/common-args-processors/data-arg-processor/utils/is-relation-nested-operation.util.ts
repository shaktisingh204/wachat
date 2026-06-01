import { RELATION_NESTED_QUERY_KEYWORDS } from '@/lib/sabcrm/shared/src/constants/RelationNestedQueriesKeyword';
import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

const { CONNECT, DISCONNECT } = RELATION_NESTED_QUERY_KEYWORDS;

export const isRelationNestedOperation = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    (CONNECT in obj && isDefined(obj[CONNECT])) ||
    (DISCONNECT in obj && isDefined(obj[DISCONNECT]))
  );
};
