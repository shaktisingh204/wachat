// PORT-NOTE: class-transformer is a devDependency in the source. In SabNode this
// decorator is used only in ConfigVariables class which itself is a plain TS type.
// We export both the decorator form (for compatibility) and the raw transformer.
import { Transform } from 'class-transformer';

export const CastToPositiveNumber = () =>
  Transform(({ value }: { value: string }) => toNumber(value));

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return value >= 0 ? value : undefined;
  }
  if (typeof value === 'string') {
    return isNaN(+value) ? undefined : toNumber(+value);
  }

  return undefined;
};

export { toNumber as castToPositiveNumber };
