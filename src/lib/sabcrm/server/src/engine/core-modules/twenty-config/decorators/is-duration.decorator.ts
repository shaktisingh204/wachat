// PORT-NOTE: Ported from twenty-server. Pure class-validator decorator; no NestJS/Postgres deps.
import {
  registerDecorator,
  type ValidationOptions,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: true })
export class IsDurationConstraint implements ValidatorConstraintInterface {
  validate(duration: string) {
    const regex =
      /^-?[0-9]+(.[0-9]+)?(m(illiseconds?)?|s(econds?)?|h((ou)?rs?)?|d(ays?)?|w(eeks?)?|M(onths?)?|y(ears?)?)?$/;

    return regex.test(duration);
  }
}

export const IsDuration =
  (validationOptions?: ValidationOptions) =>
  (object: object, propertyName: string) => {
    registerDecorator({
      target: (object as Record<string, unknown>).constructor as new (
        ...args: unknown[]
      ) => unknown,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsDurationConstraint,
    });
  };
