// PORT-NOTE: class-validator decorators are preserved for compatibility with
// any DTO classes that use them. The zod equivalent is also exported for use
// in server actions / API routes that prefer zod validation.

import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from "class-validator";
import { z } from "zod";

const VALID_METADATA_NAME_REGEX =
  /^(?!(?:not|or|and|Int|Float|Boolean|String|ID)$)[^'"\\;.=*/]+$/;

/**
 * class-validator decorator: validates that a metadata name does not use
 * reserved GraphQL / SQL keywords and contains only safe characters.
 */
export function IsValidMetadataName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsValidName",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validate(value: any) {
          return VALID_METADATA_NAME_REGEX.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} has failed the name validation check`;
        },
      },
    });
  };
}

/**
 * Zod schema equivalent for use in server actions / API route validation.
 */
export const validMetadataNameSchema = z
  .string()
  .regex(
    VALID_METADATA_NAME_REGEX,
    "Name contains reserved keywords or invalid characters",
  );

/**
 * Plain function equivalent for imperative validation.
 */
export function isValidMetadataName(value: string): boolean {
  return VALID_METADATA_NAME_REGEX.test(value);
}
