// Simple guard — avoids taking on @sniptt/guards dependency
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const capitalize = (stringToCapitalize: string) => {
  if (!isNonEmptyString(stringToCapitalize)) return '';

  return stringToCapitalize[0].toUpperCase() + stringToCapitalize.slice(1);
};
