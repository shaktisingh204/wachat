import {
  type ValidationOptions,
  registerDecorator,
  type ValidationArguments,
} from 'class-validator';

export const AssertOrWarn = (
  condition: (object: unknown, value: unknown) => boolean,
  validationOptions?: ValidationOptions,
) => {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'AssertOrWarn',
      target: (object as { constructor: Function }).constructor,
      propertyName: propertyName,
      options: {
        ...validationOptions,
        groups: ['warning'],
      },
      constraints: [condition],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          return condition(args.object, value);
        },
        defaultMessage(args: ValidationArguments) {
          return `'${args.property}' failed the warning validation.`;
        },
      },
    });
  };
};
