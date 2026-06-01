// PORT-NOTE: Ported from twenty-server. class-transformer is a pure TS library with no NestJS/Postgres deps.
// Used for transforming config variable keys to UPPER_SNAKE_CASE before processing.
import { Transform } from 'class-transformer';
import snakeCase from 'lodash.snakecase';

export const CastToUpperSnakeCase = () =>
  Transform(({ value }: { value: string }) => toUpperSnakeCase(value));

const toUpperSnakeCase = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return snakeCase(value.trim()).toUpperCase();
  }

  return undefined;
};
