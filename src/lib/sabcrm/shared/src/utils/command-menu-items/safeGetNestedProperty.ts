import { isDefined } from '@/lib/sabcrm/shared/src/utils/validation/isDefined';

const BLOCKED_PROPERTY_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Safely traverses a dot-separated property path on an unknown object.
 * Returns undefined when any segment is missing, non-object, or a blocked prototype property.
 */
export const safeGetNestedProperty = (
  objectToEvaluate: unknown,
  path: string,
): unknown => {
  if (typeof path !== 'string') {
    return undefined;
  }

  const parts = path.split('.');

  let currentObject: unknown = objectToEvaluate;

  for (const part of parts) {
    if (
      !isDefined(currentObject) ||
      typeof currentObject !== 'object' ||
      Array.isArray(currentObject)
    ) {
      return undefined;
    }

    if (
      BLOCKED_PROPERTY_NAMES.has(part) ||
      !Object.prototype.hasOwnProperty.call(currentObject, part)
    ) {
      return undefined;
    }

    currentObject = (currentObject as Record<string, unknown>)[part];
  }

  return currentObject;
};
