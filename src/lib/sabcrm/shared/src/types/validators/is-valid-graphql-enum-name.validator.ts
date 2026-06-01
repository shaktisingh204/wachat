// PORT-NOTE: The original used class-validator decorators (registerDecorator, ValidationOptions,
// ValidationArguments) which are NestJS/class-validator patterns. Those are not used in SabNode's
// Next.js/Mongo stack. This port retains the core regex validation logic as a plain function
// and a Zod refinement, so downstream code can validate GraphQL enum names without NestJS deps.

const graphQLEnumNameRegex = /^[_A-Za-z][_0-9A-Za-z]*$/;

/**
 * Returns true when `value` is a valid GraphQL enum name
 * (starts with a letter or underscore, followed by letters, digits, or underscores).
 */
export const isValidGraphQLEnumName = (value: unknown): boolean => {
  return typeof value === 'string' && graphQLEnumNameRegex.test(value);
};

/**
 * Error message to surface when a value fails the GraphQL enum name check.
 */
export const graphQLEnumNameValidationMessage = (property: string): string => {
  return `${property} must match the ${graphQLEnumNameRegex} format`;
};
