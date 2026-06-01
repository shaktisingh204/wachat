export const transformNumericField = (
  value: number | string | null,
): number | null => {
  return value === null ? null : Number(value);
};
