// PORT-NOTE: expr-eval-fork is used here. Ensure it is installed in the SabNode project
// or available via the shared package. Run: npm install expr-eval-fork
import { Parser } from 'expr-eval-fork';

import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';
import { isNonEmptyArray } from '@/lib/sabcrm/shared/src/utils/array/isNonEmptyArray';
import { safeGetNestedProperty } from '@/lib/sabcrm/shared/src/utils/command-menu-items/safeGetNestedProperty';

type ArrayMethod = 'every' | 'some';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const createArrayPropCheck = (
  method: ArrayMethod,
  predicate: (value: unknown) => boolean,
) => {
  return (array: unknown, prop: string): boolean => {
    if (!isNonEmptyArray(array as unknown[])) {
      return false;
    }

    return (array as unknown[])[method]((item) =>
      predicate(safeGetNestedProperty(item, prop)),
    );
  };
};

const createArrayPropValueCheck = (
  method: ArrayMethod,
  predicate: (value: unknown, target: unknown) => boolean,
) => {
  return (array: unknown, prop: string, value: unknown): boolean => {
    if (!isNonEmptyArray(array as unknown[])) {
      return false;
    }

    return (array as unknown[])[method]((item) =>
      predicate(safeGetNestedProperty(item, prop), value),
    );
  };
};

export const conditionalAvailabilityParser = new Parser();

conditionalAvailabilityParser.functions.isDefined = (value: unknown) =>
  isDefined(value);

conditionalAvailabilityParser.functions.isNonEmptyString = (value: unknown) =>
  isNonEmptyString(value);

conditionalAvailabilityParser.functions.includes = (
  array: unknown,
  value: unknown,
): boolean => Array.isArray(array) && array.includes(value);

conditionalAvailabilityParser.functions.arrayLength = (
  value: unknown,
): number => (Array.isArray(value) ? value.length : 0);

conditionalAvailabilityParser.functions.every = createArrayPropCheck(
  'every',
  Boolean,
);

conditionalAvailabilityParser.functions.everyDefined = createArrayPropCheck(
  'every',
  isDefined,
);

conditionalAvailabilityParser.functions.some = createArrayPropCheck(
  'some',
  Boolean,
);

conditionalAvailabilityParser.functions.someDefined = createArrayPropCheck(
  'some',
  isDefined,
);

conditionalAvailabilityParser.functions.someNonEmptyString =
  createArrayPropCheck('some', isNonEmptyString);

conditionalAvailabilityParser.functions.none = createArrayPropCheck(
  'every',
  (value) => !Boolean(value),
);

conditionalAvailabilityParser.functions.noneDefined = createArrayPropCheck(
  'every',
  (value) => !isDefined(value),
);

conditionalAvailabilityParser.functions.everyEquals = createArrayPropValueCheck(
  'every',
  (a, b) => a === b,
);

conditionalAvailabilityParser.functions.someEquals = createArrayPropValueCheck(
  'some',
  (a, b) => a === b,
);

conditionalAvailabilityParser.functions.noneEquals = createArrayPropValueCheck(
  'every',
  (a, b) => a !== b,
);

conditionalAvailabilityParser.functions.includesEvery =
  createArrayPropValueCheck(
    'every',
    (array, value) => Array.isArray(array) && array.includes(value),
  );

conditionalAvailabilityParser.functions.includesSome =
  createArrayPropValueCheck(
    'some',
    (array, value) => Array.isArray(array) && array.includes(value),
  );

conditionalAvailabilityParser.functions.includesNone =
  createArrayPropValueCheck(
    'every',
    (array, value) => Array.isArray(array) && !array.includes(value),
  );
