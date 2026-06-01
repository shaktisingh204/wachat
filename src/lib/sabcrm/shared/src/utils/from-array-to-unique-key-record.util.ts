// StringPropertyKeys: keys of T whose value type extends string | undefined
type OnlyStringPropertiesKey<T> = Extract<keyof T, string>;

export type StringPropertyKeys<T> = {
  [K in OnlyStringPropertiesKey<T>]: T[K] extends string | undefined
    ? K
    : never;
}[OnlyStringPropertiesKey<T>];

const isDefined = <T>(value: T | null | undefined): value is NonNullable<T> =>
  value !== undefined && value !== null;

export const fromArrayToUniqueKeyRecord = <T extends object>({
  array,
  uniqueKey,
}: {
  array: T[];
  uniqueKey: StringPropertyKeys<T>;
}) => {
  return array.reduce<Record<string, T>>((acc, occurrence) => {
    const currentUniqueKey = occurrence[uniqueKey] as string;

    if (isDefined(acc[currentUniqueKey])) {
      throw new Error(
        `Should never occur, flat array contains twice the same unique key ${occurrence[uniqueKey]}`,
      );
    }

    return {
      ...acc,
      [currentUniqueKey]: occurrence,
    };
  }, {});
};
