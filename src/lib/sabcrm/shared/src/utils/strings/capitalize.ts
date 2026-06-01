/**
 * Capitalizes the first character of a string.
 */
export const capitalize = (stringToCapitalize: string): string => {
  if (typeof stringToCapitalize !== 'string' || stringToCapitalize.length === 0) {
    return '';
  }

  return stringToCapitalize[0].toUpperCase() + stringToCapitalize.slice(1);
};
