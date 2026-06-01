// PORT-NOTE: Ported from twenty-server. Pure class-validator decorator; no NestJS/Postgres deps.
import {
  registerDecorator,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: true })
export class IsAWSRegionConstraint implements ValidatorConstraintInterface {
  validate(region: string) {
    const regex = /^[a-z]{2}-[a-z]+-\d{1}$/;

    return regex.test(region);
  }
}

export const IsAWSRegion =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string) => {
    registerDecorator({
      target: (object as Record<string, unknown>).constructor as new (
        ...args: unknown[]
      ) => unknown,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAWSRegionConstraint,
    });
  };
