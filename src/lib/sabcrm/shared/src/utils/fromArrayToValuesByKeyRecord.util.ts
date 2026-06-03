// StringPropertyKeys: keys of T whose value type extends string | undefined
type OnlyStringPropertiesKey<T> = Extract<keyof T, string>;

export type StringPropertyKeys<T> = {
  [K in OnlyStringPropertiesKey<T>]: T[K] extends string | undefined
    ? K
    : never;
}[OnlyStringPropertiesKey<T>];

const isDefined = <T>(value: T | null | undefined): value is NonNullable<T> =>
  value !== undefined && value !== null;

export const fromArrayToValuesByKeyRecord = <T extends object>({
  array,
  key,
}: {
  array: T[];
  key: StringPropertyKeys<T>;
}) => {
  return array.reduce<Record<string, T[]>>((acc, value) => {
    const computedKey = value[key] as string;
    const occurrence = acc[computedKey];

    if (isDefined(occurrence)) {
      return {
        ...acc,
        [computedKey]: [...occurrence, value],
      };
    }

    return {
      ...acc,
      [computedKey]: [value],
    };
  }, {});
};
