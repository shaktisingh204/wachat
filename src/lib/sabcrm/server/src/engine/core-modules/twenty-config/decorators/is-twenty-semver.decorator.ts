// PORT-NOTE: Ported from twenty-server. Pure class-validator + semver; no NestJS/Postgres deps.
import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import semver from 'semver';

@ValidatorConstraint({ async: false })
export class IsTwentySemVerValidator implements ValidatorConstraintInterface {
  validate(version: string) {
    const parsed = semver.parse(version);

    return parsed !== null;
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be a valid semantic version (e.g., 1.0.0)`;
  }
}

export const IsTwentySemVer =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string) => {
    registerDecorator({
      target: (object as Record<string, unknown>).constructor as new (
        ...args: unknown[]
      ) => unknown,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsTwentySemVerValidator,
    });
  };
