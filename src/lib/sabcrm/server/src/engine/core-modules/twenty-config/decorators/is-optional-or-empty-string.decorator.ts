// PORT-NOTE: Ported from twenty-server. Pure class-validator decorator; no NestJS/Postgres deps.
// @sniptt/guards is a pure TS utility package — isNonEmptyString check preserved.
import { ValidateIf, type ValidationOptions, isDefined } from 'class-validator';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export function IsOptionalOrEmptyString(validationOptions?: ValidationOptions) {
  return ValidateIf((_obj, value) => {
    return isDefined(value) && isNonEmptyString(value);
  }, validationOptions);
}
